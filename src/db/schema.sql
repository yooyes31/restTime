-- restTime v1 초기 스키마 (CREATE IF NOT EXISTS 로 idempotent)
-- PRD.md 데이터 스키마(개념) 기준 SQL화

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_version (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  version INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO schema_version (id, version) VALUES (1, 0);

CREATE TABLE IF NOT EXISTS meal_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  memo TEXT NOT NULL DEFAULT '',
  kcal REAL NOT NULL DEFAULT 0,
  protein_g REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS meal_presets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner')),
  name TEXT NOT NULL,
  memo TEXT NOT NULL DEFAULT '',
  kcal REAL NOT NULL DEFAULT 0,
  protein_g REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS workout_presets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  weekday INTEGER NOT NULL UNIQUE CHECK (weekday >= 0 AND weekday <= 6)
);

CREATE TABLE IF NOT EXISTS workout_preset_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  preset_id INTEGER NOT NULL REFERENCES workout_presets (id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL,
  exercise_name TEXT NOT NULL,
  sets INTEGER NOT NULL,
  reps INTEGER NOT NULL,
  weight_kg REAL
);

CREATE TABLE IF NOT EXISTS workout_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  preset_id INTEGER REFERENCES workout_presets (id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  minutes INTEGER NOT NULL DEFAULT 0,
  memo TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

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

CREATE TABLE IF NOT EXISTS inbody_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  measured_at TEXT NOT NULL,
  weight_kg REAL NOT NULL,
  muscle_kg REAL NOT NULL,
  body_fat_pct REAL NOT NULL,
  burn_kcal REAL NOT NULL,
  note TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- 마이그레이션 버전: 후속 DDL 은 migrations.ts 에서 bump
UPDATE schema_version SET version = 1 WHERE id = 1;
