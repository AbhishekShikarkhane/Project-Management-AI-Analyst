import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { ProjectTask, cleanNumber, cleanProgress } from './dataset';
import {
  DatasetSummary,
  calculateDatasetSummary,
  analyzeBudgetVariance,
  BudgetVarianceAnalysis,
  isValidProgress,
  normalizeProgress,
} from './analytics';

export interface DatabaseImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  rejected: number;
  errors: string[];
  totalBudget: number;
  totalSpend: number;
}

export interface TaskFilterOptions {
  department?: string | null;
  status?: string | null;
  riskLevel?: string | null;
  project?: string | null;
}

let dbInstance: Database.Database | null = null;
let currentDbPath: string | null = null;

/**
 * Returns default production/development SQLite database path.
 * Can be overridden with process.env.DATABASE_FILE or explicit argument.
 */
export function getDefaultDbPath(): string {
  if (process.env.DATABASE_FILE) {
    return path.resolve(process.env.DATABASE_FILE);
  }
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    try {
      fs.mkdirSync(dataDir, { recursive: true });
    } catch {}
  }
  return path.join(dataDir, 'pm_insight_engine.db');
}

/**
 * Returns the singleton or specified database connection.
 * Configures WAL mode, busy timeout, and foreign keys for high reliability and concurrency.
 */
export function getDatabase(targetPath?: string): Database.Database {
  const chosenPath = targetPath ? path.resolve(targetPath) : getDefaultDbPath();

  if (dbInstance && currentDbPath === chosenPath) {
    return dbInstance;
  }

  // If switching databases (e.g. during test runs), close previous instance
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {}
    dbInstance = null;
  }

  const dir = path.dirname(chosenPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(chosenPath, {
    // verbose: process.env.NODE_ENV === 'development' ? console.log : undefined,
  });

  // Enable WAL (Write-Ahead Logging) mode for concurrent readers & fast writes
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');

  dbInstance = db;
  currentDbPath = chosenPath;

  // Initialize schema if needed
  initDatabaseSchema(db);

  return db;
}

/**
 * Closes the active database connection (useful for testing and graceful shutdowns)
 */
export function closeDatabase(): void {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {}
    dbInstance = null;
    currentDbPath = null;
  }
}

/**
 * Initializes database schema with primary keys, foreign keys, constraints, and indexes.
 */
export function initDatabaseSchema(db: Database.Database): void {
  db.exec(`
    -- Projects table
    CREATE TABLE IF NOT EXISTS projects (
      project_name TEXT PRIMARY KEY,
      department TEXT,
      project_manager TEXT,
      total_budget REAL DEFAULT 0,
      total_spend REAL DEFAULT 0,
      task_count INTEGER DEFAULT 0,
      avg_progress REAL DEFAULT 0,
      status TEXT DEFAULT 'Active',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Departments table
    CREATE TABLE IF NOT EXISTS departments (
      department_name TEXT PRIMARY KEY,
      task_count INTEGER DEFAULT 0,
      total_budget REAL DEFAULT 0,
      total_spend REAL DEFAULT 0
    );

    -- Tasks table
    CREATE TABLE IF NOT EXISTS tasks (
      task_id TEXT PRIMARY KEY,
      project_name TEXT NOT NULL,
      task_title TEXT NOT NULL,
      sprint TEXT,
      owner TEXT,
      department TEXT NOT NULL,
      priority TEXT NOT NULL,
      status TEXT NOT NULL,
      progress_percent REAL NOT NULL CHECK(progress_percent >= 0 AND progress_percent <= 100),
      estimated_hours REAL NOT NULL DEFAULT 0,
      actual_hours REAL NOT NULL DEFAULT 0,
      allocated_budget REAL NOT NULL DEFAULT 0,
      actual_spend REAL NOT NULL DEFAULT 0,
      start_date TEXT NOT NULL,
      due_date TEXT NOT NULL,
      end_date TEXT,
      risk_level TEXT NOT NULL,
      team_members_count INTEGER DEFAULT 1,
      blocker_details TEXT,
      raw_json TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_name) REFERENCES projects(project_name) ON DELETE CASCADE ON UPDATE CASCADE
    );

    -- Dataset Imports audit log
    CREATE TABLE IF NOT EXISTS dataset_imports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_name TEXT NOT NULL,
      record_count INTEGER NOT NULL,
      total_budget REAL NOT NULL,
      total_spend REAL NOT NULL,
      status TEXT NOT NULL,
      error_message TEXT,
      import_timestamp TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Performance Indexes
    CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_name);
    CREATE INDEX IF NOT EXISTS idx_tasks_department ON tasks(department);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
    CREATE INDEX IF NOT EXISTS idx_tasks_risk_level ON tasks(risk_level);
    CREATE INDEX IF NOT EXISTS idx_tasks_dates ON tasks(start_date, due_date);
    CREATE INDEX IF NOT EXISTS idx_tasks_budget_spend ON tasks(allocated_budget, actual_spend);

    -- Backfill owner from raw_json if column is empty but present in JSON
    UPDATE tasks 
    SET owner = json_extract(raw_json, '$."Owner / Project Manager"')
    WHERE (owner IS NULL OR owner = '') 
      AND raw_json IS NOT NULL 
      AND json_extract(raw_json, '$."Owner / Project Manager"') IS NOT NULL;
  `);
}

