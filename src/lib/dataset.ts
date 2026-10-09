import fs from 'fs';
import path from 'path';
import { generatePortfolioData, generateStressTestData } from './portfolioGenerator';
import { calculateDatasetSummary } from './analytics';
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
 * Robust numerical sanitizer:
 * Strips currency symbols ($), commas, percentage signs (%), and trailing labels
 */
export function cleanNumber(val: any, fallback: number = 0): number {
  if (typeof val === 'number') {
    return isNaN(val) ? fallback : val;
  }
  if (val === null || val === undefined) return fallback;
  const str = String(val).replace(/[^0-9.-]/g, '').trim();
  if (!str) return fallback;
  const parsed = Number(str);
  return isNaN(parsed) ? fallback : parsed;
}

/**
 * Safely extracts raw Progress field from arbitrary record object formats:
 * Checks 'Progress (%)', 'Progress %', 'Progress', 'progress', 'Progress_Percent',
 * and fuzzy-matches columns containing 'progress' or 'completion'.
 */
export function extractRawProgress(r: any): any {
  if (!r || typeof r !== 'object') return undefined;

  const candidateKeys = [
    'Progress (%)',
    'progress (%)',
    'Progress%',
    'Progress %',
    'progress %',
    'Progress',
    'progress',
    '% Progress',
    '% progress',
    'progress_%',
    'Progress_%',
    'Completion (%)',
    'Completion %',
    'Completion',
    'completion',
    'Percent Complete',
    'Percent_Complete',
    '% Complete',
    '% Completed',
    'percent_complete',
  ];

  for (const key of candidateKeys) {
    if (r[key] !== undefined && r[key] !== null && String(r[key]).trim() !== '') {
      return r[key];
    }
  }

  if (r.Progress_Percent !== undefined && r.Progress_Percent !== null && String(r.Progress_Percent).trim() !== '') {
    const num = Number(r.Progress_Percent);
    if (!isNaN(num) && num > 0) {
      return r.Progress_Percent;
    }
  }

  const keys = Object.keys(r);
  for (const k of keys) {
    const normalized = k.toLowerCase().replace(/[\s_\-()%]/g, '');
    if (
      normalized === 'progress' ||
      normalized === 'progresspercent' ||
      normalized === 'completion' ||
      normalized === 'percentcomplete' ||
      normalized === 'completedpercent'
    ) {
      if (r[k] !== undefined && r[k] !== null && String(r[k]).trim() !== '') {
        return r[k];
      }
    }
  }

  for (const k of keys) {
    const lower = k.toLowerCase();
    if (lower.includes('progress') || lower.includes('completion')) {
      if (r[k] !== undefined && r[k] !== null && String(r[k]).trim() !== '') {
        return r[k];
      }
    }
  }

  if (r.Progress_Percent !== undefined && r.Progress_Percent !== null && String(r.Progress_Percent).trim() !== '') {
    return r.Progress_Percent;
  }

  return undefined;
}

/**
 * Robust Progress sanitizer:
 * - Strips any '%' symbols, extra spaces, and trailing symbols
 * - Correctly converts raw string representations to valid JavaScript Numbers
 * - Handles decimal fraction representations (e.g. 0.45 or "0.45" -> 45%)
 * - Clamps values between 0 and 100
 * - Provides intelligent fallback: If status is 'Completed' and progress is 0 or unassigned,
 *   safely marks as 100%. If status is 'In Progress' and progress is unassigned, provides 50%.
 */
export function cleanProgress(val: any, status?: string, fallback?: number): number {
  const stLower = status ? String(status).toLowerCase().trim() : '';
  const isCompleted = stLower.includes('complete') || stLower.includes('done');
  const isInProgress = stLower.includes('progress') || stLower.includes('active') || stLower.includes('track');

  if (val !== undefined && val !== null && String(val).trim() !== '') {
    if (typeof val === 'number') {
      if (!isNaN(val)) {
        if (val > 0 && val < 1) {
          return Math.round(val * 100);
        }
        if (val === 0 && isCompleted) {
          return 100;
        }
        return Math.min(100, Math.max(0, Math.round(val)));
      }
    } else {
      const rawStr = String(val).trim();
      const stripped = rawStr.replace(/%/g, '').replace(/[^0-9.-]/g, '').trim();
      if (stripped !== '') {
        const parsed = Number(stripped);
        if (!isNaN(parsed)) {
          if (parsed > 0 && parsed < 1 && rawStr.includes('.') && !rawStr.includes('%')) {
            return Math.round(parsed * 100);
          }
          if (parsed === 0 && isCompleted) {
            return 100;
          }
          return Math.min(100, Math.max(0, Math.round(parsed)));
        }
      }
    }
  }

  if (fallback !== undefined && fallback !== null && !isNaN(fallback)) {
    return Math.min(100, Math.max(0, Math.round(fallback)));
  }

  if (isCompleted) {
    return 100;
  }
  if (isInProgress) {
    return 50;
  }

  return 0;
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

      // Smart numerical conversion for metrics if raw string is numeric
      if (/^-?\d+(\.\d+)?$/.test(val)) {
        val = Number(val);
      }

      rowObj[header] = val;
    });

    const status = String(rowObj.Status || rowObj.status || 'In Progress');
    const rawProgress = extractRawProgress(rowObj);
    const progressPercent = cleanProgress(rawProgress, status);

    // Provide normalized defaults for essential fields
    const task: ProjectTask = {
      Task_ID: rowObj.Task_ID || rowObj['Task ID'] || rowObj.id || `TASK-${i}`,
      Project_Name: rowObj.Project_Name || rowObj['Project Name'] || rowObj.project || 'General Project',
      Task_Title: rowObj.Task_Title || rowObj['Task Title'] || rowObj.title || rowObj.task || `Task ${i}`,
      Sprint: rowObj.Sprint || rowObj.sprint || 'Sprint 1',
      Owner: rowObj.Owner || rowObj['Owner / Project Manager'] || rowObj['Project Manager'] || rowObj.assignee || 'Unassigned',
      Department: rowObj.Department || rowObj.dept || 'Engineering',
      Priority: rowObj.Priority || rowObj.priority || 'Medium',
      Status: status,
      Estimated_Hours: cleanNumber(rowObj['Estimated Hours'] ?? rowObj.Estimated_Hours ?? rowObj.estimated_hours, 0),
      Actual_Hours: cleanNumber(rowObj['Actual Hours'] ?? rowObj.Actual_Hours ?? rowObj.actual_hours, 0),
      Allocated_Budget_USD: cleanNumber(rowObj['Allocated Budget ($)'] ?? rowObj.Allocated_Budget_USD ?? rowObj.budget, 0),
      Actual_Spend_USD: cleanNumber(rowObj['Actual Spend ($)'] ?? rowObj.Actual_Spend_USD ?? rowObj.spent, 0),
      Start_Date: rowObj.Start_Date || rowObj['Start Date'] || rowObj.start_date || '2026-08-01',
      Due_Date: rowObj.Due_Date || rowObj['Due Date'] || rowObj.due_date || '2026-10-01',
      Risk_Level: rowObj.Risk_Level || rowObj['Risk Level'] || rowObj.risk || 'Low',
      Blocker_Details: rowObj.Blocker_Details || rowObj['Blocker Details'] || rowObj.blocker || 'None',
      ...rowObj,
      Progress_Percent: progressPercent,
      'Progress (%)': progressPercent,
      Progress: progressPercent,
      progress: progressPercent,
    };

    records.push(task);
  }

  return { records, columns: headers };
}

