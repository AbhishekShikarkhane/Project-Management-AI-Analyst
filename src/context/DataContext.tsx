'use client';

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { ProjectTask } from '@/lib/dataset';
import { generatePortfolioData } from '@/lib/portfolioGenerator';

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

export interface ActiveFilters {
  department: string | null;
  status: string | null;
  riskLevel: string | null;
  project: string | null;
}

interface DataContextType {
  dataset: ProjectTask[];
  rawDataset: ProjectTask[];
  filteredDataset: ProjectTask[];
  fileName: string;
  fileSize: number;
  summary: DatasetSummary;
  highlightIds: string[];
  setHighlightIds: (ids: string[]) => void;
  clearHighlights: () => void;
  toggleHighlightId: (id: string) => void;
  uploadDatasetFromContent: (content: string, fileName: string, fileSizeBytes?: number) => boolean;
  generateLiveData: () => Promise<boolean>;
  loadPortfolioData: (count?: number) => void;
  resetToDefault: () => void;
  clearDataset: () => void;
  resetDashboard: () => void;
  isLoading: boolean;
  isGenerating: boolean;
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
    Task_ID: String(r.Task_ID || r.id || r.taskId || `TASK-${String(idx + 1).padStart(3, '0')}`),
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
  const [rawDataset, setRawDataset] = useState<ProjectTask[]>([]);
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState(0);
  const [highlightIds, setHighlightIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

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
    if (!hasActiveFilters) return rawDataset;
    return rawDataset.filter((task) => {
      if (filters.department) {
        if (String(task.Department || '').toLowerCase() !== filters.department.toLowerCase()) {
          return false;
        }
      }
      if (filters.status) {
        if (String(task.Status || '').toLowerCase() !== filters.status.toLowerCase()) {
          return false;
        }
      }
      if (filters.riskLevel) {
        if (String(task.Risk_Level || '').toLowerCase() !== filters.riskLevel.toLowerCase()) {
          return false;
        }
      }
      if (filters.project && filters.project.trim()) {
        const query = filters.project.toLowerCase().trim();
        if (!String(task.Project_Name || '').toLowerCase().includes(query)) {
          return false;
        }
      }
      return true;
    });
  }, [rawDataset, filters, hasActiveFilters]);

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

  // Initial load logic: check localStorage first so visual charts survive reloads
  useEffect(() => {
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
            setIsLoading(false);
            return;
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load dataset from localStorage:', e);
    }

    // If nothing saved in localStorage, start in clean empty state
    setRawDataset([]);
    setFileName('');
    setFileSize(0);
    setIsLoading(false);
  }, []);

  const loadDefaultData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/dataset');
      const json = await res.json();
      if (json?.success && json?.data) {
        const records = (json.data.previewRecords || []).map((r: any, idx: number) =>
          sanitizeTask(r, idx)
        );
        const name = json.data.fileName || 'Project Portfolio (100 Tasks)';
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

    for (const task of filteredDataset) {
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

    const avgProgress =
      filteredDataset.length > 0 ? Math.round(sumProgress / filteredDataset.length) : 0;

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
  }, [filteredDataset, highlightIds]);

  return (
    <DataContext.Provider
      value={{
        dataset: filteredDataset,
        rawDataset,
        filteredDataset,
        fileName,
        fileSize,
        summary,
        highlightIds,
        setHighlightIds,
        clearHighlights,
        toggleHighlightId,
        uploadDatasetFromContent,
        generateLiveData,
        loadPortfolioData,
        resetToDefault,
        clearDataset,
        resetDashboard,
        isLoading,
        isGenerating,
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
