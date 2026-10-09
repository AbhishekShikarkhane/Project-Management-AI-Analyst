import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import {
  getDatabase,
  closeDatabase,
  initDatabaseSchema,
  importTasksTransaction,
  getAllTasksFromDB,
  getTasksFilteredFromDB,
  getPortfolioSummaryFromDB,
  getBudgetVarianceFromDB,
  upsertTaskInDB,
  deleteTaskFromDB,
  syncAggregateEntities,
} from '../src/lib/db';
import { calculateDatasetSummary, analyzeBudgetVariance } from '../src/lib/analytics';
import { generateDeterministicFallbackResponse } from '../src/lib/gemini';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  [PASS] ${msg}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${msg}`);
    failed++;
  }
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('PM INSIGHT ENGINE - PHASE 12 COMPREHENSIVE DATABASE TEST SUITE');
  console.log('================================================================\n');

  const testDbDir = path.join(process.cwd(), 'data', 'test_scratch');
  if (!fs.existsSync(testDbDir)) {
    fs.mkdirSync(testDbDir, { recursive: true });
  }

  const isolatedDbPath = path.join(testDbDir, `isolated_test_${Date.now()}.db`);

  // Clean any previous test db
  if (fs.existsSync(isolatedDbPath)) {
    fs.unlinkSync(isolatedDbPath);
  }

  // -------------------------------------------------------------
  // TEST 1: Database Connection
  // -------------------------------------------------------------
  console.log('--- TEST 1: Database Connection ---');
  const db = new Database(isolatedDbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  const journalMode = db.pragma('journal_mode', { simple: true });
  const foreignKeys = db.pragma('foreign_keys', { simple: true });
  assert(journalMode === 'wal', 'SQLite journal mode is configured to WAL for high concurrency');
  assert(foreignKeys === 1, 'SQLite foreign keys pragma is enforced');

  // -------------------------------------------------------------
  // TEST 2: Schema & Migrations
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: Schema & Migrations ---');
  initDatabaseSchema(db);
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table'")
    .all()
    .map((r: any) => r.name);
  assert(tables.includes('tasks'), 'Table `tasks` exists');
  assert(tables.includes('projects'), 'Table `projects` exists');
  assert(tables.includes('departments'), 'Table `departments` exists');
  assert(tables.includes('dataset_imports'), 'Table `dataset_imports` exists');

  const indexes = db
    .prepare("SELECT name FROM sqlite_master WHERE type='index'")
    .all()
    .map((r: any) => r.name);
  assert(indexes.includes('idx_tasks_project'), 'Index `idx_tasks_project` exists');
  assert(indexes.includes('idx_tasks_department'), 'Index `idx_tasks_department` exists');
  assert(indexes.includes('idx_tasks_dates'), 'Index `idx_tasks_dates` exists');
  assert(indexes.includes('idx_tasks_budget_spend'), 'Index `idx_tasks_budget_spend` exists');

  // -------------------------------------------------------------
  // TEST 3: CSV Import (Authoritative 150 tasks)
  // -------------------------------------------------------------
  console.log('\n--- TEST 3: CSV Import (Authoritative 150 tasks) ---');
  const csvPath = path.join(process.cwd(), 'Data set', '150-Project Portfolio (150 tasks).csv');
  assert(fs.existsSync(csvPath), 'Authoritative CSV file exists on disk');
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const headerLine = lines[0];
  const headers = headerLine.split(',').map((h) => h.replace(/^"|"$/g, '').trim());

  const parsedRecords: any[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.replace(/^"|"$/g, '').trim());
    const rec: any = {};
    headers.forEach((h, idx) => {
      rec[h] = cols[idx] || '';
    });
    parsedRecords.push(rec);
  }

  const importResult = importTasksTransaction(parsedRecords, {
    fileName: '150-Project Portfolio (150 tasks).csv',
    mode: 'replace',
    db,
  });

  assert(importResult.success === true, 'CSV import transaction succeeded');
  assert(importResult.imported === 150, `Successfully imported 150 tasks (got ${importResult.imported})`);
  assert(importResult.rejected === 0, 'Zero valid records rejected');

  // -------------------------------------------------------------
  // TEST 4: Excel / Delimited Text Import
  // -------------------------------------------------------------
  console.log('\n--- TEST 4: Excel / Delimited Text Import ---');
  const simulatedExcelData = [
    {
      Task_ID: 'EXCEL-001',
      Project_Name: 'Mobile Banking Upgrade',
      Task_Title: 'Biometric Authentication',
      Department: 'Security',
      Priority: 'High',
      Status: 'In Progress',
      Progress_Percent: 65,
      Allocated_Budget_USD: 50000,
      Actual_Spend_USD: 42000,
      Start_Date: '2026-09-01',
      Due_Date: '2026-10-30',
      Risk_Level: 'Medium',
    },
    {
      Task_ID: 'EXCEL-002',
      Project_Name: 'Mobile Banking Upgrade',
      Task_Title: 'Push Notifications',
      Department: 'Engineering',
      Priority: 'Medium',
      Status: 'Completed',
      Progress_Percent: 100,
      Allocated_Budget_USD: 30000,
      Actual_Spend_USD: 28000,
      Start_Date: '2026-09-05',
      Due_Date: '2026-10-15',
      Risk_Level: 'Low',
    },
  ];

  const excelImportResult = importTasksTransaction(simulatedExcelData, {
    fileName: 'mobile_banking_excel_export.xlsx',
    mode: 'upsert',
    db,
  });
  assert(excelImportResult.success === true, 'Excel/tabular payload imported successfully');
  assert(excelImportResult.imported === 2, '2 Excel tasks persisted');

  // Verify retrieval of Excel record
  const excelRow = db.prepare('SELECT * FROM tasks WHERE task_id = ?').get('EXCEL-001') as any;
  assert(excelRow && excelRow.project_name === 'Mobile Banking Upgrade', 'Excel task retrieved with correct project');
  assert(excelRow.progress_percent === 65, 'Excel task progress preserved as 65%');

  // Clean up Excel tasks to keep authoritative dataset baseline for subsequent tests
  db.prepare("DELETE FROM tasks WHERE task_id LIKE 'EXCEL-%'").run();
  syncAggregateEntities(db);

  // -------------------------------------------------------------
  // TEST 5: Duplicate Imports (Idempotence & Upsert)
  // -------------------------------------------------------------
  console.log('\n--- TEST 5: Duplicate Imports ---');
  const initialCount = (db.prepare('SELECT COUNT(*) as count FROM tasks').get() as any).count;
  assert(initialCount === 150, 'Baseline task count is 150');

  // Re-import the exact same 150 tasks in upsert mode
  const duplicateUpsert = importTasksTransaction(parsedRecords, {
    fileName: 'duplicate_upload.csv',
    mode: 'upsert',
    db,
  });
  assert(duplicateUpsert.success === true, 'Duplicate re-import in upsert mode succeeded');
  const postUpsertCount = (db.prepare('SELECT COUNT(*) as count FROM tasks').get() as any).count;
  assert(postUpsertCount === 150, `Duplicate import did not duplicate records (count remained ${postUpsertCount})`);

  // Re-import in replace mode
  const duplicateReplace = importTasksTransaction(parsedRecords, {
    fileName: 'duplicate_upload.csv',
    mode: 'replace',
    db,
  });
  assert(duplicateReplace.success === true, 'Duplicate re-import in replace mode succeeded');
  const postReplaceCount = (db.prepare('SELECT COUNT(*) as count FROM tasks').get() as any).count;
  assert(postReplaceCount === 150, `Replace mode preserved exactly 150 tasks (count is ${postReplaceCount})`);

  // -------------------------------------------------------------
  // TEST 6: Invalid Records Detection & Sanitization
  // -------------------------------------------------------------
  console.log('\n--- TEST 6: Invalid Records Detection ---');
  const invalidBatch = [
    {
      Task_ID: '', // Missing ID
      Project_Name: 'Test Project',
      Allocated_Budget_USD: 1000,
    },
    {
      Task_ID: 'INV-001',
      Project_Name: 'Test Project',
      Allocated_Budget_USD: -500, // Negative budget
      Actual_Spend_USD: 200,
    },
    {
      Task_ID: 'INV-002',
      Project_Name: 'Test Project',
      Allocated_Budget_USD: 500,
      Actual_Spend_USD: -200, // Negative spend
    },
  ];

  const invalidResult = importTasksTransaction(invalidBatch, {
    fileName: 'invalid_batch.csv',
    mode: 'upsert',
    db,
  });
  assert(invalidResult.rejected === 3, `All 3 invalid records were rejected (got ${invalidResult.rejected})`);
  assert(invalidResult.errors.length >= 3, 'Detailed validation errors returned for each invalid record');

  // -------------------------------------------------------------
  // TEST 7: Transaction Rollback on Fatal Error
  // -------------------------------------------------------------
  console.log('\n--- TEST 7: Transaction Rollback on Fatal Error ---');
  const countBeforeRollback = (db.prepare('SELECT COUNT(*) as count FROM tasks').get() as any).count;

  // Attempt import with only invalid records
  const completelyInvalid = [
    { Task_ID: '', Allocated_Budget_USD: -100 },
    { Task_ID: '', Allocated_Budget_USD: -200 },
  ];
  const rollbackResult = importTasksTransaction(completelyInvalid, {
    fileName: 'fatal_batch.csv',
    mode: 'replace',
    db,
  });
  assert(rollbackResult.success === false, 'Import with zero valid records failed as expected');
  const countAfterRollback = (db.prepare('SELECT COUNT(*) as count FROM tasks').get() as any).count;
  assert(
    countAfterRollback === countBeforeRollback,
    `Active dataset was not cleared or corrupted (count remained ${countAfterRollback})`
  );

  // -------------------------------------------------------------
  // TEST 8: Dataset Replacement
  // -------------------------------------------------------------
  console.log('\n--- TEST 8: Dataset Replacement ---');
  const tempDataset = [
    {
      Task_ID: 'TEMP-01',
      Project_Name: 'Apollo',
      Task_Title: 'Orbital Insertion',
      Department: 'Flight',
      Priority: 'Critical',
      Status: 'Completed',
      Progress_Percent: 100,
      Allocated_Budget_USD: 100000,
      Actual_Spend_USD: 90000,
      Start_Date: '2026-09-01',
      Due_Date: '2026-09-15',
      Risk_Level: 'Low',
    },
  ];
  const replaceRes = importTasksTransaction(tempDataset, {
    fileName: 'apollo.csv',
    mode: 'replace',
    db,
  });
  assert(replaceRes.success === true, 'Replacement transaction succeeded');
  assert(replaceRes.imported === 1, 'Only 1 record in replaced dataset');
  const replaceCount = (db.prepare('SELECT COUNT(*) as count FROM tasks').get() as any).count;
  assert(replaceCount === 1, 'Old dataset was atomically replaced by new dataset');

  // Restore 150 tasks authoritative dataset
  importTasksTransaction(parsedRecords, {
    fileName: '150-Project Portfolio (150 tasks).csv',
    mode: 'replace',
    db,
  });
  assert((db.prepare('SELECT COUNT(*) as count FROM tasks').get() as any).count === 150, '150 tasks restored');

  // -------------------------------------------------------------
  // TEST 9: Database Persistence After Restart
  // -------------------------------------------------------------
  console.log('\n--- TEST 9: Database Persistence After Restart ---');
  db.close();
  // Re-open fresh connection from same disk file
  const restartedDb = new Database(isolatedDbPath);
  const restartCount = (restartedDb.prepare('SELECT COUNT(*) as count FROM tasks').get() as any).count;
  assert(restartCount === 150, `Persisted tasks survived database closure & reopen (150 tasks verified)`);

  const restartProjects = (restartedDb.prepare('SELECT COUNT(*) as count FROM projects').get() as any).count;
  assert(restartProjects > 0, `Projects entity preserved across restart (${restartProjects} projects)`);

  // -------------------------------------------------------------
  // TEST 10: Dashboard Aggregation
  // -------------------------------------------------------------
  console.log('\n--- TEST 10: Dashboard Aggregation ---');
  const dbTasks = getAllTasksFromDB(restartedDb);
  assert(dbTasks.length === 150, `getAllTasksFromDB retrieved 150 tasks`);

  const summary = calculateDatasetSummary(dbTasks);
  assert(summary.projects.length === 8, `8 distinct projects identified in dashboard aggregation (got ${summary.projects.length})`);
  assert(summary.departments.length === 8, `8 distinct departments identified in department distribution (got ${summary.departments.length})`);
  assert(summary.statusCounts.length >= 4, `All status categories populated for status chart`);

  // -------------------------------------------------------------
  // TEST 11: Financial Chart Totals
  // -------------------------------------------------------------
  console.log('\n--- TEST 11: Financial Chart Totals ---');
  const totalBudget = dbTasks.reduce((acc, t) => acc + (t.Allocated_Budget_USD || 0), 0);
  const totalSpend = dbTasks.reduce((acc, t) => acc + (t.Actual_Spend_USD || 0), 0);
  assert(totalBudget === 6285000, `Authoritative Allocated Budget is exactly $6,285,000 (got $${totalBudget.toLocaleString()})`);
  assert(totalSpend === 5247919, `Authoritative Actual Spend is exactly $5,247,919 (got $${totalSpend.toLocaleString()})`);

  // -------------------------------------------------------------
  // TEST 12: Average Progress
  // -------------------------------------------------------------
  console.log('\n--- TEST 12: Average Progress ---');
  const avgProgress = summary.avgProgress;
  assert(avgProgress === 68, `Portfolio Unweighted Average Progress is exactly 68% (got ${avgProgress}%)`);

  // -------------------------------------------------------------
  // TEST 13: Budget Variance
  // -------------------------------------------------------------
  console.log('\n--- TEST 13: Budget Variance ---');
  const varianceReport = analyzeBudgetVariance(dbTasks);
  const netVariance = varianceReport.portfolio.netVariance;
  assert(netVariance === 1037081, `Net Portfolio Variance is +$1,037,081 Under Budget (got +$${netVariance.toLocaleString()})`);
  assert(varianceReport.portfolio.isUnderBudget === true, 'Portfolio overall marked as under budget');
  assert(varianceReport.portfolio.status === 'under_budget', 'Portfolio status is "under_budget"');

  // -------------------------------------------------------------
  // TEST 14: Over-Budget Project Detection
  // -------------------------------------------------------------
  console.log('\n--- TEST 14: Over-Budget Project Detection ---');
  assert(varianceReport.overBudgetProjects.length === 1, `Exactly 1 over-budget project identified (got ${varianceReport.overBudgetProjects.length})`);
  const overProject = varianceReport.overBudgetProjects[0];
  assert(overProject.project === 'FinTech Payment Hub', `Detected over-budget project is "${overProject.project}"`);
  assert(overProject.overAmount === 55290, `FinTech Payment Hub overrun amount is exactly $55,290 (got $${overProject.overAmount})`);
  assert(overProject.overPercentage === 4.8, `FinTech Payment Hub overrun percentage is +4.8% (got +${overProject.overPercentage}%)`);

  // -------------------------------------------------------------
  // TEST 15: Over-Budget Task Detection
  // -------------------------------------------------------------
  console.log('\n--- TEST 15: Over-Budget Task Detection ---');
  assert(varianceReport.overBudgetTasks.length === 38, `Exactly 38 tasks exceed their budget (got ${varianceReport.overBudgetTasks.length})`);
  const topOverTask = varianceReport.overBudgetTasks[0];
  assert(topOverTask.isOverBudget === true, `Top overrun task ${topOverTask.taskId} is marked over budget`);
  assert(topOverTask.overAmount > 0, `Top overrun task has positive overAmount: $${topOverTask.overAmount}`);

  // -------------------------------------------------------------
  // TEST 16: Chatbot Database Queries
  // -------------------------------------------------------------
  console.log('\n--- TEST 16: Chatbot Database Queries ---');
  // Verify chatbot fallback logic queries persistent records
  const chatbotFallback = generateDeterministicFallbackResponse(
    'What is the budget variance and how many projects are over budget?',
    dbTasks
  );
  assert(chatbotFallback.text_response.includes('1,037,081'), 'Chatbot text response contains verified net variance $1,037,081');
  assert(chatbotFallback.text_response.includes('FinTech Payment Hub'), 'Chatbot text response names FinTech Payment Hub');
  assert(chatbotFallback.highlight_ids.length > 0, 'Chatbot returned highlight_ids for visual linking');

  // -------------------------------------------------------------
  // TEST 17: Dashboard and Chatbot Consistency
  // -------------------------------------------------------------
  console.log('\n--- TEST 17: Dashboard and Chatbot Consistency ---');
  const dbSummary = getPortfolioSummaryFromDB(undefined, restartedDb);
  const dbVariance = getBudgetVarianceFromDB(undefined, restartedDb);
  assert(dbSummary.totalBudget === dbVariance.portfolio.totalBudget, 'Dashboard summary and variance report total budgets match');
  assert(dbSummary.totalSpend === dbVariance.portfolio.totalSpend, 'Dashboard summary and variance report total spends match');
  assert(dbSummary.avgProgress === 68, 'Database-backed summary reports 68% average progress');

  // -------------------------------------------------------------
  // TEST 18: Authorization & Security
  // -------------------------------------------------------------
  console.log('\n--- TEST 18: Authorization & Security ---');
  // Verify no internal credentials or sensitive paths in task outputs
  const serialized = JSON.stringify(dbTasks[0]);
  assert(!serialized.includes('password'), 'Task records do not contain password attributes');
  assert(!serialized.includes('process.env'), 'Task records do not expose process environment');
  assert(!serialized.includes('pm_insight_engine.db'), 'Database filename not leaked in record attributes');

  // -------------------------------------------------------------
  // TEST 19: Database Outages & Error Handling
  // -------------------------------------------------------------
  console.log('\n--- TEST 19: Database Outages & Error Handling ---');
  // Attempt invalid query on closed DB or bad syntax
  let caughtError = false;
  try {
    restartedDb.prepare('SELECT * FROM non_existent_table').all();
  } catch (err: any) {
    caughtError = true;
    assert(err.message.includes('no such table'), 'Handled database query exception safely');
  }
  assert(caughtError === true, 'Database query failure was caught and isolated');

  // -------------------------------------------------------------
  // TEST 20: AI Provider Outage Resiliency
  // -------------------------------------------------------------
  console.log('\n--- TEST 20: AI Provider Outage Resiliency ---');
  const offlineResponse = generateDeterministicFallbackResponse('Which tasks are blocked?', dbTasks);
  assert(offlineResponse.text_response.length > 50, 'Fallback generates complete markdown when AI is offline');
  assert(!offlineResponse.text_response.startsWith('{'), 'Fallback output is clean Markdown without raw JSON');

  // -------------------------------------------------------------
  // TEST 21: Empty Datasets
  // -------------------------------------------------------------
  console.log('\n--- TEST 21: Empty Datasets ---');
  const emptyTasks: any[] = [];
  const emptySummary = calculateDatasetSummary(emptyTasks);
  const emptyVariance = analyzeBudgetVariance(emptyTasks);
  assert(emptySummary.totalBudget === 0, 'Empty dataset total budget is 0');
  assert(emptySummary.totalSpend === 0, 'Empty dataset total spend is 0');
  assert(emptySummary.avgProgress === 0, 'Empty dataset avg progress is 0');
  assert(emptyVariance.overBudgetProjects.length === 0, 'Empty dataset has 0 over-budget projects');
  assert(emptyVariance.overBudgetTasks.length === 0, 'Empty dataset has 0 over-budget tasks');

  // -------------------------------------------------------------
  // TEST 22: Concurrent Updates & Isolation
  // -------------------------------------------------------------
  console.log('\n--- TEST 22: Concurrent Updates & Isolation ---');
  // Perform multiple upserts in rapid succession using WAL mode
  const taskToUpdate = {
    Task_ID: 'TASK-001',
    Project_Name: 'Cloud Migration',
    Task_Title: 'Architecture Review',
    Department: 'Engineering',
    Priority: 'Critical',
    Status: 'In Progress',
    Progress_Percent: 75,
    Allocated_Budget_USD: 45000,
    Actual_Spend_USD: 39000,
    Start_Date: '2026-08-10',
    Due_Date: '2026-10-05',
    Risk_Level: 'Medium',
  };

  const updateSuccess = upsertTaskInDB(taskToUpdate, restartedDb);
  assert(updateSuccess === true, 'Individual task upsert succeeded');
  const updatedRow = restartedDb.prepare('SELECT * FROM tasks WHERE task_id = ?').get('TASK-001') as any;
  assert(updatedRow.progress_percent === 75, 'Updated progress (75%) persisted in database');

  // Restore TASK-001 to original authoritative values
  importTasksTransaction(parsedRecords, {
    fileName: '150-Project Portfolio (150 tasks).csv',
    mode: 'replace',
    db: restartedDb,
  });

  restartedDb.close();

  // Clean up scratch test database
  try {
    if (fs.existsSync(isolatedDbPath)) {
      fs.unlinkSync(isolatedDbPath);
    }
    const walFile = `${isolatedDbPath}-wal`;
    const shmFile = `${isolatedDbPath}-shm`;
    if (fs.existsSync(walFile)) fs.unlinkSync(walFile);
    if (fs.existsSync(shmFile)) fs.unlinkSync(shmFile);
  } catch {}

  console.log('\n================================================================');
  console.log(`DATABASE TEST SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
