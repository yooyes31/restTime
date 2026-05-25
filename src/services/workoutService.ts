import type { SqlValue } from 'sql.js'

import type { LocalDatabase } from '@/db/LocalDatabase'

export interface WorkoutSession {
  id: number
  date: string
  preset_id: number | null
  name: string
  minutes: number
  memo: string
}

export interface WorkoutSessionInput {
  date: string
  name: string
  minutes: number
  memo?: string
  preset_id?: number | null
}

export interface DateRangeIso {
  /** inclusive YYYY-MM-DD */
  from: string
  to: string
}

/**
 * 운동 세션 CRUD — Issue #6
 * preset_id nullable · 하루 N세션 — 한글 주석
 */
export class WorkoutService {
  constructor(private readonly db: LocalDatabase) {}

  async listByDate(date: string): Promise<WorkoutSession[]> {
    const rows = await this.db.query<Record<string, SqlValue>>(
      `SELECT id, date, preset_id, name, minutes, memo
       FROM workout_sessions WHERE date = ? ORDER BY created_at ASC, id ASC`,
      [date],
    )
    return rows.map(normalize)
  }

  /** 주간(또는 임의 기간) 세션 횟수 — #7 집계에서 재사용 */
  async countWeeklySessions(range: DateRangeIso): Promise<number> {
    const rows = await this.db.query<Record<string, SqlValue>>(
      `SELECT COUNT(*) AS c FROM workout_sessions WHERE date >= ? AND date <= ?`,
      [range.from, range.to],
    )
    return Math.trunc(toNumber(rows[0]?.c))
  }

  async addSession(input: WorkoutSessionInput): Promise<number> {
    const name = input.name.trim()
    if (!name) throw new Error('운동 이름을 입력해 주세요.')
    await this.db.exec(
      `INSERT INTO workout_sessions (date, preset_id, name, minutes, memo) VALUES (?, ?, ?, ?, ?)`,
      [input.date, input.preset_id ?? null, name, input.minutes, (input.memo ?? '').trim()],
    )
    const idRow = await this.db.query<Record<string, SqlValue>>('SELECT last_insert_rowid() AS id')
    return Math.trunc(toNumber(idRow[0]?.id))
  }

  async updateSession(
    id: number,
    patch: Partial<Pick<WorkoutSessionInput, 'name' | 'minutes' | 'preset_id' | 'memo'>>,
  ): Promise<void> {
    const parts: string[] = []
    const params: SqlValue[] = []
    if (patch.name !== undefined) {
      parts.push('name = ?')
      params.push(patch.name.trim())
    }
    if (patch.minutes !== undefined) {
      parts.push('minutes = ?')
      params.push(patch.minutes)
    }
    if (patch.preset_id !== undefined) {
      parts.push('preset_id = ?')
      params.push(patch.preset_id)
    }
    if (patch.memo !== undefined) {
      parts.push('memo = ?')
      params.push(patch.memo.trim())
    }
    if (parts.length === 0) return
    params.push(id)
    await this.db.exec(`UPDATE workout_sessions SET ${parts.join(', ')} WHERE id = ?`, params)
  }

  async deleteSession(id: number): Promise<void> {
    await this.db.exec('DELETE FROM workout_sessions WHERE id = ?', [id])
  }
}

function toNumber(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

function normalize(raw: Record<string, SqlValue>): WorkoutSession {
  const pid = raw.preset_id
  return {
    id: Math.trunc(toNumber(raw.id)),
    date: String(raw.date ?? ''),
    preset_id: pid === null || pid === undefined || pid === '' ? null : Math.trunc(toNumber(pid)),
    name: String(raw.name ?? ''),
    minutes: Math.trunc(toNumber(raw.minutes)),
    memo: String(raw.memo ?? ''),
  }
}
