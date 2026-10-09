import { getAllTasksFromDB } from '../src/lib/db';
import { calculateDatasetSummary, analyzeBudgetVariance, analyzeSchedule } from '../src/lib/analytics';
import fs from 'fs';
import path from 'path';

console.log('================================================================');
console.log('PM INSIGHT ENGINE - SIMPLIFICATION & CODEBASE AUDIT TEST SUITE');
console.log('================================================================');

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, desc: string) {
  if (condition) {
    console.log(`  [PASS] ${desc}`);
    passedCount++;
  } else {
    console.error(`  [FAIL] ${desc}`);
    failedCount++;
  }
}

// -----------------------------------------------------------------------------
// 1. GANTT TIMELINE DATE & COORDINATE TESTS (PRESERVED)
// -----------------------------------------------------------------------------
console.log('\n--- 1. GANTT TIMELINE DATE & COORDINATE CALCULATIONS ---');
const tasks = getAllTasksFromDB();
assert(tasks.length === 150, `150 authoritative tasks loaded from SQLite database (got ${tasks.length})`);

// Date validity
let invalidDates = 0;
let invertedDates = 0;
tasks.forEach((t) => {
  const start = new Date(t.Start_Date);
  const due = new Date(t.Due_Date);
  if (isNaN(start.getTime()) || isNaN(due.getTime())) invalidDates++;
  if (due.getTime() < start.getTime()) invertedDates++;
});
assert(invalidDates === 0, `All 150 tasks have valid parseable ISO dates`);
assert(invertedDates === 0, `All 150 tasks have Due_Date >= Start_Date (no inverted intervals)`);

// Earliest task date calculation
const startTimes = tasks.map((t) => new Date(t.Start_Date).getTime());
const minStartTime = Math.min(...startTimes);
const earliestDate = new Date(minStartTime);
assert(earliestDate.toISOString().startsWith('2026-07-05'), `Earliest task start date is 2026-07-05 (got ${earliestDate.toISOString().slice(0, 10)})`);

const dueTimes = tasks.map((t) => new Date(t.Due_Date).getTime());
const maxDueTime = Math.max(...dueTimes);
const latestDueDate = new Date(maxDueTime);
assert(latestDueDate.toISOString().startsWith('2026-12-19'), `Latest task due date is 2026-12-19 (got ${latestDueDate.toISOString().slice(0, 10)})`);

