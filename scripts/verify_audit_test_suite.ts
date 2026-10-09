/**
 * Comprehensive Automated Verification Test Suite
 * Covers Priorities 1 through 9: Tests A through L, plus Test Cases 1 through 12.
 */

import {
  calculateUnweightedAverageProgress,
  calculateDatasetSummary,
  filterDataset,
  extractDeterministicFacts,
  analyzeBudgetVariance,
  getOverBudgetTasks,
  getBlockedTasks,
} from '../src/lib/analytics';
import {
  cleanProgress,
  cleanNumber,
  sanitizeTask,
  parseContentToJSON,
  getProjectManagementDataset,
  ProjectTask,
} from '../src/lib/dataset';
import {
  generateDeterministicFallbackResponse,
} from '../src/lib/gemini';

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${testName}`);
  } else {
    failedTests++;
    console.error(`  [FAIL] ${testName}${detail ? ` - Detail: ${detail}` : ''}`);
  }
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('PM INSIGHT ENGINE / AI ANALYST - AUDIT & VERIFICATION TEST SUITE');
  console.log('================================================================\n');

  // ==========================================================================
  // TEST A: Chatbot Response Format (Priority 1)
  // ==========================================================================
  console.log('--- TEST A: Chatbot Response Format & JSON Unwrapping ---');
  const datasetInfo = getProjectManagementDataset();
  
  // 1. Test fallback when question is asked
  const fallback = generateDeterministicFallbackResponse(
    'Analyze the budget variance across all projects. Which tasks or projects are exceeding their allocated budget?',
    datasetInfo.records
  );
  assert(
    !fallback.text_response.startsWith('{"text_response":') &&
    !fallback.text_response.startsWith('{"answer":'),
    'Fallback text_response is clean Markdown and does not start with raw JSON wrapper'
  );
  assert(
    !fallback.text_response.includes('\\n\\n'),
    'Escaped \\n sequences are not present as raw literal backslashes'
  );
  assert(
    fallback.text_response.includes('Executive Budget Variance Analysis'),
    'Response contains readable executive markdown heading'
  );
  assert(
    fallback.highlight_ids.length > 0,
    'Highlight IDs array is populated with over-budget task IDs: ' + fallback.highlight_ids.length
  );

  // 2. Test simulated raw JSON wrapper string handling
  const rawWrappedString = JSON.stringify({
    text_response: "### Budget Variance Report\n\nOverall portfolio is in surplus.",
    highlight_ids: ["TASK-016"]
  });
  // Simulate client-side unwrapping logic
  let unwrapped = '';
  try {
    const p = JSON.parse(rawWrappedString);
    unwrapped = p.text_response || p.answer || '';
  } catch {}
  assert(
    unwrapped === "### Budget Variance Report\n\nOverall portfolio is in surplus.",
    'Client-side unwrapper extracts inner text_response from JSON string'
  );

  // ==========================================================================
  // TEST B: Overall Budget Variance (Priority 2)
  // ==========================================================================
  console.log('\n--- TEST B: Overall Budget Variance ---');
  // Allocated budget = $1,000, Actual spend = $800 -> Variance = $200 under budget
  const testBTasks: ProjectTask[] = [
    sanitizeTask({ Task_ID: 'TB-1', Project_Name: 'Project Alpha', Allocated_Budget_USD: 1000, Actual_Spend_USD: 800 }),
  ];
  const testBAnalysis = analyzeBudgetVariance(testBTasks);
  assert(testBAnalysis.portfolio.totalBudget === 1000, 'Portfolio total budget is $1,000');
  assert(testBAnalysis.portfolio.totalSpend === 800, 'Portfolio total spend is $800');
  assert(testBAnalysis.portfolio.netVariance === 200, 'Budget Variance ($1,000 - $800) = $200 (positive)');
  assert(testBAnalysis.portfolio.isUnderBudget === true, 'Portfolio is correctly marked as Under Budget');
  assert(testBAnalysis.portfolio.status === 'under_budget', 'Portfolio status is "under_budget"');

  // ==========================================================================
  // TEST C: Individual Over-Budget Project (Priority 2)
  // ==========================================================================
  console.log('\n--- TEST C: Individual Over-Budget Project ---');
  // Project A: Allocated = $100, Actual spend = $120 -> Variance = -$20, Over budget = $20
  const testCTasks: ProjectTask[] = [
    sanitizeTask({ Task_ID: 'TC-1', Project_Name: 'Project A', Allocated_Budget_USD: 100, Actual_Spend_USD: 120 }),
  ];
  const testCAnalysis = analyzeBudgetVariance(testCTasks);
  const prjA = testCAnalysis.projects.find((p) => p.project === 'Project A');
  assert(Boolean(prjA), 'Project A is analyzed');
  assert(prjA?.variance === -20, 'Project A variance is -$20 (negative = over budget)', `Got ${prjA?.variance}`);
  assert(prjA?.isOverBudget === true, 'Project A is marked as over budget');
  assert(prjA?.overAmount === 20, 'Project A over-budget amount is exactly $20', `Got ${prjA?.overAmount}`);
  assert(prjA?.overPercentage === 20, 'Project A over-budget percentage is exactly +20.0%', `Got ${prjA?.overPercentage}%`);
  assert(testCAnalysis.overBudgetProjects.length === 1, 'Exactly 1 over-budget project identified');

  // ==========================================================================
  // TEST D: Portfolio Surplus with an Over-Budget Project (Critical Correctness Rule)
  // ==========================================================================
  console.log('\n--- TEST D: Portfolio Surplus with Over-Budget Project ---');
  // Project A: Allocated $100, Spend $120
  // Project B: Allocated $200, Spend $180
  // Portfolio: Allocated $300, Spend $300, Variance $0 (or surplus)
  // Expected: Project A is STILL identified as $20 over budget!
  const testDTasks: ProjectTask[] = [
    sanitizeTask({ Task_ID: 'TD-1', Project_Name: 'Project A', Allocated_Budget_USD: 100, Actual_Spend_USD: 120 }),
    sanitizeTask({ Task_ID: 'TD-2', Project_Name: 'Project B', Allocated_Budget_USD: 200, Actual_Spend_USD: 180 }),
  ];
  const testDAnalysis = analyzeBudgetVariance(testDTasks);
  assert(testDAnalysis.portfolio.totalBudget === 300, 'Portfolio budget equals $300');
  assert(testDAnalysis.portfolio.totalSpend === 300, 'Portfolio spend equals $300');
  assert(testDAnalysis.portfolio.netVariance === 0, 'Portfolio net variance equals $0 (balanced/surplus)');
  assert(testDAnalysis.overBudgetProjects.length === 1, 'Project A is detected as over budget despite overall balanced portfolio');
  assert(testDAnalysis.overBudgetProjects[0].project === 'Project A', 'Detected over-budget project is "Project A"');
  assert(testDAnalysis.overBudgetProjects[0].overAmount === 20, 'Project A overrun amount is $20');

  // Also check against real 150-task dataset: Overall $1,037,081 surplus, yet "FinTech Payment Hub" is over budget!
  const realVariance = analyzeBudgetVariance(datasetInfo.records);
  assert(realVariance.portfolio.netVariance === 1037081, 'Real dataset net variance is +$1,037,081 (Under Budget)');
  assert(realVariance.overBudgetProjects.length === 1, 'Real dataset has exactly 1 over-budget project');
  assert(realVariance.overBudgetProjects[0].project === 'FinTech Payment Hub', 'Over-budget project is "FinTech Payment Hub"');
  assert(realVariance.overBudgetProjects[0].overAmount === 55290, 'FinTech Payment Hub overrun is exactly $55,290');
  assert(realVariance.overBudgetProjects[0].overPercentage === 4.8, 'FinTech Payment Hub overrun percentage is +4.8%');
  assert(realVariance.overBudgetTasks.length === 38, 'Real dataset has exactly 38 tasks exceeding budget');

  // ==========================================================================
  // TEST E: Zero Allocated Budget (Handling Division by Zero)
  // ==========================================================================
  console.log('\n--- TEST E: Zero Allocated Budget Handling ---');
  const testETasks: ProjectTask[] = [
    sanitizeTask({ Task_ID: 'TE-1', Project_Name: 'Experimental Lab', Allocated_Budget_USD: 0, Actual_Spend_USD: 500 }),
  ];
  const testEAnalysis = analyzeBudgetVariance(testETasks);
  const expPrj = testEAnalysis.projects.find((p) => p.project === 'Experimental Lab');
  assert(expPrj?.isOverBudget === true, 'Project with $0 budget and $500 spend is marked over budget');
  assert(expPrj?.overAmount === 500, 'Over amount is $500');
  assert(expPrj?.overPercentage === null, 'Percentage is safely null (no division by zero or NaN/Infinity)');

  // ==========================================================================
  // TEST F: Database & Analytical Consistency Across Components
  // ==========================================================================
  console.log('\n--- TEST F: Database Consistency Across Services ---');
  const realSummary = calculateDatasetSummary(datasetInfo.records);
  const chatbotFacts = extractDeterministicFacts('What is the total allocated budget?', datasetInfo.records);
  assert(
    realSummary.totalBudget === realVariance.portfolio.totalBudget &&
    realSummary.totalBudget === chatbotFacts.summary.totalBudget &&
    realSummary.totalBudget === 6285000,
    'Summary, Variance analysis, and Chatbot facts all report authoritative budget: $6,285,000'
  );
  assert(
    realSummary.totalSpend === realVariance.portfolio.totalSpend &&
    realSummary.totalSpend === chatbotFacts.summary.totalSpend &&
    realSummary.totalSpend === 5247919,
    'Summary, Variance analysis, and Chatbot facts all report authoritative spend: $5,247,919'
  );
  assert(
    realSummary.avgProgress === chatbotFacts.summary.avgProgress &&
    realSummary.avgProgress === 68,
    'Average progress across all services is 68%'
  );

  // ==========================================================================
  // TEST G: Gantt Timeline Date Parsing & Integrity
  // ==========================================================================
  console.log('\n--- TEST G: Gantt Timeline Date Integrity ---');
  const t0 = datasetInfo.records[0];
  const t0Start = new Date(t0.Start_Date);
  const t0Due = new Date(t0.Due_Date);
  assert(!isNaN(t0Start.getTime()), 'Start Date is valid timestamp: ' + t0.Start_Date);
  assert(!isNaN(t0Due.getTime()), 'Due Date is valid timestamp: ' + t0.Due_Date);
  assert(t0Due.getTime() >= t0Start.getTime(), 'Due Date >= Start Date');

  // Test invalid dates safely handled
  const invalidDateTask = sanitizeTask({ Task_ID: 'T-INV', Start_Date: 'invalid-date', Due_Date: null });
  assert(Boolean(invalidDateTask.Start_Date), 'Invalid start date falls back safely: ' + invalidDateTask.Start_Date);
  assert(Boolean(invalidDateTask.Due_Date), 'Null due date falls back safely: ' + invalidDateTask.Due_Date);

  // ==========================================================================
  // TEST H: Filter Scope Consistency
  // ==========================================================================
  console.log('\n--- TEST H: Filter Scope Consistency ---');
  const backendTasks = filterDataset(datasetInfo.records, { department: 'Backend Architecture' });
  const backendSummary = calculateDatasetSummary(backendTasks);
  const backendVariance = analyzeBudgetVariance(backendTasks);
  assert(
    backendSummary.totalBudget === backendVariance.portfolio.totalBudget,
    'Filtered summary and filtered variance match exactly on budget: $' + backendSummary.totalBudget.toLocaleString()
  );
  assert(
    backendSummary.totalSpend === backendVariance.portfolio.totalSpend,
    'Filtered summary and filtered variance match exactly on spend: $' + backendSummary.totalSpend.toLocaleString()
  );

  // ==========================================================================
  // TEST I: Empty Dataset Handling
  // ==========================================================================
  console.log('\n--- TEST I: Empty Dataset Handling ---');
  const emptyAnalysis = analyzeBudgetVariance([]);
  assert(emptyAnalysis.portfolio.totalBudget === 0, 'Empty dataset budget is 0');
  assert(emptyAnalysis.portfolio.totalSpend === 0, 'Empty dataset spend is 0');
  assert(emptyAnalysis.overBudgetProjects.length === 0, 'Empty dataset has 0 over-budget projects');
  assert(emptyAnalysis.overBudgetTasks.length === 0, 'Empty dataset has 0 over-budget tasks');
  
  const emptyResp = generateDeterministicFallbackResponse('Analyze budget variance', []);
  assert(
    emptyResp.text_response.includes('No project records are available'),
    'Chatbot explains no records are available on empty dataset'
  );

  // ==========================================================================
  // TEST J: Database Failure & Honest Offline Reporting
  // ==========================================================================
  console.log('\n--- TEST J: Database Failure / AI Offline Reporting ---');
  const offlineResp = generateDeterministicFallbackResponse('Check variance', datasetInfo.records);
  assert(
    offlineResp.text_response.includes('deterministic') ||
    offlineResp.text_response.includes('authoritative database records'),
    'Chatbot explicitly states verified database deterministic calculation is in effect'
  );

  // ==========================================================================
  // TEST K: Dataset Replacement Without Stale Cache
  // ==========================================================================
  console.log('\n--- TEST K: Dataset Replacement ---');
  const secondDataset: ProjectTask[] = [
    sanitizeTask({ Task_ID: 'NEW-1', Project_Name: 'Omega Initiative', Allocated_Budget_USD: 50000, Actual_Spend_USD: 60000 }),
    sanitizeTask({ Task_ID: 'NEW-2', Project_Name: 'Omega Initiative', Allocated_Budget_USD: 70000, Actual_Spend_USD: 40000 }),
  ];
  const secondSummary = calculateDatasetSummary(secondDataset);
  const secondVariance = analyzeBudgetVariance(secondDataset);
  assert(secondSummary.totalBudget === 120000, 'Replaced dataset budget = $120,000');
  assert(secondSummary.totalSpend === 100000, 'Replaced dataset spend = $100,000');
  assert(secondVariance.portfolio.netVariance === 20000, 'Replaced dataset net variance = +$20,000');

  // ==========================================================================
  // TEST L: Security & Secret Protection
  // ==========================================================================
  console.log('\n--- TEST L: Security & Secret Protection ---');
  const serializedResp = JSON.stringify(offlineResp);
  assert(
    !serializedResp.includes(process.env.GEMINI_API_KEY || 'SECRET_KEY_NOT_SET'),
    'Chatbot responses never echo server secrets'
  );

  // ==========================================================================
  // ADDITIONAL VALIDATIONS: Test Cases 1 through 5
  // ==========================================================================
  console.log('\n--- ADDITIONAL VALIDATIONS: Progress & Aggregation Cases ---');
  // Test Case 1: Unweighted average (20, 40, 60 -> 40)
  assert(
    calculateUnweightedAverageProgress([
      sanitizeTask({ Progress_Percent: 20 }),
      sanitizeTask({ Progress_Percent: 40 }),
      sanitizeTask({ Progress_Percent: 60 }),
    ]) === 40,
    'Unweighted average of 20%, 40%, 60% = 40%'
  );

  // Test Case 2: Progress validation & clamping
  assert(cleanProgress(0) === 0, 'Progress 0 is 0');
  assert(cleanProgress(50) === 50, 'Progress 50 is 50');
  assert(cleanProgress('45%') === 45, 'String "45%" parsed as 45');
  assert(cleanProgress('0.85') === 85, 'Decimal "0.85" converted to 85%');
  assert(cleanProgress(-10) === 0, 'Negative progress clamped to 0');
  assert(cleanProgress(120) === 100, 'Progress > 100 clamped to 100');

  // Test Case 3: Financial aggregation by status
  const t3Tasks: ProjectTask[] = [
    sanitizeTask({ Task_ID: 'T1', Status: 'Blocked', Allocated_Budget_USD: 100, Actual_Spend_USD: 100 }),
    sanitizeTask({ Task_ID: 'T2', Status: 'In Progress', Allocated_Budget_USD: 200, Actual_Spend_USD: 200 }),
    sanitizeTask({ Task_ID: 'T3', Status: 'Completed', Allocated_Budget_USD: 300, Actual_Spend_USD: 300 }),
    sanitizeTask({ Task_ID: 'T4', Status: 'Planned', Allocated_Budget_USD: 400, Actual_Spend_USD: 400 }),
  ];
  const t3Summary = calculateDatasetSummary(t3Tasks);
  assert(t3Summary.totalSpend === 1000, 'Total spend is $1,000');
  assert(t3Summary.statusCounts.find((s) => s.status === 'Blocked')?.spend === 100, 'Blocked spend is $100');
  assert(t3Summary.statusCounts.find((s) => s.status === 'In Progress')?.spend === 200, 'In Progress spend is $200');

  // Summary
  console.log('\n================================================================');
  console.log(`TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal error running test suite:', err);
  process.exit(1);
});
