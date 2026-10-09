import { ProjectTask } from './dataset';

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
    avgProgress: number;
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
    avgProgress: number;
    hasHighlight?: boolean;
  }[];
  departmentDistribution: {
    name: string;
    count: number;
    spend?: number;
    budget?: number;
    avgProgress?: number;
    hasHighlight?: boolean;
  }[];
}

export interface ActiveFilters {
  department: string | null;
  status: string | null;
  riskLevel: string | null;
  project: string | null;
}

/**
 * Validates whether a value is a valid progress percentage (0 - 100 inclusive).
 * Returns true if valid number, false otherwise.
 */
export function isValidProgress(val: any): boolean {
  if (val === null || val === undefined || val === '') return false;
  const num = typeof val === 'number' ? val : Number(String(val).replace(/[^0-9.-]/g, ''));
  return !isNaN(num) && num >= 0 && num <= 100;
}

/**
 * Normalizes progress value strictly within 0 - 100 range.
 * If value is invalid, returns fallback.
 */
export function normalizeProgress(val: any, fallback: number = 0): number {
  if (val === null || val === undefined || val === '') return fallback;
  if (typeof val === 'number') {
    if (isNaN(val)) return fallback;
    if (val > 0 && val < 1) return Math.round(val * 100);
    return Math.min(100, Math.max(0, Math.round(val)));
  }
  const str = String(val).trim();
  const stripped = str.replace(/%/g, '').replace(/[^0-9.-]/g, '').trim();
  if (!stripped) return fallback;
  const parsed = Number(stripped);
  if (isNaN(parsed)) return fallback;
  if (parsed > 0 && parsed < 1 && str.includes('.') && !str.includes('%')) {
    return Math.round(parsed * 100);
  }
  return Math.min(100, Math.max(0, Math.round(parsed)));
}

/**
 * Unweighted Average Progress:
 * Average Progress = Sum of valid task progress percentages / Number of tasks with valid progress values.
 * Tasks with null/unparseable values are excluded from the denominator unless they are explicitly 0.
 */
export function calculateUnweightedAverageProgress(tasks: ProjectTask[]): number {
  if (!tasks || tasks.length === 0) return 0;

  let sum = 0;
  let validCount = 0;

  for (const t of tasks) {
    const rawVal = t.Progress_Percent ?? t['Progress (%)'] ?? t.Progress ?? t.progress;
    if (isValidProgress(rawVal)) {
      sum += normalizeProgress(rawVal);
      validCount++;
    }
  }

  if (validCount === 0) return 0;
  return Math.round(sum / validCount);
}

/**
 * Filters dataset based on active cross-filter dimensions
 */
export function filterDataset(
  tasks: ProjectTask[],
  filters: Partial<ActiveFilters> = {}
): ProjectTask[] {
  if (!tasks || tasks.length === 0) return [];
  const { department, status, riskLevel, project } = filters;

  return tasks.filter((task) => {
    if (
      department &&
      String(task.Department || '').trim().toLowerCase() !== department.trim().toLowerCase()
    ) {
      return false;
    }
    if (
      status &&
      String(task.Status || '').trim().toLowerCase() !== status.trim().toLowerCase()
    ) {
      return false;
    }
    if (
      riskLevel &&
      String(task.Risk_Level || '').trim().toLowerCase() !== riskLevel.trim().toLowerCase()
    ) {
      return false;
    }
    if (
      project &&
      String(task.Project_Name || '').trim().toLowerCase() !== project.trim().toLowerCase()
    ) {
      return false;
    }
    return true;
  });
}

/**
 * Authoritative Single Source of Truth for Dataset Summary & Visual Charts Metrics
 */
