import fs from 'fs';
import path from 'path';

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
    // Windows Extended NT path for trailing space support
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
  let resolvedFileName = 'Project Management ';

  for (const candidate of candidatePaths) {
    try {
      if (fs.existsSync(candidate)) {
        rawContent = fs.readFileSync(candidate, 'utf-8');
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
        resolvedPath = path.join(cwd, match);
        resolvedFileName = match;
        rawContent = fs.readFileSync(resolvedPath, 'utf-8');
      }
    } catch {
      // Fallback
    }
  }

  // If file genuinely doesn't exist, generate default data into "Project Management "
  if (!resolvedPath || rawContent === null) {
    const defaultData = [
      'Task_ID,Project_Name,Task_Title,Sprint,Owner,Department,Priority,Status,Progress_Percent,Estimated_Hours,Actual_Hours,Allocated_Budget_USD,Actual_Spend_USD,Start_Date,Due_Date,Risk_Level,Blocker_Details',
      'PRJ-101,Nexus Cloud Core,Microservices Architecture Refactoring,Sprint 21,Sarah Connor,Backend Architecture,Critical,Completed,100,120,115,25000,24200,2026-08-01,2026-08-25,Low,None',
      'PRJ-102,Nexus Cloud Core,Distributed Caching & Redis Cluster,Sprint 22,David Kim,Backend Architecture,High,In Progress,75,90,82,18000,16500,2026-08-26,2026-09-30,Medium,Minor cache stampede during stress testing',
      'PRJ-103,Nexus Cloud Core,Zero-Downtime Database Migration,Sprint 22,Sarah Connor,Backend Architecture,Critical,Blocked,45,140,90,32000,28000,2026-09-01,2026-10-10,Critical,Awaiting read-replica sync authorization from Infosec',
      'PRJ-104,FinTech Payment Hub,PCI DSS v4.0 Compliance Audit,Sprint 20,Marcus Brody,DevSecOps,Critical,Completed,100,80,78,22000,21500,2026-08-05,2026-08-30,Low,None',
      'PRJ-105,FinTech Payment Hub,Stripe & Adyen Multi-Gateway Router,Sprint 21,Alex Rivera,Frontend Engineering,High,In Progress,60,110,85,24000,20500,2026-09-05,2026-10-15,Medium,Webhook retry mechanism edge cases under review',
      'PRJ-106,FinTech Payment Hub,Fraud Detection Threshold Tuning,Sprint 22,Priya Sharma,Data Science,Critical,In Progress,85,100,92,28000,26000,2026-08-15,2026-09-28,High,False positive rate spike on high-velocity transactions',
      'PRJ-107,AI Predictive Engine,Customer Churn Prediction Model v2,Sprint 21,Priya Sharma,Data Science,High,Completed,100,150,140,35000,33500,2026-07-20,2026-08-31,Low,None',
      'PRJ-108,AI Predictive Engine,Real-Time Inference Pipeline (FastAPI/ONNX),Sprint 22,David Kim,Data Science,Critical,In Progress,50,130,80,30000,22000,2026-09-10,2026-10-20,High,GPU node latency variance in staging environment',
      'PRJ-109,AI Predictive Engine,Automated Feature Store Ingestion,Sprint 22,Priya Sharma,Data Science,Medium,In Review,90,70,68,16000,15200,2026-09-01,2026-09-25,Low,Pending code review approval from team lead',
      'PRJ-110,CyberSec Zero-Trust,Identity Federation & SAML SSO,Sprint 21,Marcus Brody,DevSecOps,Critical,Completed,100,95,90,26000,25000,2026-08-10,2026-09-05,Low,None',
      'PRJ-111,CyberSec Zero-Trust,Automated Vulnerability Scanner CI/CD,Sprint 22,Marcus Brody,DevSecOps,High,In Progress,70,85,60,19000,14500,2026-09-05,2026-10-05,Medium,Rate limiting on third-party security vulnerability DB',
      'PRJ-112,CyberSec Zero-Trust,mTLS Service-to-Service Encryption,Sprint 23,Sarah Connor,Backend Architecture,Critical,Planned,0,110,0,27000,0,2026-10-01,2026-11-15,High,Prerequisite PRJ-103 migration must finish first',
      'PRJ-113,FinTech Payment Hub,Automated Reconciliation Reporting,Sprint 22,Alex Rivera,Quality Assurance,Medium,In Progress,80,65,55,14000,12000,2026-09-08,2026-10-02,Low,None',
      'PRJ-114,Nexus Cloud Core,Multi-Region Failover Drills,Sprint 23,David Kim,DevSecOps,Critical,Planned,10,120,15,30000,4000,2026-10-05,2026-11-20,High,Simulated network partition test cases required',
      'PRJ-115,Customer Portal Overhaul,Next.js 15 Migration & Design System,Sprint 21,Alex Rivera,Frontend Engineering,High,Completed,100,130,125,29000,28500,2026-08-01,2026-09-12,Low,None',
      'PRJ-116,Customer Portal Overhaul,Real-Time Project Health Dashboard,Sprint 22,Alex Rivera,Frontend Engineering,High,In Progress,65,95,70,21000,16800,2026-09-12,2026-10-18,Medium,WebSocket reconnection telemetry stabilization',
      'PRJ-117,Customer Portal Overhaul,Role-Based Access Control UI,Sprint 22,Sarah Connor,Frontend Engineering,Medium,In Review,95,60,58,15000,14200,2026-09-10,2026-09-29,Low,Final UX sign-off pending from Product Manager',
      'PRJ-118,AI Predictive Engine,Synthetic Data Generator for Privacy Compliance,Sprint 23,Priya Sharma,Data Science,High,Planned,0,90,0,22000,0,2026-10-10,2026-11-25,Medium,Awaiting legal guidelines on differential privacy epsilon values',
    ].join('\n');

    const targetFile = path.join(cwd, 'Project Management ');
    try {
      fs.writeFileSync(targetFile, defaultData, 'utf-8');
      resolvedPath = targetFile;
      rawContent = defaultData;
      resolvedFileName = 'Project Management ';
    } catch {
      resolvedPath = path.join(cwd, 'Project Management');
      fs.writeFileSync(resolvedPath, defaultData, 'utf-8');
      rawContent = defaultData;
      resolvedFileName = 'Project Management';
    }
  }

  const { records, columns } = parseContentToJSON(rawContent);

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
  const fileSizeBytes = Buffer.byteLength(rawContent, 'utf-8');

  return {
    fileName: resolvedFileName,
    filePath: resolvedPath || 'Project Management ',
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