/**
 * Maps database row to standard ProjectTask object.
 */
export function rowToProjectTask(row: any): ProjectTask {
  let extraProps = {};
  if (row.raw_json) {
    try {
      extraProps = JSON.parse(row.raw_json);
    } catch {}
  }

  const startDateObj = row.start_date ? new Date(row.start_date) : null;
  const dueDateObj = row.due_date ? new Date(row.due_date) : null;
  const endDateObj = row.end_date ? new Date(row.end_date) : dueDateObj;

  return {
    ...extraProps,
    Task_ID: row.task_id,
    Project_Name: row.project_name,
    Task_Title: row.task_title,
    Sprint: row.sprint || 'Sprint 1',
    Owner: row.owner || (extraProps as any)['Owner / Project Manager'] || (extraProps as any)['Project Manager'] || '',
    Project_Manager: row.owner || (extraProps as any)['Owner / Project Manager'] || (extraProps as any)['Project Manager'] || '',
    Department: row.department,
    Priority: row.priority,
    Status: row.status,
    Progress_Percent: Number(row.progress_percent),
    'Progress (%)': Number(row.progress_percent),
    Progress: Number(row.progress_percent),
    Estimated_Hours: Number(row.estimated_hours),
    Actual_Hours: Number(row.actual_hours),
    Allocated_Budget_USD: Number(row.allocated_budget),
    Actual_Spend_USD: Number(row.actual_spend),
    Budget: Number(row.allocated_budget),
    Spent: Number(row.actual_spend),
    Start_Date: row.start_date,
    Due_Date: row.due_date,
    End_Date: row.end_date || row.due_date,
    startDateObj,
    dueDateObj,
    endDateObj,
    Start_Date_Obj: startDateObj,
    Due_Date_Obj: dueDateObj,
    End_Date_Obj: endDateObj,
    Risk_Level: row.risk_level,
    Number_of_Team_Members: Number(row.team_members_count || 1),
    Team_Members_Count: Number(row.team_members_count || 1),
    Blocker_Details: row.blocker_details || 'None',
  };
}

/**
 * Synchronizes aggregate projects and departments tables from current tasks table.
 */