export function calculateDatasetSummary(
  tasks: ProjectTask[],
  highlightIds: string[] = []
): DatasetSummary {
  if (!tasks || tasks.length === 0) {
    return {
      totalBudget: 0,
      totalSpend: 0,
      avgProgress: 0,
      blockedCount: 0,
      inProgressCount: 0,
      completedCount: 0,
      criticalRiskCount: 0,
      departments: [],
      projects: [],
      statusCounts: [],
      projectBudgets: [],
      departmentDistribution: [],
    };
  }

  let totalBudget = 0;
  let totalSpend = 0;
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
  const deptMap = new Map<
    string,
    { count: number; spend: number; budget: number; tasks: ProjectTask[] }
  >();

  for (const task of tasks) {
    const budget = Number(task.Allocated_Budget_USD || task.Budget || 0);
    const spend = Number(task.Actual_Spend_USD || task.Spent || 0);

    totalBudget += budget;
    totalSpend += spend;

    const st = String(task.Status || 'Planned').trim();
    const stLower = st.toLowerCase();
    if (stLower.includes('block') || stLower.includes('delay') || stLower.includes('hold')) {
      blockedCount++;
    } else if (stLower.includes('progress') || stLower.includes('active') || stLower.includes('track')) {
      inProgressCount++;
    } else if (stLower.includes('complete') || stLower.includes('done')) {
      completedCount++;
    }

    if (String(task.Risk_Level || '').toLowerCase().includes('critical')) {
      criticalRiskCount++;
    }

    // Status aggregation
    if (!statusMap.has(st)) {
      statusMap.set(st, { count: 0, spend: 0, budget: 0, tasks: [] });
    }
    const stEntry = statusMap.get(st)!;
    stEntry.count++;
    stEntry.spend += spend;
    stEntry.budget += budget;
    stEntry.tasks.push(task);

    // Department & Project Name initiative grouping
    const dept = String(task.Department || 'Engineering').trim();
    const prj = String(task.Project_Name || 'General Project').trim();
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
      deptMap.set(dept, { count: 0, spend: 0, budget: 0, tasks: [] });
    }
    const deptEntry = deptMap.get(dept)!;
    deptEntry.count++;
    deptEntry.spend += spend;
    deptEntry.budget += budget;
    deptEntry.tasks.push(task);
  }

  const avgProgress = calculateUnweightedAverageProgress(tasks);

  // Status counts dataset
  const statusCounts = Array.from(statusMap.entries()).map(([status, val]) => {
    const avgProg = calculateUnweightedAverageProgress(val.tasks);
    return {
      status,
      count: val.count,
      spend: val.spend,
      budget: val.budget,
      avgProgress: avgProg,
      percentage: totalSpend > 0 ? Math.round((val.spend / totalSpend) * 1000) / 10 : 0,
      hasHighlight:
        highlightIds.length > 0 && val.tasks.some((t) => highlightIds.includes(t.Task_ID)),
    };
  });

  // Project budgets dataset
  const projectBudgets = Array.from(initiativeMap.entries()).map(([key, val]) => {
    const burnRate = val.budget > 0 ? Math.round((val.spend / val.budget) * 1000) / 10 : 0;
    const remaining = Math.max(0, val.budget - val.spend);
    const variance = val.budget - val.spend;
    const avgProg = calculateUnweightedAverageProgress(val.tasks);

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
      avgProgress: avgProg,
      hasHighlight:
        highlightIds.length > 0 && val.tasks.some((t) => highlightIds.includes(t.Task_ID)),
    };
  });

  // Department distribution dataset
  const departmentDistribution = Array.from(deptMap.entries()).map(([name, val]) => ({
    name,
    count: val.count,
    spend: val.spend,
    budget: val.budget,
    avgProgress: calculateUnweightedAverageProgress(val.tasks),
    hasHighlight:
      highlightIds.length > 0 && val.tasks.some((t) => highlightIds.includes(t.Task_ID)),
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
    projects: Array.from(new Set(Array.from(initiativeMap.values()).map((v) => v.project))),
    statusCounts,
    projectBudgets,
    departmentDistribution,
  };
}

export interface ProjectVarianceReport {
  project: string;
  budget: number;
  spend: number;
  variance: number; // budget - spend (positive = under budget, negative = over budget)
  isOverBudget: boolean; // spend > budget
  overAmount: number; // Math.max(0, spend - budget)
  overPercentage: number | null; // ((spend - budget) / budget) * 100, or null if budget === 0
  taskCount: number;
}

export interface TaskVarianceReport {
  taskId: string;
  project: string;
  title: string;
  budget: number;
  spend: number;
  variance: number; // budget - spend
  isOverBudget: boolean; // spend > budget
  overAmount: number; // Math.max(0, spend - budget)
  overPercentage: number | null; // ((spend - budget) / budget) * 100, or null if budget === 0
}

export interface BudgetVarianceAnalysis {
  portfolio: {
    totalBudget: number;
    totalSpend: number;
    netVariance: number; // totalBudget - totalSpend (positive = under budget, negative = over budget)
    isUnderBudget: boolean;
    overAmount: number;
    variancePercentage: number | null;
    status: 'under_budget' | 'over_budget' | 'on_budget';
  };
  projects: ProjectVarianceReport[];
  overBudgetProjects: ProjectVarianceReport[];
  tasks: TaskVarianceReport[];
  overBudgetTasks: TaskVarianceReport[];
}

/**
 * Authoritative, deterministic Budget Variance Analyzer
 * Budget Variance = Allocated Budget - Actual Spend
 * Positive: Under budget | Negative: Over budget | Zero: On budget
 * Evaluates variance at both the aggregate project level and individual task level.
 */
export function analyzeBudgetVariance(tasks: ProjectTask[]): BudgetVarianceAnalysis {
  if (!tasks || tasks.length === 0) {
    return {
      portfolio: {
        totalBudget: 0,
        totalSpend: 0,
        netVariance: 0,
        isUnderBudget: true,
        overAmount: 0,
        variancePercentage: 0,
        status: 'on_budget',
      },
      projects: [],
      overBudgetProjects: [],
      tasks: [],
      overBudgetTasks: [],
    };
  }

  let totalBudget = 0;
  let totalSpend = 0;
  const projectMap = new Map<string, { budget: number; spend: number; count: number }>();
  const allTasks: TaskVarianceReport[] = [];
  const overBudgetTasks: TaskVarianceReport[] = [];

  for (const t of tasks) {
    const budget = Number(t.Allocated_Budget_USD || t.Budget || 0);
    const spend = Number(t.Actual_Spend_USD || t.Spent || 0);
    const variance = budget - spend;
    const isOver = spend > budget;
    const overAmount = isOver ? spend - budget : 0;
    const overPercentage =
      isOver && budget > 0 ? Math.round(((spend - budget) / budget) * 1000) / 10 : null;
    const prjName = String(t.Project_Name || 'General Project').trim();

    totalBudget += budget;
    totalSpend += spend;

    if (!projectMap.has(prjName)) {
      projectMap.set(prjName, { budget: 0, spend: 0, count: 0 });
    }
    const pe = projectMap.get(prjName)!;
    pe.budget += budget;
    pe.spend += spend;
    pe.count++;

    const taskReport: TaskVarianceReport = {
      taskId: t.Task_ID,
      project: prjName,
      title: t.Task_Title,
      budget,
      spend,
      variance,
      isOverBudget: isOver,
      overAmount,
      overPercentage,
    };
    allTasks.push(taskReport);
    if (isOver) {
      overBudgetTasks.push(taskReport);
    }
  }

  // Sort overBudgetTasks descending by dollar overrun
  overBudgetTasks.sort((a, b) => b.overAmount - a.overAmount);

  const projects: ProjectVarianceReport[] = [];
  const overBudgetProjects: ProjectVarianceReport[] = [];

  for (const [project, data] of projectMap.entries()) {
    const variance = data.budget - data.spend;
    const isOver = data.spend > data.budget;
    const overAmount = isOver ? data.spend - data.budget : 0;
    const overPercentage =
      isOver && data.budget > 0
        ? Math.round(((data.spend - data.budget) / data.budget) * 1000) / 10
        : null;

    const prjReport: ProjectVarianceReport = {
      project,
      budget: data.budget,
      spend: data.spend,
      variance,
      isOverBudget: isOver,
      overAmount,
      overPercentage,
      taskCount: data.count,
    };
    projects.push(prjReport);
    if (isOver) {
      overBudgetProjects.push(prjReport);
    }
  }

  // Sort overBudgetProjects descending by dollar overrun
  overBudgetProjects.sort((a, b) => b.overAmount - a.overAmount);

  const netVariance = totalBudget - totalSpend;
  const isUnderBudget = netVariance >= 0;
  const variancePercentage =
    totalBudget > 0 ? Math.round((Math.abs(netVariance) / totalBudget) * 1000) / 10 : 0;
  const status =
    netVariance > 0 ? 'under_budget' : netVariance < 0 ? 'over_budget' : 'on_budget';

  return {
    portfolio: {
      totalBudget,
      totalSpend,
      netVariance,
      isUnderBudget,
      overAmount: Math.max(0, totalSpend - totalBudget),
      variancePercentage,
      status,
    },
    projects,
    overBudgetProjects,
    tasks: allTasks,
    overBudgetTasks,
  };
}

/**
 * Identifies tasks exceeding allocated budget
 */
export function getOverBudgetTasks(tasks: ProjectTask[]): ProjectTask[] {
  return tasks.filter((t) => {
    const budget = Number(t.Allocated_Budget_USD || t.Budget || 0);
    const spend = Number(t.Actual_Spend_USD || t.Spent || 0);
    return spend > budget;
  });
}

/**
 * Identifies tasks that are blocked
 */
export function getBlockedTasks(tasks: ProjectTask[]): ProjectTask[] {
  return tasks.filter((t) => {
    const st = String(t.Status || '').toLowerCase();
    return st.includes('block') || st.includes('hold');
  });
}

/**
 * Deterministically analyzes incoming questions and returns verified facts & figures
 * so the AI model grounds responses with mathematically exact numbers matching the dashboard.
 */
export function extractDeterministicFacts(question: string, tasks: ProjectTask[]): {
  summary: DatasetSummary;
  varianceAnalysis: BudgetVarianceAnalysis;
  matchedEntityName?: string;
  matchedEntityType?: 'department' | 'project' | 'status';
  relevantTasks: ProjectTask[];
  contextFacts: string[];
} {
  const summary = calculateDatasetSummary(tasks);
  const varianceAnalysis = analyzeBudgetVariance(tasks);
  const qLower = question.toLowerCase();

  const contextFacts: string[] = [
    `Total Dataset Tasks: ${tasks.length}`,
    `Total Allocated Budget: $${summary.totalBudget.toLocaleString()}`,
    `Total Actual Spend: $${summary.totalSpend.toLocaleString()}`,
    `Net Budget Variance: $${Math.abs(varianceAnalysis.portfolio.netVariance).toLocaleString()} ${varianceAnalysis.portfolio.isUnderBudget ? 'under budget (surplus)' : 'over budget (overrun)'}`,
    `Unweighted Average Progress: ${summary.avgProgress}%`,
    `Blocked Tasks Count: ${summary.blockedCount}`,
    `In Progress Tasks Count: ${summary.inProgressCount}`,
    `Completed Tasks Count: ${summary.completedCount}`,
  ];

  let relevantTasks: ProjectTask[] = [];
  let matchedEntityName: string | undefined;
  let matchedEntityType: 'department' | 'project' | 'status' | undefined;

  // Specific query types: Variance / Over Budget analysis across all projects & tasks
  if (
    qLower.includes('variance') ||
    qLower.includes('over budget') ||
    qLower.includes('overrun') ||
    qLower.includes('exceed') ||
    qLower.includes('exceeding')
  ) {
    contextFacts.push(
      `--- BUDGET VARIANCE AUDIT FINDINGS ---`,
      `Portfolio Overall Status: $${Math.abs(varianceAnalysis.portfolio.netVariance).toLocaleString()} ${varianceAnalysis.portfolio.isUnderBudget ? 'Under Budget' : 'Over Budget'} across all ${tasks.length} tasks.`,
      `CRITICAL RULE: An overall portfolio surplus does not mean every individual project is under budget.`
    );

    if (varianceAnalysis.overBudgetProjects.length > 0) {
      contextFacts.push(
        `Over-Budget Projects (${varianceAnalysis.overBudgetProjects.length} projects exceeding allocation): ` +
          varianceAnalysis.overBudgetProjects
            .map(
              (p) =>
                `"${p.project}" (Allocated Budget: $${p.budget.toLocaleString()}, Actual Spend: $${p.spend.toLocaleString()}, Overrun: $${p.overAmount.toLocaleString()} / +${p.overPercentage}%)`
            )
            .join('; ')
      );
    } else {
      contextFacts.push(`Over-Budget Projects: 0 projects exceed their allocated budget at the aggregate project level.`);
    }

    if (varianceAnalysis.overBudgetTasks.length > 0) {
      contextFacts.push(
        `Over-Budget Tasks (${varianceAnalysis.overBudgetTasks.length} tasks exceeding allocation): Top overruns: ` +
          varianceAnalysis.overBudgetTasks
            .slice(0, 10)
            .map(
              (t) =>
                `[${t.taskId}] "${t.title}" in ${t.project} (Budget: $${t.budget.toLocaleString()}, Spend: $${t.spend.toLocaleString()}, Overrun: $${t.overAmount.toLocaleString()}${t.overPercentage !== null ? ` / +${t.overPercentage}%` : ''})`
            )
            .join('; ')
      );
    } else {
      contextFacts.push(`Over-Budget Tasks: 0 tasks exceed their allocated budget.`);
    }

    // Set relevant tasks to all tasks in over-budget projects plus all over-budget tasks
    const relevantIds = new Set<string>();
    varianceAnalysis.overBudgetTasks.forEach((t) => relevantIds.add(t.taskId));
    tasks.forEach((t) => {
      if (varianceAnalysis.overBudgetProjects.some((p) => p.project === t.Project_Name)) {
        relevantIds.add(t.Task_ID);
      }
    });
    relevantTasks = tasks.filter((t) => relevantIds.has(t.Task_ID));
  }

  // Check if query is targeting a specific status
  if (relevantTasks.length === 0) {
    for (const s of summary.statusCounts) {
      if (qLower.includes(s.status.toLowerCase())) {
        matchedEntityName = s.status;
        matchedEntityType = 'status';
        relevantTasks = tasks.filter(
          (t) => String(t.Status || '').toLowerCase() === s.status.toLowerCase()
        );
        contextFacts.push(
          `Filter Target [Status: ${s.status}]: ${s.count} tasks, Budget: $${s.budget.toLocaleString()}, Spend: $${s.spend.toLocaleString()}, Avg Progress: ${s.avgProgress}%`
        );
        break;
      }
    }
  }

  // Check if query is targeting a specific department
  if (!matchedEntityName && relevantTasks.length === 0) {
    for (const d of summary.departments) {
      if (qLower.includes(d.toLowerCase())) {
        matchedEntityName = d;
        matchedEntityType = 'department';
        relevantTasks = tasks.filter(
          (t) => String(t.Department || '').toLowerCase() === d.toLowerCase()
        );
        const deptInfo = summary.departmentDistribution.find((x) => x.name === d);
        if (deptInfo) {
          contextFacts.push(
            `Filter Target [Department: ${d}]: ${deptInfo.count} tasks, Budget: $${(deptInfo.budget || 0).toLocaleString()}, Spend: $${(deptInfo.spend || 0).toLocaleString()}, Avg Progress: ${deptInfo.avgProgress || 0}%`
          );
        }
        break;
      }
    }
  }

  // Check if query is targeting a specific project
  if (!matchedEntityName && relevantTasks.length === 0) {
    for (const p of summary.projects) {
      if (qLower.includes(p.toLowerCase())) {
        matchedEntityName = p;
        matchedEntityType = 'project';
        relevantTasks = tasks.filter(
          (t) => String(t.Project_Name || '').toLowerCase() === p.toLowerCase()
        );
        const prjSummary = calculateDatasetSummary(relevantTasks);
        contextFacts.push(
          `Filter Target [Project: ${p}]: ${relevantTasks.length} tasks, Budget: $${prjSummary.totalBudget.toLocaleString()}, Spend: $${prjSummary.totalSpend.toLocaleString()}, Avg Progress: ${prjSummary.avgProgress}%`
        );
        break;
      }
    }
  }

  // Specific query types: Blocked
  if (qLower.includes('block') || qLower.includes('impediment')) {
    const blocked = getBlockedTasks(tasks);
    contextFacts.push(
      `Blocked Tasks: ${blocked.length} tasks are currently marked as Blocked.`
    );
    if (relevantTasks.length === 0) relevantTasks = blocked;
  }

  // Fallback to all tasks if no specific filter
  if (relevantTasks.length === 0) {
    relevantTasks = tasks;
  }

  return {
    summary,
    varianceAnalysis,
    matchedEntityName,
    matchedEntityType,
    relevantTasks,
    contextFacts,
  };
}

// ============================================================================
// PHASE 2: ADVANCED DETERMINISTIC ANALYTICS MODULES
// ============================================================================

export interface PortfolioAdvancedMetrics {
  totalProjects: number;
  totalTasks: number;
  allocatedBudget: number;
  actualSpend: number;
  netVariance: number;
  isUnderBudget: boolean;
  variancePercentage: number | null;
  avgProgress: number;
  blockedTasksCount: number;
  overdueTasksCount: number;
  overBudgetProjectsCount: number;
  overBudgetTasksCount: number;
}

export interface ScheduleAnalysis {
  asOfDate: string;
  totalTasksEvaluated: number;
  overdueTasks: ProjectTask[];
  overdueCount: number;
  approachingDeadlineTasks: ProjectTask[];
  approachingCount: number;
  behindScheduleTasks: {
    task: ProjectTask;
    expectedProgress: number;
    actualProgress: number;
    delayGapPercent: number;
  }[];
  behindScheduleCount: number;
  completedTasksCount: number;
  completionRatePercent: number;
  projectScheduleSummaries: {
    projectName: string;
    totalTasks: number;
    completedTasks: number;
    overdueTasks: number;
    avgProgress: number;
    status: 'on_track' | 'at_risk' | 'delayed';
  }[];
}

export interface OwnerWorkload {
  owner: string;
  taskCount: number;
  totalBudget: number;
  totalSpend: number;
  avgProgress: number;
  blockedCount: number;
  shareOfPortfolioPercent: number;
}

export interface DepartmentWorkload {
  department: string;
  taskCount: number;
  totalBudget: number;
  totalSpend: number;
  avgProgress: number;
  blockedCount: number;
  shareOfPortfolioPercent: number;
}

export interface ResourceAnalysis {
  totalOwners: number;
  totalDepartments: number;
  ownerWorkloads: OwnerWorkload[];
  departmentWorkloads: DepartmentWorkload[];
  blockedWorkloadByDepartment: {
    department: string;
    blockedTasks: number;
    blockedSpend: number;
  }[];
  workloadConcentration: {
    top3OwnerSharePercent: number;
    top3DepartmentSharePercent: number;
    ownerHHI: number; // Herfindahl-Hirschman Index (0 - 10,000)
    isConcentrated: boolean;
  };
  imbalanceIndicators: string[];
  capacityDisclaimer: string;
}

export interface DataQualityIssue {
  taskId: string;
  projectName: string;
  field: string;
  issueDescription: string;
  severity: 'low' | 'medium' | 'high';
}

export interface DataQualityAudit {
  totalRecordsChecked: number;
  missingDatesCount: number;
  invalidProgressCount: number;
  missingBudgetCount: number;
  inconsistentStatusProgressCount: number;
  invalidFinancialsCount: number;
  totalIssuesCount: number;
  cleanRecordsCount: number;
  complianceRatePercent: number;
  issues: DataQualityIssue[];
}

/**
 * A. Portfolio Analytics: Deterministic aggregate metrics across all dimensions
 */
export function calculatePortfolioAdvancedMetrics(tasks: ProjectTask[]): PortfolioAdvancedMetrics {
  const summary = calculateDatasetSummary(tasks);
  const variance = analyzeBudgetVariance(tasks);
  const schedule = analyzeSchedule(tasks);

  return {
    totalProjects: summary.projects.length,
    totalTasks: tasks.length,
    allocatedBudget: summary.totalBudget,
    actualSpend: summary.totalSpend,
    netVariance: variance.portfolio.netVariance,
    isUnderBudget: variance.portfolio.isUnderBudget,
    variancePercentage: variance.portfolio.variancePercentage,
    avgProgress: summary.avgProgress,
    blockedTasksCount: summary.blockedCount,
    overdueTasksCount: schedule.overdueCount,
    overBudgetProjectsCount: variance.overBudgetProjects.length,
    overBudgetTasksCount: variance.overBudgetTasks.length,
  };
}

/**
 * B. Schedule Analytics: Analyzes overdue, approaching, and delay indicators
 * Uses reproducible evaluation date (defaults to 2026-10-09).
 */
export function analyzeSchedule(
  tasks: ProjectTask[],
  referenceDateInput?: Date | string
): ScheduleAnalysis {
  if (!tasks || tasks.length === 0) {
    return {
      asOfDate: '2026-10-09',
      totalTasksEvaluated: 0,
      overdueTasks: [],
      overdueCount: 0,
      approachingDeadlineTasks: [],
      approachingCount: 0,
      behindScheduleTasks: [],
      behindScheduleCount: 0,
      completedTasksCount: 0,
      completionRatePercent: 0,
      projectScheduleSummaries: [],
    };
  }

  const asOfDate = referenceDateInput
    ? new Date(referenceDateInput)
    : new Date('2026-10-09T00:00:00Z');
  const asOfTime = asOfDate.getTime();
  const twoWeeksLaterTime = asOfTime + 14 * 24 * 60 * 60 * 1000;

  const overdueTasks: ProjectTask[] = [];
  const approachingDeadlineTasks: ProjectTask[] = [];
  const behindScheduleTasks: {
    task: ProjectTask;
    expectedProgress: number;
    actualProgress: number;
    delayGapPercent: number;
  }[] = [];

  let completedTasksCount = 0;
  const projectMap = new Map<
    string,
    { total: number; completed: number; overdue: number; progressSum: number }
  >();

  for (const t of tasks) {
    const st = String(t.Status || '').trim().toLowerCase();
    const isCompleted = st.includes('complete') || st.includes('done') || (t.Progress_Percent ?? 0) >= 100;

    if (isCompleted) {
      completedTasksCount++;
    }

    const prj = String(t.Project_Name || 'General Project').trim();
    if (!projectMap.has(prj)) {
      projectMap.set(prj, { total: 0, completed: 0, overdue: 0, progressSum: 0 });
    }
    const pe = projectMap.get(prj)!;
    pe.total++;
    pe.progressSum += Number(t.Progress_Percent || 0);
    if (isCompleted) pe.completed++;

    const dueStr = t.Due_Date || t.End_Date;
    if (!dueStr) continue;

    const dueDate = new Date(dueStr);
    const dueTime = dueDate.getTime();
    if (isNaN(dueTime)) continue;

    // Overdue check: past due and not completed
    if (dueTime < asOfTime && !isCompleted) {
      overdueTasks.push(t);
      pe.overdue++;
    }
    // Approaching deadline: due within 14 days and not completed
    else if (dueTime >= asOfTime && dueTime <= twoWeeksLaterTime && !isCompleted) {
      approachingDeadlineTasks.push(t);
    }

    // Schedule slippage calculation: compare elapsed calendar duration against progress
    const startStr = t.Start_Date;
    if (startStr && !isCompleted) {
      const startDate = new Date(startStr);
      const startTime = startDate.getTime();
      if (!isNaN(startTime) && dueTime > startTime) {
        const totalDuration = dueTime - startTime;
        const elapsed = Math.max(0, Math.min(totalDuration, asOfTime - startTime));
        const expectedProgress = Math.round((elapsed / totalDuration) * 100);
        const actualProgress = Number(t.Progress_Percent || 0);

        // Flag if actual progress is behind expected by more than 15 percentage points
        if (expectedProgress - actualProgress > 15) {
          behindScheduleTasks.push({
            task: t,
            expectedProgress,
            actualProgress,
            delayGapPercent: expectedProgress - actualProgress,
          });
        }
      }
    }
  }

  const projectScheduleSummaries = Array.from(projectMap.entries()).map(([projectName, val]) => {
    const avgProg = val.total > 0 ? Math.round(val.progressSum / val.total) : 0;
    let status: 'on_track' | 'at_risk' | 'delayed' = 'on_track';
    if (val.overdue > 0) {
      status = 'delayed';
    } else if (val.completed < val.total && avgProg < 50) {
      status = 'at_risk';
    }

    return {
      projectName,
      totalTasks: val.total,
      completedTasks: val.completed,
      overdueTasks: val.overdue,
      avgProgress: avgProg,
      status,
    };
  });

  return {
    asOfDate: asOfDate.toISOString().split('T')[0],
    totalTasksEvaluated: tasks.length,
    overdueTasks,
    overdueCount: overdueTasks.length,
    approachingDeadlineTasks,
    approachingCount: approachingDeadlineTasks.length,
    behindScheduleTasks,
    behindScheduleCount: behindScheduleTasks.length,
    completedTasksCount,
    completionRatePercent:
      tasks.length > 0 ? Math.round((completedTasksCount / tasks.length) * 1000) / 10 : 0,
    projectScheduleSummaries,
  };
}

/**
 * C. Resource Analytics: Workload allocation per owner & department
 * Avoids inferring individual capacity from task counts alone.
 */
export function analyzeResources(tasks: ProjectTask[]): ResourceAnalysis {
  if (!tasks || tasks.length === 0) {
    return {
      totalOwners: 0,
      totalDepartments: 0,
      ownerWorkloads: [],
      departmentWorkloads: [],
      blockedWorkloadByDepartment: [],
      workloadConcentration: {
        top3OwnerSharePercent: 0,
        top3DepartmentSharePercent: 0,
        ownerHHI: 0,
        isConcentrated: false,
      },
      imbalanceIndicators: [],
      capacityDisclaimer:
        'Workload is derived solely from documented assigned task records. Precise individual hourly capacity cannot be inferred from task counts alone.',
    };
  }

  const ownerMap = new Map<
    string,
    { count: number; budget: number; spend: number; progSum: number; blocked: number }
  >();
  const deptMap = new Map<
    string,
    { count: number; budget: number; spend: number; progSum: number; blocked: number }
  >();

  for (const t of tasks) {
    const owner = String(t.Owner || t.Project_Manager || 'Unassigned').trim() || 'Unassigned';
    const dept = String(t.Department || 'Unspecified').trim() || 'Unspecified';
    const budget = Number(t.Allocated_Budget_USD || t.Budget || 0);
    const spend = Number(t.Actual_Spend_USD || t.Spent || 0);
    const prog = Number(t.Progress_Percent || 0);
    const isBlocked = String(t.Status || '').toLowerCase().includes('block');

    // Owner
    if (!ownerMap.has(owner)) {
      ownerMap.set(owner, { count: 0, budget: 0, spend: 0, progSum: 0, blocked: 0 });
    }
    const oe = ownerMap.get(owner)!;
    oe.count++;
    oe.budget += budget;
    oe.spend += spend;
    oe.progSum += prog;
    if (isBlocked) oe.blocked++;

    // Dept
    if (!deptMap.has(dept)) {
      deptMap.set(dept, { count: 0, budget: 0, spend: 0, progSum: 0, blocked: 0 });
    }
    const de = deptMap.get(dept)!;
    de.count++;
    de.budget += budget;
    de.spend += spend;
    de.progSum += prog;
    if (isBlocked) de.blocked++;
  }

  const ownerWorkloads: OwnerWorkload[] = Array.from(ownerMap.entries())
    .map(([owner, data]) => ({
      owner,
      taskCount: data.count,
      totalBudget: data.budget,
      totalSpend: data.spend,
      avgProgress: data.count > 0 ? Math.round(data.progSum / data.count) : 0,
      blockedCount: data.blocked,
      shareOfPortfolioPercent:
        tasks.length > 0 ? Math.round((data.count / tasks.length) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.taskCount - a.taskCount);

  const departmentWorkloads: DepartmentWorkload[] = Array.from(deptMap.entries())
    .map(([department, data]) => ({
      department,
      taskCount: data.count,
      totalBudget: data.budget,
      totalSpend: data.spend,
      avgProgress: data.count > 0 ? Math.round(data.progSum / data.count) : 0,
      blockedCount: data.blocked,
      shareOfPortfolioPercent:
        tasks.length > 0 ? Math.round((data.count / tasks.length) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.taskCount - a.taskCount);

  const blockedWorkloadByDepartment = departmentWorkloads
    .filter((d) => d.blockedCount > 0)
    .map((d) => ({
      department: d.department,
      blockedTasks: d.blockedCount,
      blockedSpend: d.totalSpend,
    }))
    .sort((a, b) => b.blockedTasks - a.blockedTasks);

  // Workload Concentration Analysis
  const top3Owners = ownerWorkloads.slice(0, 3);
  const top3OwnerShare = top3Owners.reduce((acc, o) => acc + o.shareOfPortfolioPercent, 0);

  const top3Depts = departmentWorkloads.slice(0, 3);
  const top3DeptShare = top3Depts.reduce((acc, d) => acc + d.shareOfPortfolioPercent, 0);

  // Herfindahl-Hirschman Index for owners: sum of squared market/workload shares
  const ownerHHI = Math.round(
    ownerWorkloads.reduce((acc, o) => acc + Math.pow(o.shareOfPortfolioPercent, 2), 0)
  );

  const imbalanceIndicators: string[] = [];
  ownerWorkloads.forEach((o) => {
    if (o.shareOfPortfolioPercent >= 25) {
      imbalanceIndicators.push(
        `Owner "${o.owner}" manages ${o.shareOfPortfolioPercent}% of portfolio tasks (${o.taskCount} tasks).`
      );
    }
    if (o.blockedCount >= 3) {
      imbalanceIndicators.push(
        `Owner "${o.owner}" has ${o.blockedCount} blocked tasks requiring immediate cross-functional resolution.`
      );
    }
  });

  departmentWorkloads.forEach((d) => {
    if (d.blockedCount >= 3) {
      imbalanceIndicators.push(
        `Department "${d.department}" has ${d.blockedCount} blocked tasks.`
      );
    }
  });

  return {
    totalOwners: ownerWorkloads.length,
    totalDepartments: departmentWorkloads.length,
    ownerWorkloads,
    departmentWorkloads,
    blockedWorkloadByDepartment,
    workloadConcentration: {
      top3OwnerSharePercent: Math.round(top3OwnerShare * 10) / 10,
      top3DepartmentSharePercent: Math.round(top3DeptShare * 10) / 10,
      ownerHHI,
      isConcentrated: top3OwnerShare > 50 || ownerHHI > 1800,
    },
    imbalanceIndicators,
    capacityDisclaimer:
      'Workload is derived solely from documented assigned task records. Precise individual hourly capacity cannot be inferred from task counts alone.',
  };
}


/**
 * E. Data Quality Audit: Detects missing, invalid, or contradictory values
 */
export function auditDataQuality(tasks: ProjectTask[]): DataQualityAudit {
  if (!tasks || tasks.length === 0) {
    return {
      totalRecordsChecked: 0,
      missingDatesCount: 0,
      invalidProgressCount: 0,
      missingBudgetCount: 0,
      inconsistentStatusProgressCount: 0,
      invalidFinancialsCount: 0,
      totalIssuesCount: 0,
      cleanRecordsCount: 0,
      complianceRatePercent: 100,
      issues: [],
    };
  }

  const issues: DataQualityIssue[] = [];
  let missingDatesCount = 0;
  let invalidProgressCount = 0;
  let missingBudgetCount = 0;
  let inconsistentStatusProgressCount = 0;
  let invalidFinancialsCount = 0;

  for (const t of tasks) {
    const id = t.Task_ID || 'UNKNOWN';
    const prj = t.Project_Name || 'General Project';

    // Dates check
    if (!t.Start_Date || !t.Due_Date || isNaN(new Date(t.Start_Date).getTime()) || isNaN(new Date(t.Due_Date).getTime())) {
      missingDatesCount++;
      issues.push({
        taskId: id,
        projectName: prj,
        field: 'Dates',
        issueDescription: 'Missing or unparseable Start_Date or Due_Date',
        severity: 'high',
      });
    }

    // Progress validity
    const rawProg = t.Progress_Percent;
    if (rawProg === null || rawProg === undefined || isNaN(Number(rawProg)) || Number(rawProg) < 0 || Number(rawProg) > 100) {
      invalidProgressCount++;
      issues.push({
        taskId: id,
        projectName: prj,
        field: 'Progress_Percent',
        issueDescription: `Invalid progress value (${rawProg}) outside valid 0 - 100 range`,
        severity: 'high',
      });
    }

    // Budget completeness
    const rawBudget = t.Allocated_Budget_USD ?? t.Budget;
    if (rawBudget === null || rawBudget === undefined || Number(rawBudget) < 0) {
      missingBudgetCount++;
      issues.push({
        taskId: id,
        projectName: prj,
        field: 'Allocated_Budget_USD',
        issueDescription: 'Missing or negative allocated budget',
        severity: 'medium',
      });
    }

    // Financial consistency
    const rawSpend = t.Actual_Spend_USD ?? t.Spent;
    if (rawSpend !== null && rawSpend !== undefined && Number(rawSpend) < 0) {
      invalidFinancialsCount++;
      issues.push({
        taskId: id,
        projectName: prj,
        field: 'Actual_Spend_USD',
        issueDescription: 'Actual spend cannot be negative',
        severity: 'high',
      });
    }

    // Status and Progress consistency
    const st = String(t.Status || '').toLowerCase();
    const progNum = Number(rawProg || 0);
    if ((st.includes('complete') || st.includes('done')) && progNum < 100) {
      inconsistentStatusProgressCount++;
      issues.push({
        taskId: id,
        projectName: prj,
        field: 'Status / Progress',
        issueDescription: `Status marked as "${t.Status}" but progress is ${progNum}% (expected 100%)`,
        severity: 'medium',
      });
    } else if (progNum >= 100 && !st.includes('complete') && !st.includes('done')) {
      inconsistentStatusProgressCount++;
      issues.push({
        taskId: id,
        projectName: prj,
        field: 'Status / Progress',
        issueDescription: `Progress is 100% but status is still marked as "${t.Status}"`,
        severity: 'low',
      });
    }
  }

  const totalIssuesCount = issues.length;
  const recordsWithIssues = new Set(issues.map((i) => i.taskId)).size;
  const cleanRecordsCount = Math.max(0, tasks.length - recordsWithIssues);
  const complianceRatePercent =
    tasks.length > 0 ? Math.round((cleanRecordsCount / tasks.length) * 1000) / 10 : 100;

  return {
    totalRecordsChecked: tasks.length,
    missingDatesCount,
    invalidProgressCount,
    missingBudgetCount,
    inconsistentStatusProgressCount,
    invalidFinancialsCount,
    totalIssuesCount,
    cleanRecordsCount,
    complianceRatePercent,
    issues,
  };
}

