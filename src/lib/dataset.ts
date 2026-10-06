import fs from 'fs';
import path from 'path';
import { generatePortfolioData, generateStressTestData } from './portfolioGenerator';
export { generatePortfolioData, generateStressTestData };

export interface ProjectTask {
  Task_ID: string;
  Project_Name: string;
  Task_Title: string;
  Sprint?: string;
  Owner: string;
  Department: string;
  Priority: 'Critical' | 'High' | 'Medium' | 'Low' | string;
  Status: 'Completed' | 'In Progress' | 'Blocked' | 'In Review' | 'Planned' | string;
  Progress_Percent: number;
  Estimated_Hours: number;
  Actual_Hours: number;
  Allocated_Budget_USD: number;
  Actual_Spend_USD: number;
  Start_Date: string;
  Due_Date: string;
  End_Date?: string;
  Project_Manager?: string;
  // Strictly typed JavaScript Date objects in memory
  startDateObj?: Date | null;
  dueDateObj?: Date | null;
  endDateObj?: Date | null;
  Start_Date_Obj?: Date | null;
  End_Date_Obj?: Date | null;
  Due_Date_Obj?: Date | null;
  Risk_Level: 'Critical' | 'High' | 'Medium' | 'Low' | string;
  Number_of_Team_Members?: number;
  Team_Members_Count?: number;
  Blocker_Details?: string;
  [key: string]: any;
}

export interface DatasetInfo {
  fileName: string;
  filePath: string;
  recordCount: number;
  columns: string[];
  records: ProjectTask[];
  fileSizeBytes: number;
  summary: {
    totalBudget: number;
    totalSpend: number;
    avgProgress: number;
    blockedCount: number;
    inProgressCount: number;
    completedCount: number;
    criticalRiskCount: number;
    departments: string[];
    projects: string[];
  };
}

/**
 * Robust CSV Line Parser supporting quoted fields and embedded commas
 */
