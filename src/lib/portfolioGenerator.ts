import { ProjectTask } from './dataset';

export interface PortfolioTaskSchema {
  Task_ID: string;
  Project_Name: string;
  Task_Title: string;
  Sprint: string;
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
  Risk_Level: 'Critical' | 'High' | 'Medium' | 'Low' | string;
  Blocker_Details: string;
  // Extended fields for visualization compatibility
  [key: string]: any;
}

/**
 * Deterministic PRNG (Linear Congruential Generator)
 * Guarantees 100% reproducible and consistent generation across all environments.
 */
function createSeededRandom(seed: number = 42) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return function next(): number {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Returns a normalized ISO string YYYY-MM-DD from calendar coordinates
 */
function formatValidIsoDate(year: number, month: number, day: number): string {
  const d = new Date(year, month - 1, day);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/**
 * Projects pool
 */
const PROJECTS = [
  'Nexus Cloud Core',
  'FinTech Payment Hub',
  'AI Predictive Engine',
  'CyberSec Zero-Trust Guard',
  'Omnichannel Mobile Suite',
  'Data Lakehouse 2.0',
  'Customer Portal 360',
  'Edge IoT Telemetry Platform',
];

/**
 * Department and owner assignments
 */
const TEAM_MEMBERS = [
  { name: 'David Kim', dept: 'Backend Architecture' },
  { name: 'Priya Sharma', dept: 'Data Science' },
  { name: 'Marcus Brody', dept: 'DevSecOps' },
  { name: 'Alex Rivera', dept: 'Frontend Engineering' },
  { name: 'Elena Rostova', dept: 'Quality Assurance' },
  { name: 'James Wilson', dept: 'Mobile Development' },
  { name: 'Carlos Mendez', dept: 'Infrastructure & Cloud' },
  { name: 'Maya Lin', dept: 'DevSecOps' },
  { name: 'Tariq Vance', dept: 'Data Science' },
  { name: 'Sophia Chen', dept: 'Product & Design' },
];

/**
 * Specific blocker details for Blocked projects
 */
const BLOCKER_DETAILS_LIST = [
  'Awaiting InfoSec compliance sign-off',
  'Vendor integration failure on payment webhook',
  'Cross-region network partition latency exceeding SLA',
  'Third-party OAuth2 identity provider outage',
  'Pending legal sign-off on GDPR data transfer agreement',
  'Upstream DB migration schema deadlock on replica',
  'Hardware accelerator / GPU quota allocation denied in us-east-1',
  'API rate limit exceeded on enterprise clearinghouse gateway',
  'SOC2 Type II penetration testing remediation in progress',
  'Awaiting client architecture board security clearance',
  'Unresolved merge collision in core cryptography subsystem',
  'Staging environment SAN storage hardware failure',
];

/**
 * Curated realistic engineering task titles
 */
const TASK_TITLES = [
  'Distributed Multi-Region Redis Cluster & Invalidation Shield',
  'PCI DSS v4.0 HSM Key Management & Token Vault Rotation',
  'Zero-Downtime PostgreSQL Schema Migration with pg_repack',
  'High-Throughput Kafka Partition Rebalance & MirrorMaker Sync',
  'Real-Time Fraud Detection LightGBM Inference Microservice',
  'Multi-Gateway Stripe & Adyen Automatic Failover Router',
  'OAuth2.1 & OpenID Connect PKCE Identity Federation Layer',
  'FastAPI & ONNX Runtime Model Serving with CUDA Acceleration',
  'Automated Feature Store Ingestion & Validation Pipeline',
  'mTLS Service-to-Service Encryption with Envoy Sidecars',
  'Container Vulnerability Scanning & SBOM Generation Pipeline',
  'Automated Blue-Green Deployment Controller for Kubernetes',
  'Synthetic Data Generator for Anonymized Privacy Shield',
  'Next.js 15 Server Actions & Edge Middleware Caching Layer',
  'Real-Time WebSocket Heartbeat & Connection Recovery Pool',
  'Role-Based Access Control (RBAC) Granular Policy Engine',
  'Automated Canary Release Routing with Argo Rollouts',
  'Snowflake Data Warehouse Reverse ETL Streaming Pipeline',
  'GraphQL Federation Gateway Schema Merging & Query Planner',
  'WebRTC Ultra-Low Latency Audio/Video Streaming Bridge',
  'Elasticsearch Multi-Cluster Cross-Index Search Optimizer',
  'Prometheus & OpenTelemetry Metrics Aggregator Exporter',
  'Disaster Recovery Cross-Region Snapshot Synchronization',
  'Mobile Push Notification Orchestration Engine via APNs/FCM',
  'Automated Playwright End-to-End Regression Test Suite',
  'Cloud Cost Allocation & Reserved Instance Optimization',
  'Idempotent Event Sourcing Ledger for Transaction Audits',
  'Dynamic Configuration Hot-Reload Daemon with Consul',
  'Terraform Multi-Cloud Infrastructure as Code Module Set',
  'Customer Churn Hazard Prediction Model v3 Deployment',
];

/**
 * Generates a deterministic project portfolio dataset matching the exact schema
 * and injecting all required edge cases:
 *
 * 1. Exactly 10% Blocked: Status "Blocked", Risk "Critical", Blocker_Details specific strings, Progress < 30%
 * 2. ~15% Budget Overruns: Actual_Spend_USD exceeds Allocated_Budget_USD by 120% to 150%
 * 3. Schedule Slippage: Actual_Hours significantly exceed Estimated_Hours, but Status is "In Progress"
 * 4. Resource Bottlenecks: "Sarah Connor" assigned 8-10 overlapping "Critical" priority tasks across similar dates
 * 5. Healthy Baseline: Balance of Completed, In Progress, Planned with realistic metrics
 *
 * @param count Number of rows to generate (defaults to exactly 150)
 */
export function generatePortfolioData(count: number = 150): ProjectTask[] {
  const nextRand = createSeededRandom(1337);
  const tasks: ProjectTask[] = [];

  // Edge case allocation count (10% blocked, 15% budget overruns)
  const blockedCount = Math.round(count * 0.10);
  const budgetOverrunCount = Math.round(count * 0.15);
  const bottleneckCount = Math.min(15, Math.max(8, Math.round(count * 0.10)));
  const slippageCount = Math.round(count * 0.10);

  // Pre-calculate index ranges
  const blockedEnd = blockedCount; // 0..9 (10 items)
  const overrunEnd = blockedEnd + budgetOverrunCount; // 10..24 (15 items)
  const bottleneckEnd = overrunEnd + bottleneckCount; // 25..34 (10 items)
  const slippageEnd = bottleneckEnd + slippageCount; // 35..44 (10 items)
  // 45..99 = Healthy Baseline (55 items)

  for (let i = 0; i < count; i++) {
    const taskId = `TASK-${String(i + 1).padStart(3, '0')}`;
    const sprintNum = 20 + Math.floor(i / 15);
    const sprint = `Sprint ${sprintNum}`;
    let project = PROJECTS[i % PROJECTS.length];
    const baseTitle = TASK_TITLES[i % TASK_TITLES.length];

    let owner = TEAM_MEMBERS[i % TEAM_MEMBERS.length].name;
    let department = TEAM_MEMBERS[i % TEAM_MEMBERS.length].dept;
    let priority: 'Critical' | 'High' | 'Medium' | 'Low' = 'Medium';
    let status: 'Completed' | 'In Progress' | 'Blocked' | 'Planned' | 'In Review' = 'In Progress';
    let progress = 50;
    let estimatedHours = 40 + (i % 8) * 10; // 40 to 110 hrs
    let actualHours = Math.round(estimatedHours * 0.9);
    let budget = 15000 + (i % 12) * 5000; // $15,000 to $70,000
    let spend = Math.round(budget * 0.85);
    let startDate = '2026-08-15';
    let dueDate = '2026-10-15';
    let riskLevel: 'Critical' | 'High' | 'Medium' | 'Low' = 'Low';
    let blockerDetails = 'None';

    // -------------------------------------------------------------------------
    // EDGE CASE 1: Blocked Projects & Details (Exactly 10% of total)
    // -------------------------------------------------------------------------
    if (i < blockedEnd) {
      status = 'Blocked';
      riskLevel = 'Critical';
      priority = 'Critical';
      // Progress percent forced to stall below 30%
      const stallProgressOptions = [8, 12, 15, 18, 20, 22, 24, 25, 27, 28];
      progress = stallProgressOptions[i % stallProgressOptions.length];
      blockerDetails = BLOCKER_DETAILS_LIST[i % BLOCKER_DETAILS_LIST.length];
      actualHours = Math.round(estimatedHours * (progress / 100) * 1.3);
      spend = Math.round(budget * (progress / 100) * 1.25);
      startDate = formatValidIsoDate(2026, 8, 10 + (i % 10));
      dueDate = formatValidIsoDate(2026, 10, 5 + (i % 20));
    }
    // -------------------------------------------------------------------------
    // EDGE CASE 2: Budget Overruns (Financial Variance, ~15% of total)
    // Actual_Spend_USD exceeds Allocated_Budget_USD by 120% to 150%
    // -------------------------------------------------------------------------
    else if (i < overrunEnd) {
      const overrunIndex = i - blockedEnd;
      // Concentrate several overruns on FinTech Payment Hub to trigger initiative blowout
      if (overrunIndex % 2 === 0) {
        project = 'FinTech Payment Hub';
      }
      // Fixed variance multipliers spanning 1.20 to 1.50 (120% to 150%)
      const overrunMultipliers = [
        1.25, 1.30, 1.35, 1.40, 1.45, 
        1.48, 1.50, 1.38, 1.42, 1.46
      ];
      const multiplier = overrunMultipliers[overrunIndex % overrunMultipliers.length];
      spend = Math.round(budget * multiplier);
      status = overrunIndex % 3 === 0 ? 'Completed' : 'In Progress';
      progress = status === 'Completed' ? 100 : 70 + (overrunIndex % 25);
      actualHours = Math.round(estimatedHours * (multiplier * 0.95));
      priority = overrunIndex % 2 === 0 ? 'High' : 'Critical';
      riskLevel = 'High';
      blockerDetails = 'None';
      startDate = formatValidIsoDate(2026, 8, 5 + (i % 15));
      dueDate = formatValidIsoDate(2026, 10, 15 + (i % 10));
    }
    // -------------------------------------------------------------------------
    // EDGE CASE 3: Resource Bottlenecks (Sarah Connor Overallocated)
    // 8-10 overlapping "Critical" priority tasks across similar dates
    // -------------------------------------------------------------------------
    else if (i < bottleneckEnd) {
      const bottleneckIdx = i - overrunEnd;
      owner = 'Sarah Connor';
      department = 'Backend Architecture';
      priority = 'Critical';
      status = 'In Progress';
      riskLevel = bottleneckIdx % 2 === 0 ? 'Critical' : 'High';
      progress = 35 + bottleneckIdx * 4; // 35% to 71%
      // Clustered overlapping dates in Sept/Oct 2026 creating concentrated bottleneck
      startDate = formatValidIsoDate(2026, 9, 1 + Math.floor(bottleneckIdx / 2));
      dueDate = formatValidIsoDate(2026, 10, 10 + bottleneckIdx);
      estimatedHours = 75 + bottleneckIdx * 5;
      actualHours = Math.round(estimatedHours * 0.8);
      spend = Math.round(budget * 0.75);
      blockerDetails = 'None';
    }
    // -------------------------------------------------------------------------
    // EDGE CASE 4: Schedule Slippage
    // Actual_Hours significantly exceed Estimated_Hours, but status is "In Progress"
    // -------------------------------------------------------------------------
    else if (i < slippageEnd) {
      const slippageIdx = i - bottleneckEnd;
      status = 'In Progress';
      // Slippage multipliers: 135% to 180% of estimated hours
      const slippageMultipliers = [1.35, 1.40, 1.45, 1.50, 1.55, 1.60, 1.65, 1.70, 1.75, 1.80];
      const hourMultiplier = slippageMultipliers[slippageIdx % slippageMultipliers.length];
      actualHours = Math.round(estimatedHours * hourMultiplier);
      progress = 45 + (slippageIdx % 5) * 6; // 45% - 69%, far behind expected hours
      priority = 'High';
      riskLevel = 'High';
      spend = Math.round(budget * 1.10); // mild spend overrun associated with overtime
      startDate = formatValidIsoDate(2026, 8, 1 + (slippageIdx % 10));
      dueDate = formatValidIsoDate(2026, 9, 15 + (slippageIdx % 12));
      blockerDetails = 'None';
    }
    // -------------------------------------------------------------------------
    // EDGE CASE 5: Healthy Baseline (Remaining ~55 rows)
    // Healthy mix of Completed, In Progress, and Planned
    // -------------------------------------------------------------------------
    else {
      const baselineIdx = i - slippageEnd;
      const mod = baselineIdx % 10;

      if (mod < 5) {
        // Completed Tasks (50% of baseline)
        status = 'Completed';
        progress = 100;
        priority = mod % 2 === 0 ? 'High' : 'Medium';
        riskLevel = 'Low';
        actualHours = Math.round(estimatedHours * (0.92 + (mod * 0.02)));
        spend = Math.round(budget * (0.94 + (mod * 0.015)));
        startDate = formatValidIsoDate(2026, 7, 5 + (mod * 2));
        dueDate = formatValidIsoDate(2026, 8, 15 + (mod * 2));
        blockerDetails = 'None';
      } else if (mod < 8) {
        // Healthy In Progress (30% of baseline)
        status = 'In Progress';
        progress = 40 + (mod * 7); // 40% to 89%
        priority = mod === 6 ? 'High' : 'Medium';
        riskLevel = mod === 7 ? 'Medium' : 'Low';
        actualHours = Math.round(estimatedHours * (progress / 100));
        spend = Math.round(budget * (progress / 100) * 0.95);
        startDate = formatValidIsoDate(2026, 8, 10 + mod);
        dueDate = formatValidIsoDate(2026, 10, 15 + mod);
        blockerDetails = 'None';
      } else {
        // Planned Tasks (20% of baseline)
        status = 'Planned';
        progress = 0;
        priority = 'Medium';
        riskLevel = 'Low';
        actualHours = 0;
        spend = 0;
        startDate = formatValidIsoDate(2026, 10, 10 + mod);
        dueDate = formatValidIsoDate(2026, 12, 10 + mod);
        blockerDetails = 'None';
      }
    }

    const startObj = new Date(startDate);
    const dueObj = new Date(dueDate);

    const task: ProjectTask = {
      // Required Exact Schema Fields:
      Task_ID: taskId,
      Project_Name: project,
      Task_Title: `${baseTitle} (Part ${((i % 4) + 1)})`,
      Sprint: sprint,
      Owner: owner,
      Department: department,
      Priority: priority,
      Status: status,
      Progress_Percent: progress,
      Estimated_Hours: estimatedHours,
      Actual_Hours: actualHours,
      Allocated_Budget_USD: budget,
      Actual_Spend_USD: spend,
      Start_Date: startDate,
      Due_Date: dueDate,
      Risk_Level: riskLevel,
      Blocker_Details: blockerDetails,

      // Runtime compatibility aliases for visualization & table components:
      End_Date: dueDate,
      'Start Date': startDate,
      'Due Date': dueDate,
      'End Date': dueDate,
      Project_Manager: owner,
      'Project Manager': owner,
      Number_of_Team_Members: 2 + (i % 6),
      Team_Members_Count: 2 + (i % 6),
      'Number of Team Members': 2 + (i % 6),
      Budget: budget,
      'Budget (USD)': budget,
      Spent: spend,
      'Spent (USD)': spend,
      startDateObj: startObj,
      dueDateObj: dueObj,
      endDateObj: dueObj,
      Start_Date_Obj: startObj,
      Due_Date_Obj: dueObj,
      End_Date_Obj: dueObj,
    };

    tasks.push(task);
  }

  return tasks;
}

/**
 * Deterministic 150-task stress-test generator alias matching the Master Build specification.
 */
export const generateStressTestData = (count: number = 150): ProjectTask[] => generatePortfolioData(count);