// Verify representative task bars
console.log('\n--- 5 Representative Task Bars Audit ---');
const sampleTasks = tasks.slice(0, 5);
sampleTasks.forEach((t) => {
  const start = new Date(t.Start_Date);
  const due = new Date(t.Due_Date);
  const durationDays = Math.round((due.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  assert(durationDays > 0, `Task ${t.Task_ID} (${t.Task_Title.slice(0, 30)}...): start=${t.Start_Date}, due=${t.Due_Date}, duration=${durationDays}d > 0`);
});

// -----------------------------------------------------------------------------
// 2. VERIFY REMOVAL OF PREDICTIVE & FORECASTING
// -----------------------------------------------------------------------------
console.log('\n--- 2. VERIFY REMOVAL OF PREDICTIVE & FORECASTING ---');
assert(!fs.existsSync(path.resolve('src/components/PredictiveInsightsView.tsx')), 'PredictiveInsightsView.tsx has been removed');
assert(!fs.existsSync(path.resolve('src/lib/forecasting.ts')), 'forecasting.ts has been removed');
assert(!fs.existsSync(path.resolve('src/lib/mlReadiness.ts')), 'mlReadiness.ts has been removed');

const dashboardCode = fs.readFileSync(path.resolve('src/components/VisualDashboard.tsx'), 'utf8');
assert(!dashboardCode.includes('PredictiveInsightsView'), 'VisualDashboard does not import or render PredictiveInsightsView');
assert(!dashboardCode.includes("activeSection === 'predictive'"), 'VisualDashboard has no predictive activeSection condition');

const geminiCode = fs.readFileSync(path.resolve('src/lib/gemini.ts'), 'utf8');
assert(!geminiCode.includes('generateBudgetForecast'), 'gemini.ts does not reference generateBudgetForecast');
assert(!geminiCode.includes('generateScheduleForecast'), 'gemini.ts does not reference generateScheduleForecast');
assert(!geminiCode.includes('calculateRiskScores'), 'gemini.ts does not reference calculateRiskScores');

// -----------------------------------------------------------------------------
// 3. VERIFY REMOVAL OF SIDEBAR
// -----------------------------------------------------------------------------
console.log('\n--- 3. VERIFY REMOVAL OF SIDEBAR ---');
assert(!fs.existsSync(path.resolve('src/components/Sidebar.tsx')), 'Sidebar.tsx has been removed');

const chatInterfaceCode = fs.readFileSync(path.resolve('src/components/ChatInterface.tsx'), 'utf8');
assert(!chatInterfaceCode.includes('<Sidebar'), 'ChatInterface does not render <Sidebar />');
assert(!chatInterfaceCode.includes('isSidebarCollapsed'), 'ChatInterface has no isSidebarCollapsed state');
assert(!chatInterfaceCode.includes("from './Sidebar'"), "ChatInterface does not import from './Sidebar'");

// -----------------------------------------------------------------------------
// 4. CLEAN TOP NAVIGATION & LAYOUT AUDIT
// -----------------------------------------------------------------------------
console.log('\n--- 4. CLEAN TOP NAVIGATION & LAYOUT AUDIT ---');
const headerCode = fs.readFileSync(path.resolve('src/components/Header.tsx'), 'utf8');
assert(headerCode.includes('Portfolio Overview'), 'Header includes Portfolio Overview tab');
assert(headerCode.includes('Budget & Variance'), 'Header includes Budget & Variance tab');
assert(headerCode.includes('Gantt Timeline'), 'Header includes Gantt Timeline tab');
assert(headerCode.includes('Task Master Table'), 'Header includes Task Master Table tab');
assert(headerCode.includes('AI Analyst Copilot'), 'Header includes AI Analyst Copilot tab');
assert(!headerCode.includes('Predictive & Forecasting'), 'Header does NOT include Predictive & Forecasting');

const globalsCss = fs.readFileSync(path.resolve('src/app/globals.css'), 'utf8');
assert(globalsCss.includes('.app-workspace-layout'), 'CSS defines .app-workspace-layout');
assert(globalsCss.includes('.app-header-container'), 'CSS defines .app-header-container');
assert(globalsCss.includes('.nav-tab-btn'), 'CSS defines .nav-tab-btn');
assert(globalsCss.includes('.header-view-mode-toggle'), 'CSS defines .header-view-mode-toggle');
assert(!globalsCss.includes('.app-sidebar'), 'CSS contains NO .app-sidebar rules');
assert(!globalsCss.includes('.predictive-view-container'), 'CSS contains NO .predictive-view-container rules');
assert(globalsCss.includes('g.bar'), 'CSS defines Gantt task bar visibility rule (g.bar)');

// -----------------------------------------------------------------------------
// 5. DETERMINISTIC DATABASE-DERIVED METRICS (DYNAMIC, NO HARDCODED METRICS)
// -----------------------------------------------------------------------------
console.log('\n--- 5. DYNAMIC DATABASE METRICS AUDIT ---');
const summary = calculateDatasetSummary(tasks);
const variance = analyzeBudgetVariance(tasks);

assert(summary.totalBudget === 6285000, `Calculated Database Budget: $${summary.totalBudget.toLocaleString()} from 150 tasks`);
assert(summary.totalSpend === 5247919, `Calculated Database Spend: $${summary.totalSpend.toLocaleString()} from 150 tasks`);
assert(variance.portfolio.netVariance === 1037081, `Calculated Net Variance: +$${variance.portfolio.netVariance.toLocaleString()}`);
assert(summary.avgProgress === 68, `Calculated Average Progress: ${summary.avgProgress}%`);
assert(variance.overBudgetTasks.length === 38, `Calculated Over-Budget Tasks: ${variance.overBudgetTasks.length} tasks`);

// -----------------------------------------------------------------------------
// SUMMARY
// -----------------------------------------------------------------------------
console.log('\n================================================================');
console.log(`AUDIT & VERIFICATION COMPLETE: ${passedCount} PASSED, ${failedCount} FAILED`);
console.log('================================================================\n');

if (failedCount > 0) {
  process.exit(1);
}