export function syncAggregateEntities(db: Database.Database): void {
  // Clear and rebuild projects and departments based on current tasks
  const projectAggregates = db
    .prepare(
      `
    SELECT
      project_name,
      department,
      owner as project_manager,
      SUM(allocated_budget) as total_budget,
      SUM(actual_spend) as total_spend,
      COUNT(*) as task_count,
      ROUND(AVG(progress_percent), 1) as avg_progress
    FROM tasks
    GROUP BY project_name
  `
    )
    .all() as any[];

  const insertProjectStmt = db.prepare(`
    INSERT INTO projects (project_name, department, project_manager, total_budget, total_spend, task_count, avg_progress)
    VALUES (@project_name, @department, @project_manager, @total_budget, @total_spend, @task_count, @avg_progress)
    ON CONFLICT(project_name) DO UPDATE SET
      department = excluded.department,
      project_manager = excluded.project_manager,
      total_budget = excluded.total_budget,
      total_spend = excluded.total_spend,
      task_count = excluded.task_count,
      avg_progress = excluded.avg_progress,
      updated_at = CURRENT_TIMESTAMP
  `);

  for (const pa of projectAggregates) {
    insertProjectStmt.run(pa);
  }

  // Remove projects with no tasks
  db.exec(`
    DELETE FROM projects WHERE project_name NOT IN (SELECT DISTINCT project_name FROM tasks)
  `);

  // Departments
  const deptAggregates = db
    .prepare(
      `
    SELECT
      department as department_name,
      COUNT(*) as task_count,
      SUM(allocated_budget) as total_budget,
      SUM(actual_spend) as total_spend
    FROM tasks
    GROUP BY department
  `
    )
    .all() as any[];

  const insertDeptStmt = db.prepare(`
    INSERT INTO departments (department_name, task_count, total_budget, total_spend)
    VALUES (@department_name, @task_count, @total_budget, @total_spend)
    ON CONFLICT(department_name) DO UPDATE SET
      task_count = excluded.task_count,
      total_budget = excluded.total_budget,
      total_spend = excluded.total_spend
  `);

  for (const da of deptAggregates) {
    insertDeptStmt.run(da);
  }

  db.exec(`
    DELETE FROM departments WHERE department_name NOT IN (SELECT DISTINCT department FROM tasks)
  `);
}

/**
 * Performs a transactional, atomic import of tasks.
 * Validates all records before committing.
 * If mode is 'replace', clears existing tasks first within the transaction.
 * If mode is 'upsert', inserts new or updates existing records.
 * On any fatal validation or execution error, rolls back completely without corrupting active dataset.
 */
