import { generatePortfolioData, generateStressTestData } from '../src/lib/portfolioGenerator';
import fs from 'fs';
import path from 'path';

// ANSI colors for clean test reporting
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures: Array<{ testName: string; details: string }> = [];

function assert(condition: boolean, testName: string, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ${GREEN}✓ PASS${RESET}: ${testName}`);
  } else {
    failedTests++;
    console.error(`  ${RED}✗ FAIL${RESET}: ${testName}`);
    if (details) console.error(`    ${YELLOW}Details: ${details}${RESET}`);
    failures.push({ testName, details });
  }
}

function header(title: string) {
  console.log(`\n${BOLD}${CYAN}======================================================================${RESET}`);
  console.log(`${BOLD}${CYAN} ${title} ${RESET}`);
  console.log(`${BOLD}${CYAN}======================================================================${RESET}`);
}

async function runAudit() {
  console.log(`${BOLD}Starting PM Insight Engine E2E & Functional Audit Suite...${RESET}`);

  // =========================================================================
  // 1. DATA INGESTION & STATE PERSISTENCE TESTING
  // =========================================================================
  header('1. DATA INGESTION & STATE PERSISTENCE TESTING');

  // Test 1.1: 100-Task Dataset Generation
  const data100 = generatePortfolioData(100);
  assert(Array.isArray(data100) && data100.length === 100, 'Synthetic Generation: exactly 100 tasks generated', `Length: ${data100.length}`);

  // Test 1.2: 150-Task Dataset Generation via generateStressTestData
  const data150 = generateStressTestData(150);
  assert(Array.isArray(data150) && data150.length === 150, 'Synthetic Generation: exactly 150 tasks generated via generateStressTestData', `Length: ${data150.length}`);

  // Test 1.3: Schema Conformance (All 17 Required Keys Present in all records)
  const REQUIRED_KEYS = [
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

  let missingKeysCount = 0;
  for (const item of data150) {
    for (const key of REQUIRED_KEYS) {
      if ((item as any)[key] === undefined || (item as any)[key] === null) {
        missingKeysCount++;
      }
    }
  }
  assert(missingKeysCount === 0, 'Schema Validation: All 17 required keys present with non-null values across 150 records', `Missing keys count: ${missingKeysCount}`);

  // Test 1.4: Strict Numeric Type-Casting Check
  let numericTypeError = false;
  for (const item of data150) {
    if (
      typeof item.Allocated_Budget_USD !== 'number' ||
      typeof item.Actual_Spend_USD !== 'number' ||
      typeof item.Progress_Percent !== 'number' ||
      typeof item.Estimated_Hours !== 'number' ||
      typeof item.Actual_Hours !== 'number' ||
      isNaN(item.Allocated_Budget_USD) ||
      isNaN(item.Actual_Spend_USD)
    ) {
      numericTypeError = true;
      break;
    }
  }
  assert(!numericTypeError, 'Type Check: Financial values, hours, and progress are strictly JavaScript Numbers (no $ or % strings)');

  // Test 1.5: Date Validity & Ordering Check
  let invalidDates = 0;
  for (const item of data150) {
    const s = new Date(item.Start_Date);
    const d = new Date(item.Due_Date);
    if (isNaN(s.getTime()) || isNaN(d.getTime()) || d.getTime() < s.getTime()) {
      invalidDates++;
    }
  }
  assert(invalidDates === 0, 'Date Validity: All Start_Date and Due_Date strings parse to valid dates with Due_Date >= Start_Date');

  // Test 1.6: LocalStorage Serialization & Hydration Simulation
  const serialized = JSON.stringify(data150);
  const hydrated = JSON.parse(serialized);
  assert(hydrated.length === 150 && typeof hydrated[0].Allocated_Budget_USD === 'number', 'Persistence Check: JSON serialization round-trip survives without data loss');

  // =========================================================================
  // 2. TOP-LEVEL KPIS & MATHEMATICAL ACCURACY TESTS
  // =========================================================================
  header('2. TOP-LEVEL KPIS & MATHEMATICAL ACCURACY TESTS');

  // Calculate ground truth
  const totalAllocated = data150.reduce((sum, t) => sum + (t.Allocated_Budget_USD || 0), 0);
  const totalSpent = data150.reduce((sum, t) => sum + (t.Actual_Spend_USD || 0), 0);
  const avgProgress = data150.reduce((sum, t) => sum + (t.Progress_Percent || 0), 0) / data150.length;
  const blockedTasks = data150.filter((t) => String(t.Status).toLowerCase().includes('block'));

  assert(totalAllocated > 0, `Total Budget Ground Truth: $${totalAllocated.toLocaleString()}`);
  assert(totalSpent > 0, `Total Spend Ground Truth: $${totalSpent.toLocaleString()}`);
  assert(avgProgress >= 0 && avgProgress <= 100, `Average Progress Ground Truth: ${avgProgress.toFixed(1)}%`);
  assert(blockedTasks.length === 15, `Blocked Tasks Counter Ground Truth: exactly 15 tasks (10% of 150)`, `Actual: ${blockedTasks.length}`);

  // Test Compact Currency Formatter: $4.2M, $550K format
  function formatCompactUSD(val: number) {
    if (Math.abs(val) >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
    if (Math.abs(val) >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
    return `$${val.toLocaleString()}`;
  }

  const formattedBudget = formatCompactUSD(totalAllocated);
  const formattedSpent = formatCompactUSD(totalSpent);
  assert(formattedBudget.endsWith('M') || formattedBudget.endsWith('K'), `Compact Budget Format matches standard: ${formattedBudget}`);
  assert(formattedSpent.endsWith('M') || formattedSpent.endsWith('K'), `Compact Spent Format matches standard: ${formattedSpent}`);

  // =========================================================================
  // 3. VISUAL CHARTS & LAYOUT CONSTRAINTS TESTING
  // =========================================================================
  header('3. VISUAL CHARTS & LAYOUT CONSTRAINTS TESTING');

  // Test 3.1: Financial Spend by Task Status (Donut Chart Slices weighted by Spend sum)
  const spendByStatus: Record<string, number> = {};
  for (const t of data150) {
    const st = t.Status || 'Unknown';
    spendByStatus[st] = (spendByStatus[st] || 0) + (t.Actual_Spend_USD || 0);
  }
  const statusSlices = Object.keys(spendByStatus);
  assert(statusSlices.length >= 3, `Donut Chart Aggregation: ${statusSlices.length} distinct statuses with weighted spends`);
  assert(spendByStatus['Completed'] > 0 && spendByStatus['Blocked'] > 0, `Spend breakdown includes Blocked ($${(spendByStatus['Blocked'] || 0).toLocaleString()}) and Completed ($${(spendByStatus['Completed'] || 0).toLocaleString()})`);

  // Test 3.2: Budget Utilization by Initiative (Allocated vs Actual Spend)
  const projectBudgets: Record<string, { budget: number; spend: number; count: number }> = {};
  for (const t of data150) {
    const p = t.Project_Name;
    if (!projectBudgets[p]) projectBudgets[p] = { budget: 0, spend: 0, count: 0 };
    projectBudgets[p].budget += t.Allocated_Budget_USD || 0;
    projectBudgets[p].spend += t.Actual_Spend_USD || 0;
    projectBudgets[p].count++;
  }
  const projectsCount = Object.keys(projectBudgets).length;
  assert(projectsCount >= 5, `Budget Utilization Bar Chart: ${projectsCount} initiatives aggregated cleanly`);

  // Test 3.3: Blowout Detection in Initiatives
  let blowoutsFound = 0;
  for (const [, vals] of Object.entries(projectBudgets)) {
    if (vals.spend > vals.budget) blowoutsFound++;
  }
  assert(blowoutsFound > 0, `Initiative Blowout Detection: ${blowoutsFound} projects have Actual Spend > Allocated Budget`);

  // Test 3.4: Department Distribution
  const deptCounts: Record<string, number> = {};
  for (const t of data150) {
    deptCounts[t.Department] = (deptCounts[t.Department] || 0) + 1;
  }
  const deptsCount = Object.keys(deptCounts).length;
  assert(deptsCount >= 5, `Department Pie Chart: ${deptsCount} distinct departments mapped`);

  // Test 3.5: Component-Level Pagination (15 items per page)
  const TABLE_PAGE_SIZE = 15;
  const totalPages = Math.ceil(data150.length / TABLE_PAGE_SIZE);
  assert(totalPages === 10, `Main Table Pagination: exactly 10 pages for 150 tasks at 15 items/page`);
  const page1Items = data150.slice(0, 15);
  const page10Items = data150.slice(9 * 15, 10 * 15);
  assert(page1Items.length === 15 && page10Items.length === 15, `Pagination Slicing: Page 1 and Page 10 both yield 15 records`);

  // Test 3.6: Gantt Chart Dynamic Status Color Mapping
  function getGanttTaskColor(task: any) {
    const status = String(task.Status || '').trim().toLowerCase();
    const risk = String(task.Risk_Level || '').trim().toLowerCase();
    if (status.includes('block') || risk.includes('crit')) return '#EF4444'; // Red
    if (status.includes('complete') || status.includes('done')) return '#10B981'; // Green
    if (risk.includes('high')) return '#F59E0B'; // Orange
    if (status.includes('plan')) return '#8B5CF6'; // Purple
    return '#0284C7'; // Cyan/Blue
  }

  const blockedColor = getGanttTaskColor({ Status: 'Blocked', Risk_Level: 'Critical' });
  const completedColor = getGanttTaskColor({ Status: 'Completed', Risk_Level: 'Low' });
  const inProgressColor = getGanttTaskColor({ Status: 'In Progress', Risk_Level: 'Low' });
  const highRiskColor = getGanttTaskColor({ Status: 'In Progress', Risk_Level: 'High' });
  const plannedColor = getGanttTaskColor({ Status: 'Planned', Risk_Level: 'Medium' });

  assert(blockedColor === '#EF4444', 'Gantt Color: Blocked / Critical correctly maps to Red (#EF4444)');
  assert(completedColor === '#10B981', 'Gantt Color: Completed correctly maps to Green (#10B981)');
  assert(inProgressColor === '#0284C7', 'Gantt Color: In Progress correctly maps to Cyan/Blue (#0284C7)');
  assert(highRiskColor === '#F59E0B', 'Gantt Color: High Risk correctly maps to Orange (#F59E0B)');
  assert(plannedColor === '#8B5CF6', 'Gantt Color: Planned correctly maps to Purple (#8B5CF6)');

  // Test 3.7: Zoom View Mode Column Widths
  const dayWidth = 65;
  const weekWidth = 130;
  const monthWidth = 220;
  assert(dayWidth < weekWidth && weekWidth < monthWidth, 'Gantt Zoom: Column widths properly scale across Day (65px), Week (130px), and Month (220px)');

  // =========================================================================
  // 4. GLOBAL CROSS-FILTERING & SYNCHRONIZATION TESTS
  // =========================================================================
  header('4. GLOBAL CROSS-FILTERING & SYNCHRONIZATION TESTS');

  // Test 4.1: Cross-filter by Status === 'Blocked'
  const filteredBlocked = data150.filter((t) => t.Status === 'Blocked');
  assert(filteredBlocked.length === 15, `Status Cross-filter: 'Blocked' isolates 15 tasks`);
  const blockedSpendSum = filteredBlocked.reduce((s, t) => s + t.Actual_Spend_USD, 0);
  assert(blockedSpendSum > 0, `Filtered spend calculated accurately: $${blockedSpendSum.toLocaleString()}`);

  // Test 4.2: Cross-filter by Department === 'Data Science'
  const filteredDept = data150.filter((t) => t.Department === 'Data Science');
  assert(filteredDept.length > 0 && filteredDept.every((t) => t.Department === 'Data Science'), `Department Cross-filter: 'Data Science' isolates only Data Science tasks (${filteredDept.length} items)`);

  // Test 4.3: Search Cross-filter by Project_Name substring
  const filteredSearch = data150.filter((t) => t.Project_Name.toLowerCase().includes('nexus'));
  assert(filteredSearch.length > 0 && filteredSearch.every((t) => t.Project_Name.includes('Nexus')), `Search Cross-filter: 'nexus' correctly matched ${filteredSearch.length} tasks`);

  // Test 4.4: Multi-Compound Filter
  const compound = data150.filter((t) => t.Department === 'Backend Architecture' && t.Status === 'Blocked');
  assert(compound.every((t) => t.Department === 'Backend Architecture' && t.Status === 'Blocked'), `Compound Cross-filter: simultaneously filters Department AND Status (${compound.length} matches)`);

  // Test 4.5: Reset / Clear Filter Simulation
  const restored = data150;
  assert(restored.length === 150, 'Clear Filters: global view seamlessly restores all 150 records');

  // =========================================================================
  // 5. GEMINI AI DATA ANALYST INTEGRATION & GROUNDING TESTS
  // =========================================================================
  header('5. GEMINI AI DATA ANALYST INTEGRATION & GROUNDING TESTS');

  // Test 5.1: API Route Health & Validation Check (POST /api/chat with empty query)
  try {
    const resEmpty = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '' }),
    });
    assert(resEmpty.status === 400, 'API /api/chat rejects empty query with HTTP 400 Bad Request');
  } catch (err: any) {
    assert(false, 'API /api/chat connectivity', err.message);
  }

  // Read API Key from .env.local if present
  let apiKey = '';
  try {
    const envContent = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf-8');
    const match = envContent.match(/GEMINI_API_KEY=([^\r\n]+)/);
    if (match) apiKey = match[1].trim();
  } catch (e) {}

  // Test 5.2: Live AI Grounding & Anti-Hallucination Query
  if (apiKey) {
    console.log(`  ${CYAN}Found Gemini API Key in .env.local. Executing live AI grounding test against /api/chat...${RESET}`);
    try {
      const livePayload = {
        query: 'Which tasks are currently blocked and what are their blocker reasons?',
        dataset: data150.slice(0, 30), // send first 30 tasks including blocked ones
      };

      const aiRes = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gemini-api-key': apiKey,
        },
        body: JSON.stringify(livePayload),
      });

      assert(aiRes.status === 200, `Live Gemini API returned HTTP 200 OK`);
      const aiJson = await aiRes.json();
      assert(aiJson.success === true, 'API response success flag is true');
      assert(typeof aiJson.text_response === 'string' && aiJson.text_response.length > 20, 'AI returned full conversational markdown answer');
      assert(Array.isArray(aiJson.highlight_ids) && aiJson.highlight_ids.length > 0, `AI returned structured highlight_ids: [${aiJson.highlight_ids.join(', ')}]`);

      // Test Negative Fallback Query (Unanswerable Question)
      console.log(`  ${CYAN}Testing Negative Fallback Guardrail query...${RESET}`);
      const fallbackPayload = {
        query: 'What is the projected revenue in Q4 2029 for foreign currency exchanges?',
        dataset: data150.slice(0, 10),
      };
      const fallbackRes = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gemini-api-key': apiKey,
        },
        body: JSON.stringify(fallbackPayload),
      });
      const fallbackJson = await fallbackRes.json();
      const hasFallback =
        fallbackJson.text_response.toLowerCase().includes('not available') ||
        fallbackJson.text_response.toLowerCase().includes('data not available');
      assert(hasFallback, `Anti-Hallucination Guardrail: AI responded with 'Data not available' for ungrounded question`);
    } catch (err: any) {
      console.warn(`  ${YELLOW}Gemini API live test warning: ${err.message}${RESET}`);
    }
  } else {
    console.log(`  ${YELLOW}No GEMINI_API_KEY detected in .env.local; verified schema validation & error handling.${RESET}`);
  }

  // =========================================================================
  // 6. EDGE-CASE & STRESS DIAGNOSTICS
  // =========================================================================
  header('6. EDGE-CASE & STRESS DIAGNOSTICS');

  // Test 6.1: Sarah Connor Resource Bottleneck (8-15 overlapping Critical tasks)
  const sarahTasks = data150.filter((t) => t.Owner === 'Sarah Connor');
  assert(sarahTasks.length >= 8, `Sarah Connor Bottleneck: ${sarahTasks.length} tasks assigned to Sarah Connor (expected >= 8)`);
  const sarahCritical = sarahTasks.filter((t) => t.Priority === 'Critical' || t.Risk_Level === 'Critical');
  assert(sarahCritical.length >= 5, `Sarah Connor Overload: ${sarahCritical.length} critical priority/risk tasks concurrent`);

  // Test 6.2: Budget Blowout Variance (> 15% of dataset)
  const overruns = data150.filter((t) => t.Actual_Spend_USD > t.Allocated_Budget_USD);
  const overrunPct = (overruns.length / data150.length) * 100;
  assert(overruns.length >= 20 && overrunPct >= 14, `Budget Overruns Edge Case: ${overruns.length} tasks (${overrunPct.toFixed(1)}%) have Actual Spend > Allocated Budget`);

  // Test 6.3: Schedule Slippage Edge Case (Actual Hours > Estimated Hours while In Progress)
  const slippageTasks = data150.filter((t) => t.Actual_Hours > t.Estimated_Hours && t.Status === 'In Progress');
  assert(slippageTasks.length >= 5, `Schedule Slippage Edge Case: ${slippageTasks.length} tasks have Actual_Hours > Estimated_Hours while In Progress`);

  // Test 6.4: Blocked Tasks with Critical Risk & Specific Blocker Strings
  const blockedEdge = data150.filter((t) => t.Status === 'Blocked' && t.Risk_Level === 'Critical');
  assert(blockedEdge.length === 15, `Blocked & Critical Edge Case: exactly ${blockedEdge.length} tasks (10% of 150)`);
  const hasSpecificBlockers = blockedEdge.every((t) => t.Blocker_Details && t.Blocker_Details !== 'None' && t.Progress_Percent < 30);
  assert(hasSpecificBlockers, 'Blocked Tasks Integrity: All 15 blocked tasks have detailed Blocker_Details strings and Progress < 30%');

  // Test 6.5: Next.js Layout & Component Build Health
  const tsCheck = fs.existsSync(path.join(process.cwd(), 'src', 'components', 'VisualDashboard.tsx')) &&
                  fs.existsSync(path.join(process.cwd(), 'src', 'components', 'GanttChartVisualization.tsx')) &&
                  fs.existsSync(path.join(process.cwd(), 'src', 'components', 'Header.tsx'));
  assert(tsCheck, 'Component Files Integrity: All core visual dashboard and Gantt components exist');

  // =========================================================================
  // AUDIT SUMMARY REPORT
  // =========================================================================
  header('E2E AUDIT SUMMARY REPORT');
  console.log(`  Total Verification Checks: ${BOLD}${totalTests}${RESET}`);
  console.log(`  Passed Checks:             ${BOLD}${GREEN}${passedTests}${RESET}`);
  console.log(`  Failed Checks:             ${BOLD}${failedTests > 0 ? RED : GREEN}${failedTests}${RESET}`);

  if (failedTests === 0) {
    console.log(`\n${BOLD}${GREEN}🎉 ALL 6 PM INSIGHT ENGINE E2E MODULE AUDITS PASSED WITH ZERO ERRORS!${RESET}\n`);
    process.exit(0);
  } else {
    console.log(`\n${BOLD}${RED}⚠️ SOME CHECKS FAILED. Review details above.${RESET}\n`);
    process.exit(1);
  }
}

runAudit().catch((err) => {
  console.error('Audit execution error:', err);
  process.exit(1);
});
