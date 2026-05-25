import type { Database } from 'sql.js'

import schemaSql from './schema.sql?raw'

/**
 * 초기 DDL + 시드(Issue #1 계약): idempotent하게 전체 실행.
 * schema_version.version 은 후속 DDL 시 증분·분기 확장용(현재 1).
 */
export function applyInitialMigration(db: Database): void {
  db.exec(schemaSql)
  // 단백질 계수 기본값 (PRD 설정 키)
  db.run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', ['protein_factor', '1.7'])
}