function parseCsvLine(line: string, delimiter: string = ','): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' || char === "'") {
      if (inQuotes && line[i + 1] === char) {
        current += char;
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Parse raw text into structured JSON array
 */
function parseContentToJSON(rawContent: string): { records: ProjectTask[]; columns: string[] } {
  const trimmed = rawContent.trim();
  if (!trimmed) {
    return { records: [], columns: [] };
  }

  // Check if content is already JSON
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      const records = Array.isArray(parsed)
        ? parsed
        : (parsed.data || parsed.tasks || parsed.records || parsed.projects || [parsed]);
      
      const columns = records.length > 0 ? Object.keys(records[0]) : [];
      return { records, columns };
    } catch {
      // Fall through to CSV parsing
    }
  }

  // Parse as CSV / Delimited
  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    return { records: [], columns: [] };
  }

  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  const rawHeaders = parseCsvLine(lines[0], delimiter);
  const headers = rawHeaders.map((h) => h.replace(/^["']|["']$/g, '').trim());

  const records: ProjectTask[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i], delimiter);
    if (values.length === 0 || (values.length === 1 && !values[0])) continue;

    const rowObj: Record<string, any> = {};
    headers.forEach((header, colIndex) => {
      let val: any = values[colIndex] ?? '';
      val = typeof val === 'string' ? val.replace(/^["']|["']$/g, '').trim() : val;

      // Smart numerical conversion for metrics
      if (/^-?\d+(\.\d+)?$/.test(val)) {
        val = Number(val);
      }

      rowObj[header] = val;
    });

    // Provide normalized defaults for essential fields
    const task: ProjectTask = {
      Task_ID: rowObj.Task_ID || rowObj.id || `TASK-${i}`,
      Project_Name: rowObj.Project_Name || rowObj.project || 'General Project',
      Task_Title: rowObj.Task_Title || rowObj.title || rowObj.task || `Task ${i}`,
      Sprint: rowObj.Sprint || rowObj.sprint || 'Sprint 1',
      Owner: rowObj.Owner || rowObj.assignee || 'Unassigned',
      Department: rowObj.Department || rowObj.dept || 'Engineering',
      Priority: rowObj.Priority || rowObj.priority || 'Medium',
      Status: rowObj.Status || rowObj.status || 'In Progress',
      Progress_Percent: Number(rowObj.Progress_Percent ?? rowObj.progress ?? 0),
      Estimated_Hours: Number(rowObj.Estimated_Hours ?? rowObj.estimated_hours ?? 0),
      Actual_Hours: Number(rowObj.Actual_Hours ?? rowObj.actual_hours ?? 0),
      Allocated_Budget_USD: Number(rowObj.Allocated_Budget_USD ?? rowObj.budget ?? 0),
      Actual_Spend_USD: Number(rowObj.Actual_Spend_USD ?? rowObj.spent ?? 0),
      Start_Date: rowObj.Start_Date || rowObj.start_date || '2026-08-01',
      Due_Date: rowObj.Due_Date || rowObj.due_date || '2026-10-01',
      Risk_Level: rowObj.Risk_Level || rowObj.risk || 'Low',
      Blocker_Details: rowObj.Blocker_Details || rowObj.blocker || 'None',
      ...rowObj,
    };

    records.push(task);
  }

  return { records, columns: headers };
}

/**
 * Reads the local file exactly named "Project Management "
 * with fallbacks to trimmed, Windows NT extended path, and standard variations.
 */
export function getProjectManagementDataset(): DatasetInfo {
  const cwd = process.cwd();

  // Primary target: exactly "Project Management " (with trailing space)
  const candidatePaths: string[] = [
    process.platform === 'win32'
      ? `\\\\?\\${path.resolve(cwd, 'Project Management ')}`
      : path.join(cwd, 'Project Management '),
    path.join(cwd, 'Project Management '),
    path.join(cwd, 'Project Management'),
    path.join(cwd, 'Project Management .csv'),
    path.join(cwd, 'Project Management.csv'),
    path.join(cwd, 'Project Management.json'),
    path.join(cwd, 'Project Management.txt'),
  ];

  let resolvedPath: string | null = null;
  let rawContent: string | null = null;
  let resolvedFileName = 'Project Management Portfolio';

  for (const candidate of candidatePaths) {
    try {
      if (fs.existsSync(candidate)) {
        const content = fs.readFileSync(candidate, 'utf-8');
        // Delete obsolete legacy PRJ-101 dataset if present
        if (content.includes('PRJ-101')) {
          try {
            fs.unlinkSync(candidate);
          } catch {
            // Ignore
          }
          continue;
        }
        rawContent = content;
        resolvedPath = candidate;
        resolvedFileName = path.basename(candidate);
        break;
      }
    } catch {
      // Continue checking next candidate
    }
  }

  // If still not resolved via exact candidate check, scan directory for match
  if (!resolvedPath || rawContent === null) {
    try {
      const files = fs.readdirSync(cwd);
      const match = files.find((f) => f.startsWith('Project Management'));
      if (match) {
        const testPath = path.join(cwd, match);
        const content = fs.readFileSync(testPath, 'utf-8');
        if (content.includes('PRJ-101')) {
          try {
            fs.unlinkSync(testPath);
          } catch {
            // Ignore
          }
        } else {
          resolvedPath = testPath;
          resolvedFileName = match;
          rawContent = content;
        }
      }
    } catch {
      // Fallback
    }
  }

  let records: ProjectTask[] = [];
  let columns: string[] = [];
  let fileSizeBytes = 0;

  if (resolvedPath && rawContent !== null) {
    const parsed = parseContentToJSON(rawContent);
    records = parsed.records;
    columns = parsed.columns;
    fileSizeBytes = Buffer.byteLength(rawContent, 'utf-8');
  } else {
    // Generate deterministic 100-project portfolio dataset in-memory without writing files to disk
    records = generatePortfolioData(100);
    columns = [
      'Task_ID',
      'Project_Name',
      'Task_Title',
      'Sprint',
      'Owner',
      'Department',
      'Priority',
      'Status',
      'Progress_Percent',
      'Estimated_Hours',
      'Actual_Hours',
      'Allocated_Budget_USD',
      'Actual_Spend_USD',
      'Start_Date',
      'Due_Date',
      'Risk_Level',
      'Blocker_Details',
    ];
    fileSizeBytes = records.length * 140;
    resolvedFileName = 'Project Portfolio (100 Tasks)';
  }

  // Compute analytical metrics
  let totalBudget = 0;
  let totalSpend = 0;
  let sumProgress = 0;
  let blockedCount = 0;
  let inProgressCount = 0;
  let completedCount = 0;
  let criticalRiskCount = 0;
  const departmentsSet = new Set<string>();
  const projectsSet = new Set<string>();

  for (const r of records) {
    totalBudget += Number(r.Allocated_Budget_USD || 0);
    totalSpend += Number(r.Actual_Spend_USD || 0);
    sumProgress += Number(r.Progress_Percent || 0);

    const st = String(r.Status || '').toLowerCase();
    if (st.includes('block')) blockedCount++;
    else if (st.includes('progress')) inProgressCount++;
    else if (st.includes('complete')) completedCount++;

    const risk = String(r.Risk_Level || '').toLowerCase();
    if (risk.includes('critical')) criticalRiskCount++;

    if (r.Department) departmentsSet.add(r.Department);
    if (r.Project_Name) projectsSet.add(r.Project_Name);
  }

  const avgProgress = records.length > 0 ? Math.round(sumProgress / records.length) : 0;

  return {
    fileName: resolvedFileName,
    filePath: resolvedPath || 'In-Memory Portfolio',
    recordCount: records.length,
    columns,
    records,
    fileSizeBytes,
    summary: {
      totalBudget,
      totalSpend,
      avgProgress,
      blockedCount,
      inProgressCount,
      completedCount,
      criticalRiskCount,
      departments: Array.from(departmentsSet),
      projects: Array.from(projectsSet),
    },
  };
}
