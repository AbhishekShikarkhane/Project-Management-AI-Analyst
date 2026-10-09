import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

export async function backupDatabase(): Promise<{ success: boolean; backupPath: string; taskCount: number; budget: number; spend: number }> {
  const dbPath = process.env.DATABASE_FILE
    ? path.resolve(process.env.DATABASE_FILE)
    : path.join(process.cwd(), 'data', 'pm_insight_engine.db');

  if (!fs.existsSync(dbPath)) {
    throw new Error(`Source database does not exist at ${dbPath}`);
  }

  const backupDir = path.join(process.cwd(), 'data', 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFileName = `pm_insight_engine_backup_${timestamp}.db`;
  const backupPath = path.join(backupDir, backupFileName);

  // 1. Open live DB and perform WAL checkpoint to ensure all commits are in main DB file
  const db = new Database(dbPath);
  try {
    db.pragma('wal_checkpoint(TRUNCATE)');
  } catch (err) {
    console.warn('WAL checkpoint notice:', err);
  }

  // 2. Perform online SQLite backup API
  try {
    await db.backup(backupPath);
  } catch (err) {
    fs.copyFileSync(dbPath, backupPath);
  }

  // Verify record counts
  const rowCount = db.prepare('SELECT COUNT(*) as c FROM tasks').get() as { c: number };
  const totals = db.prepare('SELECT SUM(allocated_budget) as b, SUM(actual_spend) as s FROM tasks').get() as { b: number; s: number };

  db.close();

  // Synchronous fallback copy if online backup is async
  if (!fs.existsSync(backupPath) || fs.statSync(backupPath).size === 0) {
    fs.copyFileSync(dbPath, backupPath);
  }

  const backupDb = new Database(backupPath, { readonly: true });
  const backupRowCount = backupDb.prepare('SELECT COUNT(*) as c FROM tasks').get() as { c: number };
  backupDb.close();

  if (backupRowCount.c !== rowCount.c) {
    throw new Error(`Backup verification failed: source count (${rowCount.c}) != backup count (${backupRowCount.c})`);
  }

  return {
    success: true,
    backupPath,
    taskCount: rowCount.c,
    budget: totals.b,
    spend: totals.s,
  };
}

if (require.main === module) {
  console.log('Running database backup procedure...');
  backupDatabase()
    .then((res) => console.log('Backup Results:', res))
    .catch((err) => console.error('Backup failed:', err));
}