export { parseContentToJSON };

/**
 * Standardized task sanitizer ensuring all fields are typed and valid
 */
export function sanitizeTask(r: any, idx: number = 0): ProjectTask {
  const rawStatus = String(r.Status || r.status || 'In Progress');
  const rawProgress = extractRawProgress(r);
  const progressPercent = cleanProgress(rawProgress, rawStatus);

  return {
    ...r,
    Task_ID: String(r.Task_ID || r['Task ID'] || r.id || `TASK-${String(idx + 1).padStart(3, '0')}`),
    Project_Name: String(r.Project_Name || r['Project Name'] || r.project || 'General Project'),
    Task_Title: String(r.Task_Title || r['Task Title'] || r.task || r.title || `Task ${idx + 1}`),
    Sprint: String(r.Sprint || r.sprint || 'Sprint 1'),
    Owner: String(r.Owner || r['Owner / Project Manager'] || r['Project Manager'] || r.Project_Manager || r.assignee || 'Unassigned'),
    Project_Manager: String(r.Project_Manager || r['Project Manager'] || r['Owner / Project Manager'] || r.Owner || 'Unassigned'),
    Department: String(r.Department || r.dept || 'Engineering'),
    Priority: String(r.Priority || r.priority || 'Medium'),
    Status: rawStatus,
    Estimated_Hours: cleanNumber(r['Estimated Hours'] ?? r.Estimated_Hours ?? r.estimated_hours, 0),
    Actual_Hours: cleanNumber(r['Actual Hours'] ?? r.Actual_Hours ?? r.actual_hours, 0),
    Allocated_Budget_USD: cleanNumber(r['Allocated Budget ($)'] ?? r.Allocated_Budget_USD ?? r.budget, 0),
    Actual_Spend_USD: cleanNumber(r['Actual Spend ($)'] ?? r.Actual_Spend_USD ?? r.spent, 0),
    Start_Date: String(r.Start_Date || r['Start Date'] || r.start_date || '2026-08-01'),
    Due_Date: String(r.Due_Date || r['Due Date'] || r.due_date || r.End_Date || '2026-10-01'),
    Risk_Level: String(r.Risk_Level || r['Risk Level'] || r.risk || 'Low'),
    Number_of_Team_Members: cleanNumber(r['Number of Team Members'] ?? r.Number_of_Team_Members ?? r.team_members, 1),
    Blocker_Details: String(r['Blocker Details'] ?? r.Blocker_Details ?? r.blocker ?? 'None'),
    Progress_Percent: progressPercent,
    'Progress (%)': progressPercent,
    Progress: progressPercent,
    progress: progressPercent,
  };
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
    path.join(cwd, 'Data set', '150-Project Portfolio (150 tasks).csv'),
    path.join(cwd, 'Data set', 'Projects.csv'),
  ];

  let resolvedPath: string | null = null;
  let rawContent: string | null = null;
  let resolvedFileName = 'Project Management Portfolio';

  for (const candidate of candidatePaths) {
    try {
      if (fs.existsSync(candidate)) {
        const content = fs.readFileSync(candidate, 'utf-8');
        // Skip obsolete legacy PRJ-101 dataset if present without deleting
        if (content.includes('PRJ-101')) {
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
        if (!content.includes('PRJ-101')) {
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

  // Compute analytical metrics using centralized source of truth
  const summary = calculateDatasetSummary(records);

  return {
    fileName: resolvedFileName,
    filePath: resolvedPath || 'In-Memory Portfolio',
    recordCount: records.length,
    columns,
    records,
    fileSizeBytes,
    summary,
  };
}