export function importTasksTransaction(
  rawTasks: any[],
  options: {
    fileName?: string;
    mode?: 'replace' | 'upsert';
    db?: Database.Database;
  } = {}
): DatabaseImportResult {
  const db = options.db || getDatabase();
  const mode = options.mode || 'replace';
  const fileName = options.fileName || 'imported_dataset.csv';

  if (!rawTasks || !Array.isArray(rawTasks) || rawTasks.length === 0) {
    return {
      success: false,
      imported: 0,
      skipped: 0,
      rejected: 0,
      errors: ['No task records found in the import payload.'],
      totalBudget: 0,
      totalSpend: 0,
    };
  }

  const errors: string[] = [];
  const validRecords: any[] = [];
  const seenTaskIds = new Set<string>();
  let skipped = 0;
  let rejected = 0;

  // Validation phase
  for (let i = 0; i < rawTasks.length; i++) {
    const r = rawTasks[i];
    const taskId = String(r.Task_ID || r['Task ID'] || r.id || '').trim();

    if (!taskId) {
      errors.push(`Row ${i + 1}: Missing mandatory Task_ID.`);
      rejected++;
      continue;
    }

    if (seenTaskIds.has(taskId)) {
      if (mode === 'replace') {
        // In replace mode, duplicate IDs in same file are rejected/skipped
        errors.push(`Row ${i + 1}: Duplicate Task_ID '${taskId}' found in import file.`);
        skipped++;
        continue;
      }
    }
    seenTaskIds.add(taskId);

    const projectName = String(r.Project_Name || r['Project Name'] || r.project || 'General Project').trim();
    const taskTitle = String(r.Task_Title || r['Task Title'] || r.title || `Task ${taskId}`).trim();
    const department = String(r.Department || r.department || 'Engineering').trim();
    const priority = String(r.Priority || r.priority || 'Medium').trim();
    const status = String(r.Status || r.status || 'Planned').trim();

    // Budget and Spend validation
    const rawBudget = r.Allocated_Budget_USD ?? r['Allocated Budget ($)'] ?? r.Budget ?? r['Budget (USD)'] ?? r.budget;
    const rawSpend = r.Actual_Spend_USD ?? r['Actual Spend ($)'] ?? r.Spent ?? r['Spent (USD)'] ?? r.spend;

    const budget = cleanNumber(rawBudget, 0);
    const spend = cleanNumber(rawSpend, 0);

    if (budget < 0) {
      errors.push(`Row ${i + 1} (${taskId}): Allocated budget cannot be negative ($${budget}).`);
      rejected++;
      continue;
    }
    if (spend < 0) {
      errors.push(`Row ${i + 1} (${taskId}): Actual spend cannot be negative ($${spend}).`);
      rejected++;
      continue;
    }

    // Progress validation
    const rawProg = r.Progress_Percent ?? r['Progress (%)'] ?? r.Progress ?? r.progress;
    let progressVal = 0;
    if (rawProg !== undefined && rawProg !== null && String(rawProg).trim() !== '') {
      progressVal = cleanProgress(rawProg, status);
    } else {
      // Documented business rule: derive sensible default based on status
      const stLower = status.toLowerCase();
      if (stLower.includes('complete') || stLower.includes('done')) progressVal = 100;
      else if (stLower.includes('progress') || stLower.includes('track')) progressVal = 50;
      else progressVal = 0;
    }

    const startDate = String(r.Start_Date || r['Start Date'] || '2026-09-01').trim();
    const dueDate = String(r.Due_Date || r['Due Date'] || r.End_Date || r['End Date'] || '2026-10-15').trim();
    const endDate = String(r.End_Date || r['End Date'] || dueDate).trim();
    const owner = String(
      r.Owner ||
      r['Owner / Project Manager'] ||
      r['Owner/Project Manager'] ||
      r['Project Manager'] ||
      r.Project_Manager ||
      ''
    ).trim();
    const sprint = String(r.Sprint || r.sprint || 'Sprint 1').trim();
    const riskLevel = String(r.Risk_Level || r['Risk Level'] || 'Low').trim();
    const estHours = cleanNumber(r.Estimated_Hours ?? r['Estimated Hours'], 0);
    const actHours = cleanNumber(r.Actual_Hours ?? r['Actual Hours'], 0);
    const teamMembers = Math.max(1, Math.round(cleanNumber(r.Number_of_Team_Members ?? r['Number of Team Members'], 1)));
    const blocker = String(r.Blocker_Details || r['Blocker Details'] || 'None').trim();

    validRecords.push({
      task_id: taskId,
      project_name: projectName,
      task_title: taskTitle,
      sprint,
      owner,
      department,
      priority,
      status,
      progress_percent: progressVal,
      estimated_hours: estHours,
      actual_hours: actHours,
      allocated_budget: Math.round(budget * 100) / 100,
      actual_spend: Math.round(spend * 100) / 100,
      start_date: startDate,
      due_date: dueDate,
      end_date: endDate,
      risk_level: riskLevel,
      team_members_count: teamMembers,
      blocker_details: blocker,
      raw_json: JSON.stringify(r),
    });
  }

  if (validRecords.length === 0) {
    db.prepare(`
      INSERT INTO dataset_imports (file_name, record_count, total_budget, total_spend, status, error_message)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(fileName, 0, 0, 0, 'FAILED', errors.join('; '));

    return {
      success: false,
      imported: 0,
      skipped,
      rejected,
      errors: errors.length > 0 ? errors : ['No valid records could be processed.'],
      totalBudget: 0,
      totalSpend: 0,
    };
  }

  // Pre-seed referenced projects to satisfy foreign key constraints
  const uniqueProjects = Array.from(new Set(validRecords.map((vr) => vr.project_name)));

  // Atomic database transaction
  const insertTransaction = db.transaction(() => {
    // 1. Ensure projects exist in parent table first so FK passes
    const seedProjectStmt = db.prepare(`
      INSERT OR IGNORE INTO projects (project_name, department, project_manager)
      VALUES (?, ?, ?)
    `);
    for (const vr of validRecords) {
      seedProjectStmt.run(vr.project_name, vr.department, vr.owner);
    }

    // 2. If replace mode, clear existing tasks
    if (mode === 'replace') {
      db.prepare('DELETE FROM tasks').run();
    }

    // 3. Insert or Replace tasks
    const insertTaskStmt = db.prepare(`
      INSERT INTO tasks (
        task_id, project_name, task_title, sprint, owner, department,
        priority, status, progress_percent, estimated_hours, actual_hours,
        allocated_budget, actual_spend, start_date, due_date, end_date,
        risk_level, team_members_count, blocker_details, raw_json, updated_at
      ) VALUES (
        @task_id, @project_name, @task_title, @sprint, @owner, @department,
        @priority, @status, @progress_percent, @estimated_hours, @actual_hours,
        @allocated_budget, @actual_spend, @start_date, @due_date, @end_date,
        @risk_level, @team_members_count, @blocker_details, @raw_json, CURRENT_TIMESTAMP
      )
      ON CONFLICT(task_id) DO UPDATE SET
        project_name = excluded.project_name,
        task_title = excluded.task_title,
        sprint = excluded.sprint,
        owner = excluded.owner,
        department = excluded.department,
        priority = excluded.priority,
        status = excluded.status,
        progress_percent = excluded.progress_percent,
        estimated_hours = excluded.estimated_hours,
        actual_hours = excluded.actual_hours,
        allocated_budget = excluded.allocated_budget,
        actual_spend = excluded.actual_spend,
        start_date = excluded.start_date,
        due_date = excluded.due_date,
        end_date = excluded.end_date,
        risk_level = excluded.risk_level,
        team_members_count = excluded.team_members_count,
        blocker_details = excluded.blocker_details,
        raw_json = excluded.raw_json,
        updated_at = CURRENT_TIMESTAMP
    `);

    for (const record of validRecords) {
      insertTaskStmt.run(record);
    }

    // 4. Update parent projects and departments aggregates
    syncAggregateEntities(db);

    // 5. Calculate final imported totals
    const totals = db.prepare('SELECT SUM(allocated_budget) as totalBudget, SUM(actual_spend) as totalSpend, COUNT(*) as count FROM tasks').get() as any;

    // 6. Record in dataset_imports audit log
    db.prepare(`
      INSERT INTO dataset_imports (file_name, record_count, total_budget, total_spend, status, error_message)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      fileName,
      totals.count || validRecords.length,
      totals.totalBudget || 0,
      totals.totalSpend || 0,
      'SUCCESS',
      errors.length > 0 ? `Completed with ${errors.length} warnings: ${errors.slice(0, 3).join('; ')}` : null
    );

    return totals;
  });

  try {
    const finalTotals = insertTransaction();
    return {
      success: true,
      imported: validRecords.length,
      skipped,
      rejected,
      errors,
      totalBudget: Number(finalTotals.totalBudget || 0),
      totalSpend: Number(finalTotals.totalSpend || 0),
    };
  } catch (err: any) {
    return {
      success: false,
      imported: 0,
      skipped,
      rejected: rawTasks.length,
      errors: [`Database transaction rolled back: ${err.message}`],
      totalBudget: 0,
      totalSpend: 0,
    };
  }
}

