import type { SqlValue } from 'sql.js'

import type { LocalDatabase } from '@/db/LocalDatabase'
import { SettingsService } from '@/services/settingsService'

export interface InBodyLog {
  id: number
  measured_at: string
  weight_kg: number
  muscle_kg: number
  body_fat_pct: number
  burn_kcal: number
  note: string | null
}

export interface InBodyLogInput {
  measured_at: string
  weight_kg: number
  muscle_kg: number
  body_fat_pct: number
  burn_kcal: number
  note?: string | null
}

export interface InBodyAverage {
  count: number
  weight_kg: number
  muscle_kg: number
  body_fat_pct: number
  burn_kcal: number
}

/**
 * 인바디 로그 CRUD — 저장 시 latest_burn_kcal 동기화 (Issue #4)
 */
export class InBodyService {
  private readonly settings: SettingsService

  constructor(
    private readonly db: LocalDatabase,
    settings?: SettingsService,
  ) {
    this.settings = settings ?? new SettingsService(db)
  }

  async listAll(): Promise<InBodyLog[]> {
    const rows = await this.db.query<Record<string, SqlValue>>(
      `SELECT id, measured_at, weight_kg, muscle_kg, body_fat_pct, burn_kcal, note
       FROM inbody_logs ORDER BY measured_at DESC, id DESC`,
    )
    return rows.map(normalize)
  }

  async getLatest(): Promise<InBodyLog | null> {
    const rows = await this.db.query<Record<string, SqlValue>>(
      `SELECT id, measured_at, weight_kg, muscle_kg, body_fat_pct, burn_kcal, note
       FROM inbody_logs ORDER BY measured_at DESC, id DESC LIMIT 1`,
    )
    return rows[0] ? normalize(rows[0]) : null
  }

  async getRecentWithAverage(n: number): Promise<{ recent: InBodyLog[]; average: InBodyAverage | null }> {
    const recent = (await this.listAll()).slice(0, n)
    if (recent.length === 0) return { recent: [], average: null }
    const sum = recent.reduce(
      (acc, r) => ({
        weight_kg: acc.weight_kg + r.weight_kg,
        muscle_kg: acc.muscle_kg + r.muscle_kg,
        body_fat_pct: acc.body_fat_pct + r.body_fat_pct,
        burn_kcal: acc.burn_kcal + r.burn_kcal,
      }),
      { weight_kg: 0, muscle_kg: 0, body_fat_pct: 0, burn_kcal: 0 },
    )
    const c = recent.length
    return {
      recent,
      average: {
        count: c,
        weight_kg: sum.weight_kg / c,
        muscle_kg: sum.muscle_kg / c,
        body_fat_pct: sum.body_fat_pct / c,
        burn_kcal: sum.burn_kcal / c,
      },
    }
  }

  async add(input: InBodyLogInput): Promise<number> {
    await this.db.exec(
      `INSERT INTO inbody_logs (measured_at, weight_kg, muscle_kg, body_fat_pct, burn_kcal, note)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        input.measured_at,
        input.weight_kg,
        input.muscle_kg,
        input.body_fat_pct,
        input.burn_kcal,
        input.note ?? null,
      ],
    )
    await this.syncBurnFromLatestInBody()
    const idRow = await this.db.query<Record<string, SqlValue>>('SELECT last_insert_rowid() AS id')
    return Math.trunc(toNumber(idRow[0]?.id))
  }

  async update(id: number, patch: Partial<InBodyLogInput>): Promise<void> {
    const parts: string[] = []
    const params: SqlValue[] = []
    if (patch.measured_at !== undefined) {
      parts.push('measured_at = ?')
      params.push(patch.measured_at)
    }
    if (patch.weight_kg !== undefined) {
      parts.push('weight_kg = ?')
      params.push(patch.weight_kg)
    }
    if (patch.muscle_kg !== undefined) {
      parts.push('muscle_kg = ?')
      params.push(patch.muscle_kg)
    }
    if (patch.body_fat_pct !== undefined) {
      parts.push('body_fat_pct = ?')
      params.push(patch.body_fat_pct)
    }
    if (patch.burn_kcal !== undefined) {
      parts.push('burn_kcal = ?')
      params.push(patch.burn_kcal)
    }
    if (patch.note !== undefined) {
      parts.push('note = ?')
      params.push(patch.note)
    }
    if (parts.length === 0) return
    params.push(id)
    await this.db.exec(`UPDATE inbody_logs SET ${parts.join(', ')} WHERE id = ?`, params)
    await this.syncBurnFromLatestInBody()
  }

  async delete(id: number): Promise<void> {
    await this.db.exec('DELETE FROM inbody_logs WHERE id = ?', [id])
    await this.syncBurnFromLatestInBody()
  }

  /** 최신 인바디 burn_kcal → settings — 한글 주석 */
  async syncBurnFromLatestInBody(): Promise<void> {
    const latest = await this.getLatest()
    if (latest) await this.settings.set('latest_burn_kcal', String(latest.burn_kcal))
    else await this.settings.deleteKey('latest_burn_kcal')
  }
}

function toNumber(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

function normalize(raw: Record<string, SqlValue>): InBodyLog {
  const note = raw.note
  return {
    id: Math.trunc(toNumber(raw.id)),
    measured_at: String(raw.measured_at ?? ''),
    weight_kg: toNumber(raw.weight_kg),
    muscle_kg: toNumber(raw.muscle_kg),
    body_fat_pct: toNumber(raw.body_fat_pct),
    burn_kcal: toNumber(raw.burn_kcal),
    note: note === null || note === undefined ? null : String(note),
  }
}
