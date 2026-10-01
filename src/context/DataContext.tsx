'use client';

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { ProjectTask } from '@/lib/dataset';

export interface DatasetSummary {
  totalBudget: number;
  totalSpend: number;
  avgProgress: number;
  blockedCount: number;
  inProgressCount: number;
  completedCount: number;
  criticalRiskCount: number;
  departments: string[];
  projects: string[];
  statusCounts: {
    status: string;
    count: number;
    spend: number;
    budget: number;
    percentage: number;
    hasHighlight?: boolean;
  }[];
  projectBudgets: {
    initiativeKey: string;
    displayName: string;
    project: string;
    department: string;
    budget: number;
    spend: number;
    remaining: number;
    variance: number;
    burnRate: number;
    taskCount: number;
    hasHighlight?: boolean;
  }[];
  departmentDistribution: { name: string; count: number; hasHighlight?: boolean }[];
}

interface DataContextType {
  dataset: ProjectTask[];
  fileName: string;
  fileSize: number;
  summary: DatasetSummary;
  highlightIds: string[];
  setHighlightIds: (ids: string[]) => void;
  clearHighlights: () => void;
  toggleHighlightId: (id: string) => void;
  uploadDatasetFromContent: (content: string, fileName: string, fileSizeBytes?: number) => boolean;
  generateLiveData: () => Promise<boolean>;
  resetToDefault: () => void;
  isLoading: boolean;
  isGenerating: boolean;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

/**
 * Robust numerical sanitizer:
 * Strips currency symbols ($), commas, percentage signs (%), and trailing labels
 * ensuring all financial and progress values are strictly typed as JavaScript Numbers.
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
 * Robust date sanitizer:
 * Converts various date string formats, epoch numbers, or ISO strings into valid JavaScript Date objects.
 * Returns null if invalid or unparseable.
 */
export function cleanDate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val;
  }
  if (typeof val === 'number') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  const str = String(val).trim();
  if (!str) return null;

  // 1. Direct standard parse
  const direct = new Date(str);
  if (!isNaN(direct.getTime())) {
    return direct;
  }

  // 2. Format: YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (ymdMatch) {
    const d = new Date(parseInt(ymdMatch[1], 10), parseInt(ymdMatch[2], 10) - 1, parseInt(ymdMatch[3], 10));
    if (!isNaN(d.getTime())) return d;
  }

  // 3. Format: MM/DD/YYYY or DD/MM/YYYY
  const mdyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (mdyMatch) {
    let d = new Date(parseInt(mdyMatch[3], 10), parseInt(mdyMatch[1], 10) - 1, parseInt(mdyMatch[2], 10));
    if (!isNaN(d.getTime())) return d;
  }

  return null;
}

/**
 * Formats a currency amount into clean compact notation ($550K, $1.2M, etc.)
 */
export function formatCompactCurrency(val: number): string {
  if (val === null || val === undefined || isNaN(val)) return '$0';
  const abs = Math.abs(val);
  const sign = val < 0 ? '-' : '';

  if (abs >= 1_000_000_000) {
    const formatted = (abs / 1_000_000_000).toFixed(1).replace(/\.0$/, '');
    return `${sign}$${formatted}B`;
  }
  if (abs >= 1_000_000) {
    const formatted = (abs / 1_000_000).toFixed(1).replace(/\.0$/, '');
    return `${sign}$${formatted}M`;
  }
  if (abs >= 1_000) {
    const formatted = (abs / 1_000).toFixed(1).replace(/\.0$/, '');
    return `${sign}$${formatted}K`;
  }
  return `${sign}$${abs.toLocaleString()}`;
}

/**
 * Standardized record sanitizer:
 * Strictly parses numbers, time-based fields (Start Date, End Date, Due Date),
 * and granular attributes (Project Manager, Priority, Risk Level, Number of Team Members)
 * into valid JavaScript Date objects and typed numbers stored within global state.
 */
