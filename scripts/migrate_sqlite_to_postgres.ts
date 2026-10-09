import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { backupDatabase } from './backup_database';

export interface MigrationSummary {
  success: boolean;
  tasksCount: number;
  projectsCount: number;
  departmentsCount: number;
  totalBudget: number;
  totalSpend: number;
  outputSqlFile?: string;
  message: string;
}

/**
 * Phase 8: Idempotent PostgreSQL Migration Utility
 * 1. Takes verified backup of SQLite database first
 * 2. Extracts schema and records
 * 3. Formats PostgreSQL DDL and parameterized statements
 * 4. Never mutates or deletes source SQLite database
 */
export async function generatePostgresMigration(): Promise<MigrationSummary> {
  console.log('--- STEP 1: Creating Verified SQLite Backup Prior to Migration ---');
  const backupRes = await backupDatabase();
  console.log(`Backup completed: ${backupRes.backupPath} (${backupRes.taskCount} tasks, $${backupRes.budget.toLocaleString()} budget)`);

  const dbPath = process.env.DATABASE_FILE
    ? path.resolve(process.env.DATABASE_FILE)
    : path.join(process.cwd(), 'data', 'pm_insight_engine.db');

  const db = new Database(dbPath, { readonly: true });

  const tasks = db.prepare('SELECT * FROM tasks ORDER BY task_id ASC').all() as any[];
  const projects = db.prepare('SELECT * FROM projects ORDER BY project_name ASC').all() as any[];
  const departments = db.prepare('SELECT * FROM departments ORDER BY department_name ASC').all() as any[];
  const imports = db.prepare('SELECT * FROM dataset_imports ORDER BY id ASC').all() as any[];

  db.close();

  console.log(`--- STEP 2: Extracted ${tasks.length} tasks, ${projects.length} projects, ${departments.length} departments ---`);

  // Build PostgreSQL DDL
  let sql = `-- ============================================================================
-- PM INSIGHT ENGINE: POSTGRESQL MIGRATION SCRIPT
-- Generated: ${new Date().toISOString()}
-- Source: SQLite pm_insight_engine.db (${tasks.length} tasks)
-- ============================================================================

BEGIN;

-- 1. Create Projects Table
CREATE TABLE IF NOT EXISTS projects (
  project_name VARCHAR(255) PRIMARY KEY,
  department VARCHAR(255),
  project_manager VARCHAR(255),
  total_budget NUMERIC(14, 2) DEFAULT 0,
  total_spend NUMERIC(14, 2) DEFAULT 0,
  task_count INTEGER DEFAULT 0,
  avg_progress NUMERIC(5, 2) DEFAULT 0,
  status VARCHAR(100) DEFAULT 'Active',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create Departments Table
CREATE TABLE IF NOT EXISTS departments (
  department_name VARCHAR(255) PRIMARY KEY,
  task_count INTEGER DEFAULT 0,
  total_budget NUMERIC(14, 2) DEFAULT 0,
  total_spend NUMERIC(14, 2) DEFAULT 0
);

-- 3. Create Tasks Table
CREATE TABLE IF NOT EXISTS tasks (
  task_id VARCHAR(100) PRIMARY KEY,
  project_name VARCHAR(255) NOT NULL REFERENCES projects(project_name) ON DELETE CASCADE ON UPDATE CASCADE,
  task_title TEXT NOT NULL,
  sprint VARCHAR(100),
  owner VARCHAR(255),
  department VARCHAR(255) NOT NULL,
  priority VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL,
  progress_percent NUMERIC(5, 2) NOT NULL CHECK(progress_percent >= 0 AND progress_percent <= 100),
  estimated_hours NUMERIC(10, 2) NOT NULL DEFAULT 0,
  actual_hours NUMERIC(10, 2) NOT NULL DEFAULT 0,
  allocated_budget NUMERIC(14, 2) NOT NULL DEFAULT 0,
  actual_spend NUMERIC(14, 2) NOT NULL DEFAULT 0,
  start_date VARCHAR(50) NOT NULL,
  due_date VARCHAR(50) NOT NULL,
  end_date VARCHAR(50),
  risk_level VARCHAR(50) NOT NULL,
  team_members_count INTEGER DEFAULT 1,
  blocker_details TEXT,
  raw_json JSONB,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 4. Create Dataset Imports Audit Table
CREATE TABLE IF NOT EXISTS dataset_imports (
  id SERIAL PRIMARY KEY,
  file_name VARCHAR(255) NOT NULL,
  record_count INTEGER NOT NULL,
  total_budget NUMERIC(14, 2) NOT NULL,
  total_spend NUMERIC(14, 2) NOT NULL,
  status VARCHAR(50) NOT NULL,
  error_message TEXT,
  import_timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 5. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_pg_tasks_project ON tasks(project_name);
CREATE INDEX IF NOT EXISTS idx_pg_tasks_department ON tasks(department);
CREATE INDEX IF NOT EXISTS idx_pg_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_pg_tasks_dates ON tasks(start_date, due_date);
CREATE INDEX IF NOT EXISTS idx_pg_tasks_budget_spend ON tasks(allocated_budget, actual_spend);

-- ============================================================================
-- INSERT RECORDS
-- ============================================================================
`;

  // Escape helper for SQL strings
  const esc = (val: any): string => {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'number') return String(val);
    return `'${String(val).replace(/'/g, "''")}'`;
  };

  // Projects Inserts
  for (const p of projects) {
    sql += `INSERT INTO projects (project_name, department, project_manager, total_budget, total_spend, task_count, avg_progress, status)
VALUES (${esc(p.project_name)}, ${esc(p.department)}, ${esc(p.project_manager)}, ${p.total_budget || 0}, ${p.total_spend || 0}, ${p.task_count || 0}, ${p.avg_progress || 0}, ${esc(p.status || 'Active')})
ON CONFLICT (project_name) DO UPDATE SET
  department = EXCLUDED.department,
  total_budget = EXCLUDED.total_budget,
  total_spend = EXCLUDED.total_spend,
  task_count = EXCLUDED.task_count,
  avg_progress = EXCLUDED.avg_progress,
  updated_at = CURRENT_TIMESTAMP;\n`;
  }

  // Departments Inserts
  for (const d of departments) {
    sql += `INSERT INTO departments (department_name, task_count, total_budget, total_spend)
VALUES (${esc(d.department_name)}, ${d.task_count || 0}, ${d.total_budget || 0}, ${d.total_spend || 0})
ON CONFLICT (department_name) DO UPDATE SET
  task_count = EXCLUDED.task_count,
  total_budget = EXCLUDED.total_budget,
  total_spend = EXCLUDED.total_spend;\n`;
  }

  // Tasks Inserts
  for (const t of tasks) {
    const rawJsonStr = t.raw_json ? esc(t.raw_json) : 'NULL';
    sql += `INSERT INTO tasks (
  task_id, project_name, task_title, sprint, owner, department, priority,
  status, progress_percent, estimated_hours, actual_hours, allocated_budget,
  actual_spend, start_date, due_date, end_date, risk_level, team_members_count,
  blocker_details, raw_json
) VALUES (
  ${esc(t.task_id)}, ${esc(t.project_name)}, ${esc(t.task_title)}, ${esc(t.sprint)},
  ${esc(t.owner)}, ${esc(t.department)}, ${esc(t.priority)}, ${esc(t.status)},
  ${t.progress_percent}, ${t.estimated_hours || 0}, ${t.actual_hours || 0},
  ${t.allocated_budget || 0}, ${t.actual_spend || 0}, ${esc(t.start_date)},
  ${esc(t.due_date)}, ${esc(t.end_date)}, ${esc(t.risk_level)},
  ${t.team_members_count || 1}, ${esc(t.blocker_details)}, ${rawJsonStr}::jsonb
) ON CONFLICT (task_id) DO UPDATE SET
  task_title = EXCLUDED.task_title,
  progress_percent = EXCLUDED.progress_percent,
  allocated_budget = EXCLUDED.allocated_budget,
  actual_spend = EXCLUDED.actual_spend,
  updated_at = CURRENT_TIMESTAMP;\n`;
  }

  sql += `\nCOMMIT;\n`;

  const outputSqlFile = path.join(process.cwd(), 'data', 'postgres_migration.sql');
  fs.writeFileSync(outputSqlFile, sql, 'utf-8');

  console.log(`[POSTGRES DDL SCRIPT WRITTEN]: ${outputSqlFile} (${(fs.statSync(outputSqlFile).size / 1024).toFixed(1)} KB)`);

  return {
    success: true,
    tasksCount: tasks.length,
    projectsCount: projects.length,
    departmentsCount: departments.length,
    totalBudget: backupRes.budget,
    totalSpend: backupRes.spend,
    outputSqlFile,
    message: `Migration script generated with ${tasks.length} tasks ($${backupRes.budget.toLocaleString()} budget, $${backupRes.spend.toLocaleString()} spend). Source SQLite database preserved intact.`,
  };
}

if (require.main === module) {
  generatePostgresMigration()
    .then((res) => console.log('Migration Result:', res))
    .catch((err) => console.error('Migration error:', err));
}
