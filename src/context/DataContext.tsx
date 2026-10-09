'use client';

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { ProjectTask } from '@/lib/dataset';
import { generatePortfolioData } from '@/lib/portfolioGenerator';
import {
  DatasetSummary,
  ActiveFilters,
  calculateDatasetSummary,
  filterDataset,
  calculateUnweightedAverageProgress,
  DataQualityAudit,
  ResourceAnalysis,
  auditDataQuality,
  analyzeResources,
} from '@/lib/analytics';

export type { DatasetSummary, ActiveFilters };
export { calculateDatasetSummary, filterDataset, calculateUnweightedAverageProgress };

interface DataContextType {
  dataset: ProjectTask[];
  rawDataset: ProjectTask[];
  filteredDataset: ProjectTask[];
  fileName: string;
  fileSize: number;
  summary: DatasetSummary;
  dataQuality: DataQualityAudit;
  resourceAnalysis: ResourceAnalysis;
  highlightIds: string[];
  setHighlightIds: (ids: string[]) => void;
  clearHighlights: () => void;
  toggleHighlightId: (id: string) => void;
  uploadDatasetFromContent: (content: string, fileName: string, fileSizeBytes?: number) => boolean;
  generateLiveData: () => Promise<boolean>;
  loadPortfolioData: (count?: number) => void;
  resetToDefault: () => void;
  refreshFromDatabase: () => Promise<void>;
  clearDataset: () => void;
  resetDashboard: () => void;
  isLoading: boolean;
  isGenerating: boolean;
  error: string | null;
  clearError: () => void;
  // Cross-filtering state & functions
  filters: ActiveFilters;
  activeDepartment: string | null;
  activeStatus: string | null;
  activeRiskLevel: string | null;
  activeProject: string | null;
  setActiveDepartment: (dept: string | null) => void;
  setActiveStatus: (status: string | null) => void;
  setActiveRiskLevel: (risk: string | null) => void;
  setActiveProject: (proj: string | null) => void;
  toggleFilter: (key: keyof ActiveFilters, value: string) => void;
  clearAllFilters: () => void;
  hasActiveFilters: boolean;
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
 * Safely extracts raw Progress field from arbitrary record object formats:
 * Checks 'Progress (%)', 'Progress %', 'Progress', 'progress', 'Progress_Percent',
 * and fuzzy-matches columns containing 'progress' or 'completion'.
 * Prioritizes raw CSV column headers over potentially stale Progress_Percent.
 */
export function extractRawProgress(r: any): any {
  if (!r || typeof r !== 'object') return undefined;

  // 1. Direct check of raw CSV column names
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

  // 2. Direct check of Progress_Percent if non-zero
  if (r.Progress_Percent !== undefined && r.Progress_Percent !== null && String(r.Progress_Percent).trim() !== '') {
    const num = Number(r.Progress_Percent);
    if (!isNaN(num) && num > 0) {
      return r.Progress_Percent;
    }
  }

  // 3. Normalized search over all keys (removing whitespace, brackets, %)
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

  // 4. Substring search for keys containing "progress" or "completion"
  for (const k of keys) {
    const lower = k.toLowerCase();
    if (lower.includes('progress') || lower.includes('completion')) {
      if (r[k] !== undefined && r[k] !== null && String(r[k]).trim() !== '') {
        return r[k];
      }
    }
  }

  // 5. Fallback to Progress_Percent if 0 or other value
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
        // Decimal fraction between 0 and 1 exclusive (e.g. 0.85 -> 85%)
        if (val > 0 && val < 1) {
          return Math.round(val * 100);
        }
        // If task is completed and value is 0 (artifact of previous 0 default), normalize to 100
        if (val === 0 && isCompleted) {
          return 100;
        }
        return Math.min(100, Math.max(0, Math.round(val)));
      }
    } else {
      const rawStr = String(val).trim();
      // Remove % sign and non-numeric characters except digits, minus, and period
      const stripped = rawStr.replace(/%/g, '').replace(/[^0-9.-]/g, '').trim();
      if (stripped !== '') {
        const parsed = Number(stripped);
        if (!isNaN(parsed)) {
          // Decimal fraction e.g. "0.85" without % sign
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

  const rawStatus = String(r.Status || r.status || 'In Progress');

  const projectManager = String(
    r['Project Manager'] ||
    r['Owner / Project Manager'] ||
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
    r['Team Members'] ??
    r.Team_Members ??
    r.Number_of_Team_Members ??
    r.Team_Members_Count ??
    r.team_members ??
    r.TeamMembers ??
    r.team_size ??
    r.teamMembersCount,
    3
  );

  const budget = cleanNumber(
    r['Allocated Budget ($)'] ??
    r['Allocated Budget'] ??
    r.Allocated_Budget_USD ??
    r.Budget ??
    r['Budget (USD)'] ??
    r.budget ??
    r.budget_allocated,
    0
  );

  const spend = cleanNumber(
    r['Actual Spend ($)'] ??
    r['Actual Spend'] ??
    r.Actual_Spend_USD ??
    r.Spent ??
    r['Spent (USD)'] ??
    r.spent ??
    r.spend ??
    r.budget_spent,
    0
  );

  const rawProgress = extractRawProgress(r);
  const progressPercent = cleanProgress(rawProgress, rawStatus);

  return {
    ...r,
    Task_ID: String(r.Task_ID || r['Task ID'] || r.id || r.taskId || `TASK-${String(idx + 1).padStart(3, '0')}`),
    Project_Name: String(r.Project_Name || r['Project Name'] || r.project || r.projectName || 'General Project'),
    Task_Title: String(r.Task_Title || r['Task Title'] || r.Task_Name || r['Task Name'] || r.title || r.task || `Task ${idx + 1}`),
    Sprint: String(r.Sprint || r.sprint || 'Sprint 1'),
    Owner: projectManager,
    Project_Manager: projectManager,
    'Project Manager': projectManager,
    'Owner / Project Manager': projectManager,
    Department: String(r.Department || r.department || r.dept || 'Engineering'),
    Priority: priority,
    Status: rawStatus,
    // Strictly typed numerical progress and metric fields
    Progress_Percent: progressPercent,
    'Progress (%)': progressPercent,
    Progress: progressPercent,
    progress: progressPercent,
    Estimated_Hours: cleanNumber(r['Estimated Hours'] ?? r.Estimated_Hours ?? r.estimated_hours, 0),
    Actual_Hours: cleanNumber(r['Actual Hours'] ?? r.Actual_Hours ?? r.actual_hours, 0),
    Allocated_Budget_USD: budget,
    Actual_Spend_USD: spend,
    Budget: budget,
    'Budget (USD)': budget,
    'Allocated Budget ($)': budget,
    Spent: spend,
    'Spent (USD)': spend,
    'Actual Spend ($)': spend,
    // Time-based fields (strings + JavaScript Date objects)
    Start_Date: formattedStart,
    Due_Date: formattedEnd,
    End_Date: formattedEnd,
    'Start Date': formattedStart,
    'End Date': formattedEnd,
    'Due Date': formattedEnd,
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
    'Team Members': teamMembers,
    Blocker_Details: String(r.Blocker_Details || r['Blocker Details'] || r.blocker || r.Blocked || 'None'),
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
  const [rawDataset, setRawDataset] = useState<ProjectTask[]>([]);
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState(0);
  const [highlightIds, setHighlightIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clearError = () => setError(null);

  // Cross-filtering active state
  const [filters, setFilters] = useState<ActiveFilters>({
    department: null,
    status: null,
    riskLevel: null,
    project: null,
  });

  const hasActiveFilters = Boolean(
    filters.department || filters.status || filters.riskLevel || filters.project
  );

  // Dynamic filtered dataset based on active cross-filters
  const filteredDataset = useMemo(() => {
    return filterDataset(rawDataset, filters);
  }, [rawDataset, filters]);

  // Helper to persist dataset into browser localStorage
  const persistDataset = (tasks: ProjectTask[], name: string) => {
    try {
      if (typeof window !== 'undefined') {
        if (tasks && tasks.length > 0) {
          localStorage.setItem('pm-insight-dataset', JSON.stringify(tasks));
          localStorage.setItem('pm-insight-dataset-name', name);
        } else {
          localStorage.removeItem('pm-insight-dataset');
          localStorage.removeItem('pm-insight-dataset-name');
        }
      }
    } catch (err) {
      console.warn('Failed to persist dataset to localStorage:', err);
    }
  };

  const refreshFromDatabase = async () => {
    setIsLoading(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch('/api/dataset', { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}: ${res.statusText}`);
      }
      const json = await res.json();
      if (json?.success && json?.data && Array.isArray(json.data.records) && json.data.records.length > 0) {
        const records = json.data.records.map((r: any, idx: number) => sanitizeTask(r, idx));
        const name = json.data.fileName || `Database Portfolio (${records.length} tasks)`;
        setRawDataset(records);
        setFileName(name);
        setFileSize(json.data.fileSizeBytes || records.length * 150);
        persistDataset(records, name);
        setError(null);
      } else {
        throw new Error(json?.error || 'Database returned zero records or invalid format.');
      }
    } catch (e: any) {
      clearTimeout(timeoutId);
      const isAbort = e.name === 'AbortError';
      const msg = isAbort
        ? 'Database query timed out after 8 seconds. Please check server status and retry.'
        : `Database sync error: ${e.message}`;
      console.warn('Failed to sync from database:', e);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial load logic: check localStorage for immediate render, then synchronize from persistent database
  useEffect(() => {
    setIsLoading(true);
    let hasLocal = false;
    try {
      if (typeof window !== 'undefined') {
        const savedData = localStorage.getItem('pm-insight-dataset');
        if (savedData) {
          const parsed = JSON.parse(savedData);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const sanitized = parsed.map((r: any, idx: number) => sanitizeTask(r, idx));
            setRawDataset(sanitized);
            const savedName =
              localStorage.getItem('pm-insight-dataset-name') ||
              `Saved Portfolio (${sanitized.length} tasks)`;
            setFileName(savedName);
            setFileSize(new Blob([savedData]).size);
            hasLocal = true;
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load dataset from localStorage:', e);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    // Always fetch latest authoritative data from server database to support multi-session persistence
    fetch('/api/dataset', { signal: controller.signal })
      .then(async (res) => {
        clearTimeout(timeoutId);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: Failed to reach database API`);
        }
        return res.json();
      })
      .then((json) => {
        if (json?.success && json?.data && Array.isArray(json.data.records)) {
          if (json.data.records.length > 0) {
            const records = json.data.records.map((r: any, idx: number) => sanitizeTask(r, idx));
            const name = json.data.fileName || `Database Portfolio (${records.length} tasks)`;
            setRawDataset(records);
            setFileName(name);
            setFileSize(json.data.fileSizeBytes || records.length * 150);
            persistDataset(records, name);
            setError(null);
          } else if (!hasLocal) {
            setRawDataset([]);
            setFileName('');
            setFileSize(0);
          }
        } else {
          throw new Error(json?.error || 'Invalid API response format');
        }
      })
      .catch((err) => {
        clearTimeout(timeoutId);
        const isAbort = err.name === 'AbortError';
        const msg = isAbort
          ? 'Database query timed out during initial load. Click "Retry Database Sync" to reconnect.'
          : (err.message || 'Failed to contact database API');
        console.warn('Could not contact /api/dataset on startup:', err);
        if (!hasLocal) {
          setError(msg);
        }
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const loadDefaultData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/dataset');
      const json = await res.json();
      if (json?.success && json?.data) {
        const records = (json.data.records || json.data.previewRecords || []).map((r: any, idx: number) =>
          sanitizeTask(r, idx)
        );
        const name = json.data.fileName || `Project Portfolio (${records.length} Tasks)`;
        setRawDataset(records);
        setFileName(name);
        setFileSize(json.data.fileSizeBytes || 0);
        setFilters({ department: null, status: null, riskLevel: null, project: null });
        setHighlightIds([]);
        persistDataset(records, name);
      }
    } catch (e) {
      console.error('Failed to load default dataset:', e);
    } finally {
      setIsLoading(false);
    }
  };

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
      setRawDataset(parsed);
      setFileName(uploadedName);
      const computedSize = uploadedSize || new Blob([content]).size;
      setFileSize(computedSize);
      setHighlightIds([]);
      setFilters({ department: null, status: null, riskLevel: null, project: null });
      persistDataset(parsed, uploadedName);

      // Asynchronously persist to SQLite database on the server
      fetch('/api/dataset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, fileName: uploadedName, mode: 'replace' }),
      }).catch((err) => console.warn('Background database persistence failed:', err));

      return true;
    } catch (err) {
      console.error('Upload parse error:', err);
      return false;
    }
  };

  /**
   * Generates a fresh, realistic AI dataset with 30 tasks from /api/generate-data
   * and auto-updates global state and localStorage.
   * Handles network suspension (net::ERR_NETWORK_IO_SUSPENDED) with retry and instant fallback.
   */
  const generateLiveData = async (): Promise<boolean> => {
    setIsGenerating(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const savedKey = typeof window !== 'undefined' ? localStorage.getItem('gemini_api_key_analyst') : null;
      if (savedKey) headers['x-gemini-api-key'] = savedKey;

      let json: any = null;

      // Resilient fetch attempt with 1 retry and AbortController timeout to gracefully handle suspended network I/O
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 6000);

          const res = await fetch('/api/generate-data', {
            method: 'POST',
            headers,
            signal: controller.signal,
            cache: 'no-store',
          });
          clearTimeout(timeoutId);

          if (res.ok) {
            json = await res.json();
            if (json?.success && Array.isArray(json?.data) && json.data.length > 0) {
              break;
            }
          }
        } catch (fetchErr) {
          // If socket suspended or network issue on first attempt, brief pause and retry once
          if (attempt === 0) {
            await new Promise((resolve) => setTimeout(resolve, 300));
          } else {
            console.warn('Network live generation unreachable (e.g. ERR_NETWORK_IO_SUSPENDED). Seamlessly switching to local generator:', fetchErr);
          }
        }
      }

      // If server returned valid data:
      if (json?.success && Array.isArray(json?.data) && json.data.length > 0) {
        const sanitized: ProjectTask[] = json.data.map((r: any, idx: number) =>
          sanitizeTask(r, idx)
        );

        const liveName = `AI Generated Live Data (${sanitized.length} tasks)`;
        setRawDataset(sanitized);
        setFileName(liveName);
        setFileSize(new Blob([JSON.stringify(sanitized)]).size);
        setHighlightIds([]);
        setFilters({ department: null, status: null, riskLevel: null, project: null });
        persistDataset(sanitized, liveName);
        return true;
      }

      // Safe, seamless client-side procedural fallback (30 tasks)
      const fallbackRaw = generatePortfolioData(30);
      const sanitized: ProjectTask[] = fallbackRaw.map((r, idx) => sanitizeTask(r, idx));
      const liveName = `Live Data (30 tasks - Instant Mode)`;
      setRawDataset(sanitized);
      setFileName(liveName);
      setFileSize(new Blob([JSON.stringify(sanitized)]).size);
      setHighlightIds([]);
      setFilters({ department: null, status: null, riskLevel: null, project: null });
      persistDataset(sanitized, liveName);
      return true;
    } catch (err) {
      console.warn('Error in generateLiveData, ensuring dataset is populated via fallback:', err);
      try {
        const fallbackRaw = generatePortfolioData(30);
        const sanitized: ProjectTask[] = fallbackRaw.map((r, idx) => sanitizeTask(r, idx));
        const liveName = `Live Data (30 tasks)`;
        setRawDataset(sanitized);
        setFileName(liveName);
        persistDataset(sanitized, liveName);
        return true;
      } catch {
        return false;
      }
    } finally {
      setIsGenerating(false);
    }
  };

  /**
   * Instantly generates and loads the deterministic project portfolio dataset (100 rows)
   * with specific PM edge cases:
   * - Exactly 10% Blocked & Critical with specific blocker strings (progress < 30%)
   * - ~15% Budget Overruns (Actual Spend exceeds Budget by 120%-150%)
   * - Schedule Slippage (Actual Hours significantly exceed Estimated Hours while In Progress)
   * - Resource Bottlenecks (Sarah Connor assigned 8-10 overlapping Critical tasks)
   * - Healthy Baseline (Completed, In Progress, Planned balance)
   */
  const loadPortfolioData = (count: number = 150) => {
    const rawGenerated = generatePortfolioData(count);
    const sanitized = rawGenerated.map((r, idx) => sanitizeTask(r, idx));
    const portfolioName = `${count}-Project Portfolio (${sanitized.length} tasks)`;
    setRawDataset(sanitized);
    setFileName(portfolioName);
    setFileSize(new Blob([JSON.stringify(sanitized)]).size);
    setHighlightIds([]);
    setFilters({ department: null, status: null, riskLevel: null, project: null });
    persistDataset(sanitized, portfolioName);
  };

  const resetToDefault = () => {
    setHighlightIds([]);
    setFilters({ department: null, status: null, riskLevel: null, project: null });
    loadDefaultData();
  };

  /**
   * Clears the dataset from localStorage and resets global state to null/empty,
   * returning the dashboard immediately to the empty upload screen.
   */
  const clearDataset = () => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('pm-insight-dataset');
        localStorage.removeItem('pm-insight-dataset-name');
      }
    } catch (err) {
      console.warn('Failed to clear localStorage:', err);
    }
    setRawDataset([]);
    setFileName('');
    setFileSize(0);
    setHighlightIds([]);
    clearAllFilters();
  };

  const resetDashboard = clearDataset;

  const clearHighlights = () => {
    setHighlightIds([]);
  };

  const toggleHighlightId = (id: string) => {
    setHighlightIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // Cross-filtering control functions
  const setActiveDepartment = (dept: string | null) => {
    setFilters((prev) => ({
      ...prev,
      department: dept && dept.trim() ? dept.trim() : null,
    }));
  };

  const setActiveStatus = (status: string | null) => {
    setFilters((prev) => ({
      ...prev,
      status: status && status.trim() ? status.trim() : null,
    }));
  };

  const setActiveRiskLevel = (risk: string | null) => {
    setFilters((prev) => ({
      ...prev,
      riskLevel: risk && risk.trim() ? risk.trim() : null,
    }));
  };

  const setActiveProject = (proj: string | null) => {
    setFilters((prev) => ({
      ...prev,
      project: proj && proj.trim() ? proj.trim() : null,
    }));
  };

  const toggleFilter = (key: keyof ActiveFilters, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: prev[key]?.toLowerCase() === value.toLowerCase() ? null : value,
    }));
  };

  const clearAllFilters = () => {
    setFilters({
      department: null,
      status: null,
      riskLevel: null,
      project: null,
    });
    setHighlightIds([]);
  };

  // Compute rich summary and aggregation for charts using single source of truth
  const summary: DatasetSummary = useMemo(() => {
    return calculateDatasetSummary(filteredDataset, highlightIds);
  }, [filteredDataset, highlightIds]);

  const dataQuality: DataQualityAudit = useMemo(() => {
    return auditDataQuality(filteredDataset);
  }, [filteredDataset]);

  const resourceAnalysis: ResourceAnalysis = useMemo(() => {
    return analyzeResources(filteredDataset);
  }, [filteredDataset]);

  return (
    <DataContext.Provider
      value={{
        dataset: filteredDataset,
        rawDataset,
        filteredDataset,
        fileName,
        fileSize,
        summary,
        dataQuality,
        resourceAnalysis,
        highlightIds,
        setHighlightIds,
        clearHighlights,
        toggleHighlightId,
        uploadDatasetFromContent,
        generateLiveData,
        loadPortfolioData,
        resetToDefault,
        refreshFromDatabase,
        clearDataset,
        resetDashboard,
        isLoading,
        isGenerating,
        error,
        clearError,
        filters,
        activeDepartment: filters.department,
        activeStatus: filters.status,
        activeRiskLevel: filters.riskLevel,
        activeProject: filters.project,
        setActiveDepartment,
        setActiveStatus,
        setActiveRiskLevel,
        setActiveProject,
        toggleFilter,
        clearAllFilters,
        hasActiveFilters,
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