export function sanitizeTask(r: any, idx: number = 0): ProjectTask {
  const rawStartDate =
    r.Start_Date ||
    r['Start Date'] ||
    r.start_date ||
    r.startDate ||
    r.Date ||
    r.date ||
    '2026-09-01';

  const rawEndDate =
    r.End_Date ||
    r['End Date'] ||
    r.Due_Date ||
    r['Due Date'] ||
    r.due_date ||
    r.dueDate ||
    r.end_date ||
    r.due ||
    '2026-10-15';

  const startDateObj = cleanDate(rawStartDate) || new Date('2026-09-01');
  const endDateObj = cleanDate(rawEndDate) || new Date('2026-10-15');

  const formattedStart =
    typeof rawStartDate === 'string' && rawStartDate.trim()
      ? rawStartDate.trim()
      : startDateObj.toISOString().split('T')[0];

  const formattedEnd =
    typeof rawEndDate === 'string' && rawEndDate.trim()
      ? rawEndDate.trim()
      : endDateObj.toISOString().split('T')[0];

  const projectManager = String(
    r['Project Manager'] ||
    r.Project_Manager ||
    r.Manager ||
    r.manager ||
    r.Owner ||
    r.owner ||
    r.assignee ||
    'Sarah Connor'
  );

  const priority = String(
    r.Priority ||
    r.priority ||
    'Medium'
  );

  const riskLevel = String(
    r['Risk Level'] ||
    r.Risk_Level ||
    r.risk_level ||
    r.Risk ||
    r.risk ||
    'Low'
  );

  const teamMembers = cleanNumber(
    r['Number of Team Members'] ??
    r.Number_of_Team_Members ??
    r.Team_Members_Count ??
    r.team_members ??
    r.TeamMembers ??
    r.team_size ??
    r.teamMembersCount,
    3
  );

  const budget = cleanNumber(
    r.Allocated_Budget_USD ?? r.Budget ?? r['Budget (USD)'] ?? r.budget ?? r.budget_allocated,
    25000
  );

  const spend = cleanNumber(
    r.Actual_Spend_USD ?? r.Spent ?? r['Spent (USD)'] ?? r.spent ?? r.spend ?? r.budget_spent,
    22000
  );

  return {
    ...r,
    Task_ID: String(r.Task_ID || r.id || r.taskId || `PRJ-${201 + idx}`),
    Project_Name: String(r.Project_Name || r.project || r.projectName || 'General Project'),
    Task_Title: String(r.Task_Title || r.title || r.task || `Task ${idx + 1}`),
    Sprint: String(r.Sprint || r.sprint || 'Sprint 1'),
    Owner: projectManager,
    Project_Manager: projectManager,
    'Project Manager': projectManager,
    Department: String(r.Department || r.department || r.dept || 'Engineering'),
    Priority: priority,
    Status: String(r.Status || r.status || 'In Progress'),
    // Strictly typed numbers
    Progress_Percent: cleanNumber(r.Progress_Percent ?? r.progress, 0),
    Estimated_Hours: cleanNumber(r.Estimated_Hours ?? r.estimated_hours, 40),
    Actual_Hours: cleanNumber(r.Actual_Hours ?? r.actual_hours, 35),
    Allocated_Budget_USD: budget,
    Actual_Spend_USD: spend,
    Budget: budget,
    'Budget (USD)': budget,
    Spent: spend,
    'Spent (USD)': spend,
    // Time-based fields (strings + JavaScript Date objects)
    Start_Date: formattedStart,
    Due_Date: formattedEnd,
    End_Date: formattedEnd,
    'Start Date': formattedStart,
    'End Date': formattedEnd,
    startDateObj,
    dueDateObj: endDateObj,
    endDateObj,
    Start_Date_Obj: startDateObj,
    Due_Date_Obj: endDateObj,
    End_Date_Obj: endDateObj,
    // Granular categorizations
    Risk_Level: riskLevel,
    'Risk Level': riskLevel,
    Number_of_Team_Members: teamMembers,
    Team_Members_Count: teamMembers,
    'Number of Team Members': teamMembers,
    Blocker_Details: String(r.Blocker_Details || r.blocker || 'None'),
  };
}

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

