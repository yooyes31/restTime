import type { Database } from 'sql.js'

import schemaSql from './schema.sql?raw'

function getSchemaVersion(db: Database): number {
  try {
    const r = db.exec('SELECT version FROM schema_version WHERE id = 1')
    const v = r[0]?.values[0]?.[0]
    return typeof v === 'number' ? v : Number(v) || 0
  } catch {
    return 0
  }
}

/** v2: 오늘 운동 일지 + 세션 메모 */
function applyMigrationV2(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS workout_day_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      exercise_name TEXT NOT NULL,
      sets INTEGER NOT NULL,
      reps INTEGER NOT NULL,
      weight_kg REAL,
      memo TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_workout_day_log_date ON workout_day_log (date);
  `)
  const cols = db.exec(`PRAGMA table_info(workout_sessions)`)
  const names = new Set(cols[0]?.values.map((row) => String(row[1])) ?? [])
  if (!names.has('memo')) {
    db.run(`ALTER TABLE workout_sessions ADD COLUMN memo TEXT NOT NULL DEFAULT ''`)
  }
  db.run('UPDATE schema_version SET version = 2 WHERE id = 1')
}

/**
 * 초기 DDL + 시드(Issue #1 계약): idempotent하게 전체 실행.
 * schema_version.version 으로 v2 마이그레이션 분기.
 */
export function applyInitialMigration(db: Database): void {
  db.exec(schemaSql)
  db.run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', ['protein_factor', '1.7'])
  const version = getSchemaVersion(db)
  if (version < 2) applyMigrationV2(db)
}