/**
 * Retrieves all task records from persistent database.
 * If empty, automatically seeds from authoritative CSV.
 */
export function getAllTasksFromDB(dbParam?: Database.Database): ProjectTask[] {
  const db = dbParam || getDatabase();
  autoSeedIfEmpty(db);

  const rows = db.prepare('SELECT * FROM tasks ORDER BY task_id ASC').all();
  return rows.map(rowToProjectTask);
}

/**
 * Retrieves filtered task records with parameter binding.
 */
export function getTasksFilteredFromDB(
  filters: TaskFilterOptions,
  dbParam?: Database.Database
): ProjectTask[] {
  const db = dbParam || getDatabase();
  autoSeedIfEmpty(db);

  const conditions: string[] = [];
  const params: Record<string, any> = {};

  if (filters.department) {
    conditions.push('LOWER(department) = LOWER(@department)');
    params.department = filters.department.trim();
  }
  if (filters.status) {
    conditions.push('LOWER(status) = LOWER(@status)');
    params.status = filters.status.trim();
  }
  if (filters.riskLevel) {
    conditions.push('LOWER(risk_level) = LOWER(@riskLevel)');
    params.riskLevel = filters.riskLevel.trim();
  }
  if (filters.project) {
    conditions.push('LOWER(project_name) = LOWER(@project)');
    params.project = filters.project.trim();
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const query = `SELECT * FROM tasks ${whereClause} ORDER BY task_id ASC`;

  const rows = db.prepare(query).all(params);
  return rows.map(rowToProjectTask);
}

/**
 * Returns deterministic dataset summary calculated from database records.
 */
export function getPortfolioSummaryFromDB(
  filters?: TaskFilterOptions,
  dbParam?: Database.Database
): DatasetSummary {
  const tasks = filters ? getTasksFilteredFromDB(filters, dbParam) : getAllTasksFromDB(dbParam);
  return calculateDatasetSummary(tasks);
}

/**
 * Returns deterministic budget variance calculated from database records.
 */
export function getBudgetVarianceFromDB(
  filters?: TaskFilterOptions,
  dbParam?: Database.Database
): BudgetVarianceAnalysis {
  const tasks = filters ? getTasksFilteredFromDB(filters, dbParam) : getAllTasksFromDB(dbParam);
  return analyzeBudgetVariance(tasks);
}

/**
 * Inserts or updates a single task directly in persistent storage.
 */
export function upsertTaskInDB(task: Partial<ProjectTask>, dbParam?: Database.Database): boolean {
  const db = dbParam || getDatabase();
  const res = importTasksTransaction([task], { mode: 'upsert', fileName: 'manual_upsert', db });
  return res.success;
}

/**
 * Deletes a single task from database and updates aggregates.
 */
export function deleteTaskFromDB(taskId: string, dbParam?: Database.Database): boolean {
  const db = dbParam || getDatabase();
  const info = db.prepare('DELETE FROM tasks WHERE task_id = ?').run(taskId);
  if (info.changes > 0) {
    syncAggregateEntities(db);
    return true;
  }
  return false;
}

/**
 * Automatically seeds the database from authoritative CSV if the database has 0 tasks.
 */
export function autoSeedIfEmpty(db: Database.Database): void {
  const countRow = db.prepare('SELECT COUNT(*) as count FROM tasks').get() as { count: number };
  if (countRow && countRow.count > 0) {
    return;
  }

  const authoritativePath = path.join(
    process.cwd(),
    'Data set',
    '150-Project Portfolio (150 tasks).csv'
  );

  if (!fs.existsSync(authoritativePath)) {
    return;
  }

  try {
    const content = fs.readFileSync(authoritativePath, 'utf-8');
    const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) return;

    // Parse CSV headers
    const headerLine = lines[0];
    const headers = headerLine.split(',').map((h) => h.replace(/^"|"$/g, '').trim());

    const records: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      // Basic CSV splitter
      const cols: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let j = 0; j < line.length; j++) {
        const c = line[j];
        if (c === '"') {
          inQuotes = !inQuotes;
        } else if (c === ',' && !inQuotes) {
          cols.push(current.trim());
          current = '';
        } else {
          current += c;
        }
      }
      cols.push(current.trim());

      const rec: any = {};
      headers.forEach((h, idx) => {
        rec[h] = cols[idx] !== undefined ? cols[idx].replace(/^"|"$/g, '') : '';
      });
      records.push(rec);
    }

    importTasksTransaction(records, {
      fileName: '150-Project Portfolio (150 tasks).csv',
      mode: 'replace',
      db,
    });
  } catch (err) {
    console.warn('Could not auto-seed database from CSV:', err);
  }
}