export function parseDataContent(rawContent: string): ProjectTask[] {
  const trimmed = rawContent.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      const records = Array.isArray(parsed)
        ? parsed
        : (parsed.data || parsed.tasks || parsed.records || parsed.projects || [parsed]);
      return records.map((r: any, idx: number) => sanitizeTask(r, idx));
    } catch {
      // Fall through to CSV
    }
  }

  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  const rawHeaders = parseCsvLine(lines[0], delimiter);
  const headers = rawHeaders.map((h) => h.replace(/^["']|["']$/g, '').trim());

  const tasks: ProjectTask[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i], delimiter);
    if (values.length === 0 || (values.length === 1 && !values[0])) continue;

    const rowObj: Record<string, any> = {};
    headers.forEach((h, colIdx) => {
      let val: any = values[colIdx] ?? '';
      val = typeof val === 'string' ? val.replace(/^["']|["']$/g, '').trim() : val;
      rowObj[h] = val;
    });

    tasks.push(sanitizeTask(rowObj, i));
  }

  return tasks;
}

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dataset, setDataset] = useState<ProjectTask[]>([]);
  const [fileName, setFileName] = useState('Project Management ');
  const [fileSize, setFileSize] = useState(0);
  const [highlightIds, setHighlightIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  // Initialize from default /api/dataset
  const loadDefaultData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/dataset');
      const json = await res.json();
      if (json?.success && json?.data) {
        const records = (json.data.previewRecords || []).map((r: any, idx: number) =>
          sanitizeTask(r, idx)
        );
        setDataset(records);
        setFileName(json.data.fileName || 'Project Management ');
        setFileSize(json.data.fileSizeBytes || 0);
      }
    } catch (e) {
      console.error('Failed to load default dataset:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDefaultData();
  }, []);

  const uploadDatasetFromContent = (
    content: string,
    uploadedName: string,
    uploadedSize?: number
  ): boolean => {
    try {
      const parsed = parseDataContent(content);
      if (parsed.length === 0) {
        return false;
      }
      setDataset(parsed);
      setFileName(uploadedName);
      setFileSize(uploadedSize || new Blob([content]).size);
      setHighlightIds([]); // Clear previous highlights on new data
      return true;
    } catch (err) {
      console.error('Upload parse error:', err);
      return false;
    }
  };

  /**
   * Generates a fresh, realistic AI dataset with 30 tasks from /api/generate-data
   * and auto-updates the global state.
   */
  const generateLiveData = async (): Promise<boolean> => {
    setIsGenerating(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const savedKey = localStorage.getItem('gemini_api_key_analyst');
      if (savedKey) headers['x-gemini-api-key'] = savedKey;

      const res = await fetch('/api/generate-data', {
        method: 'POST',
        headers,
      });

      const json = await res.json();
      if (json?.success && Array.isArray(json?.data) && json.data.length > 0) {
        const sanitized: ProjectTask[] = json.data.map((r: any, idx: number) =>
          sanitizeTask(r, idx)
        );

        setDataset(sanitized);
        setFileName(`AI Generated Live Data (${sanitized.length} tasks)`);
        setFileSize(new Blob([JSON.stringify(sanitized)]).size);
        setHighlightIds([]);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error generating live data:', err);
      return false;
    } finally {
      setIsGenerating(false);
    }
  };

  const resetToDefault = () => {
    setHighlightIds([]);
    loadDefaultData();
  };

  const clearHighlights = () => {
    setHighlightIds([]);
  };

  const toggleHighlightId = (id: string) => {
    setHighlightIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // Compute rich summary and aggregation for charts
  const summary: DatasetSummary = useMemo(() => {
    let totalBudget = 0;
    let totalSpend = 0;
    let sumProgress = 0;
    let blockedCount = 0;
    let inProgressCount = 0;
    let completedCount = 0;
    let criticalRiskCount = 0;

    const statusMap = new Map<
      string,
      { count: number; spend: number; budget: number; tasks: ProjectTask[] }
    >();
    const initiativeMap = new Map<
      string,
      {
        department: string;
        project: string;
        budget: number;
        spend: number;
        tasks: ProjectTask[];
      }
    >();
    const deptMap = new Map<string, { count: number; tasks: ProjectTask[] }>();

    for (const task of dataset) {
      const budget = cleanNumber(task.Allocated_Budget_USD, 0);
      const spend = cleanNumber(
        task.Actual_Spend_USD ?? task.Actual_Spend ?? task.Spent ?? task.spent,
        0
      );
      const progress = cleanNumber(task.Progress_Percent, 0);

      totalBudget += budget;
      totalSpend += spend;
      sumProgress += progress;

      const st = String(task.Status || 'Planned');
      const stLower = st.toLowerCase();
      if (stLower.includes('block') || stLower.includes('risk') || stLower.includes('delay')) {
        blockedCount++;
      } else if (stLower.includes('progress') || stLower.includes('track')) {
        inProgressCount++;
      } else if (stLower.includes('complete') || stLower.includes('done')) {
        completedCount++;
      }

      if (String(task.Risk_Level || '').toLowerCase().includes('critical')) {
        criticalRiskCount++;
      }

      // Status aggregation - sum of Spent (USD) and task count
      if (!statusMap.has(st)) {
        statusMap.set(st, { count: 0, spend: 0, budget: 0, tasks: [] });
      }
      const stEntry = statusMap.get(st)!;
      stEntry.count++;
      stEntry.spend += spend;
      stEntry.budget += budget;
      stEntry.tasks.push(task);

      // Department & Project Name initiative grouping
      const dept = String(task.Department || 'Engineering');
      const prj = String(task.Project_Name || 'General Project');
      const initiativeKey = `${dept} • ${prj}`;

      if (!initiativeMap.has(initiativeKey)) {
        initiativeMap.set(initiativeKey, {
          department: dept,
          project: prj,
          budget: 0,
          spend: 0,
          tasks: [],
        });
      }
      const initEntry = initiativeMap.get(initiativeKey)!;
      initEntry.budget += budget;
      initEntry.spend += spend;
      initEntry.tasks.push(task);

      // Dept aggregation
      if (!deptMap.has(dept)) {
        deptMap.set(dept, { count: 0, tasks: [] });
      }
      const deptEntry = deptMap.get(dept)!;
      deptEntry.count++;
      deptEntry.tasks.push(task);
    }

    const avgProgress = dataset.length > 0 ? Math.round(sumProgress / dataset.length) : 0;

    // Build chart datasets with cross-filter highlight flags and financial spend metrics
    const statusCounts = Array.from(statusMap.entries()).map(([status, val]) => ({
      status,
      count: val.count,
      spend: val.spend,
      budget: val.budget,
      percentage: totalSpend > 0 ? Math.round((val.spend / totalSpend) * 1000) / 10 : 0,
      hasHighlight:
        highlightIds.length > 0 &&
        val.tasks.some((t) => highlightIds.includes(t.Task_ID)),
    }));

    // Initiatives grouped by Department and Project Name
    const projectBudgets = Array.from(initiativeMap.entries()).map(([key, val]) => {
      const burnRate =
        val.budget > 0 ? Math.round((val.spend / val.budget) * 1000) / 10 : 0;
      const remaining = Math.max(0, val.budget - val.spend);
      const variance = val.budget - val.spend;

      return {
        initiativeKey: key,
        displayName: key,
        project: val.project,
        department: val.department,
        budget: val.budget,
        spend: val.spend,
        remaining,
        variance,
        burnRate,
        taskCount: val.tasks.length,
        hasHighlight:
          highlightIds.length > 0 &&
          val.tasks.some((t) => highlightIds.includes(t.Task_ID)),
      };
    });

    const departmentDistribution = Array.from(deptMap.entries()).map(([name, val]) => ({
      name,
      count: val.count,
      hasHighlight:
        highlightIds.length > 0 &&
        val.tasks.some((t) => highlightIds.includes(t.Task_ID)),
    }));

    return {
      totalBudget,
      totalSpend,
      avgProgress,
      blockedCount,
      inProgressCount,
      completedCount,
      criticalRiskCount,
      departments: Array.from(deptMap.keys()),
      projects: Array.from(
        new Set(Array.from(initiativeMap.values()).map((v) => v.project))
      ),
      statusCounts,
      projectBudgets,
      departmentDistribution,
    };
  }, [dataset, highlightIds]);

  return (
    <DataContext.Provider
      value={{
        dataset,
        fileName,
        fileSize,
        summary,
        highlightIds,
        setHighlightIds,
        clearHighlights,
        toggleHighlightId,
        uploadDatasetFromContent,
        generateLiveData,
        resetToDefault,
        isLoading,
        isGenerating,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export function useData(): DataContextType {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
