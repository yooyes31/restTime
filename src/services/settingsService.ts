import type { SqlValue } from 'sql.js'

import type { LocalDatabase } from '@/db/LocalDatabase'

/**
 * 로컬 settings 키/값 접근 — Drive 메타데이터·단백질 계수 등
 * (MariaDB 없음 · execute 대신 LocalDatabase 계약 유지 — 한글 주석)
 */
export class SettingsService {
  constructor(private readonly db: LocalDatabase) {}

  async get(key: string): Promise<string | null> {
    const rows = await this.db.query<Record<string, SqlValue>>(
      'SELECT value FROM settings WHERE key = ? LIMIT 1',
      [key],
    )
    const v = rows[0]?.value
    return v === null || v === undefined ? null : String(v)
  }

  async set(key: string, value: string): Promise<void> {
    await this.db.exec(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      [key, value],
    )
  }

  /** Drive 연동용 키만 초기화(계정 전환 시 · 로컬 식단 DB 본문은 유지) */
  async clearDriveMeta(): Promise<void> {
    for (const k of ['drive_file_id', 'drive_last_remote_modified']) {
      await this.db.exec('DELETE FROM settings WHERE key = ?', [k])
    }
  }

  /** 키 제거(undefined 와 동일하게 쓰고 싶을 때) */
  async deleteKey(key: string): Promise<void> {
    await this.db.exec('DELETE FROM settings WHERE key = ?', [key])
  }
}
