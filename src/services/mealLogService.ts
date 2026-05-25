import type { SqlValue } from 'sql.js'

import type { LocalDatabase } from '@/db/LocalDatabase'
import type { MealType } from '@/types/domain'
import { MealPresetService } from '@/services/mealPresetService'

/** SQLite meal_entries 행 — UI·서비스 공통 타입 */
export interface MealEntry {
  id: number
  date: string
  sort_order: number
  meal_type: MealType
  memo: string
  kcal: number
  protein_g: number
}

export interface MealDailyTotals {
  kcal: number
  protein_g: number
}

export interface MealEntryInput {
  date: string
  meal_type: MealType
  memo?: string
  kcal?: number
  protein_g?: number
}

/**
 * 오늘 식단 CRUD 및 일 합계 — Issue #2 Agent Brief 계약 레이어
 * LocalDatabase(exec/query) 로 영속화; 정렬은 sort_order 고정.
 */
export class MealLogService {
  constructor(private readonly db: LocalDatabase) {}

  /** 특정 일자 항목을 정렬 순으로 조회 */
  async listByDate(date: string): Promise<MealEntry[]> {
    const rows = await this.db.query<Record<string, SqlValue>>(
      `SELECT id, date, sort_order, meal_type, memo, kcal, protein_g
       FROM meal_entries WHERE date = ? ORDER BY sort_order ASC, id ASC`,
      [date],
    )
    return rows.map((raw) => normalizeMealRaw(raw))
  }

  /** 해당 일 칼로리·단백질 합계 */
  async getDailyTotals(date: string): Promise<MealDailyTotals> {
    const agg = await this.db.query<Record<string, SqlValue>>(
      `SELECT COALESCE(SUM(kcal), 0) AS total_kcal, COALESCE(SUM(protein_g), 0) AS total_protein
       FROM meal_entries WHERE date = ?`,
      [date],
    )
    const row = agg[0]
    return {
      kcal: toNumber(row?.total_kcal),
      protein_g: toNumber(row?.total_protein),
    }
  }

  /** 항목 추가 — sort_order 는 해당 일 마지막+1 자동 할당 */
  async addEntry(input: MealEntryInput): Promise<number> {
    const maxRows = await this.db.query<Record<string, SqlValue>>(
      `SELECT COALESCE(MAX(sort_order), -1) AS m FROM meal_entries WHERE date = ?`,
      [input.date],
    )
    const nextOrder = Math.trunc(toNumber(maxRows[0]?.m ?? -1)) + 1

    await this.db.exec(
      `INSERT INTO meal_entries (date, sort_order, meal_type, memo, kcal, protein_g)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        input.date,
        nextOrder,
        input.meal_type,
        input.memo ?? '',
        input.kcal ?? 0,
        input.protein_g ?? 0,
      ],
    )
    const idRow = await this.db.query<Record<string, SqlValue>>('SELECT last_insert_rowid() AS id')
    return Math.trunc(toNumber(idRow[0]?.id))
  }

  async updateEntry(id: number, patch: Partial<Pick<MealEntry, 'memo' | 'kcal' | 'protein_g'>>): Promise<void> {
    const parts: string[] = []
    const params: SqlValue[] = []
    if (patch.memo !== undefined) {
      parts.push('memo = ?')
      params.push(patch.memo)
    }
    if (patch.kcal !== undefined) {
      parts.push('kcal = ?')
      params.push(patch.kcal)
    }
    if (patch.protein_g !== undefined) {
      parts.push('protein_g = ?')
      params.push(patch.protein_g)
    }
    if (parts.length === 0) return
    params.push(id)
    await this.db.exec(`UPDATE meal_entries SET ${parts.join(', ')} WHERE id = ?`, params)
  }

  async deleteEntry(id: number): Promise<void> {
    await this.db.exec('DELETE FROM meal_entries WHERE id = ?', [id])
  }

  /**
   * 같은 날 목록 안에서 순서 변경(한 칸 위/아래).
   * @param delta -1 또는 1
   */
  async moveEntryRelative(date: string, id: number, delta: -1 | 1): Promise<void> {
    const list = await this.listByDate(date)
    const idx = list.findIndex((e) => e.id === id)
    const j = idx + delta
    if (idx < 0 || j < 0 || j >= list.length) return

    const a = list[idx]
    const b = list[j]
    const orderA = a.sort_order
    const orderB = b.sort_order
    await this.db.exec(`UPDATE meal_entries SET sort_order = ? WHERE id = ?`, [orderB, a.id])
    await this.db.exec(`UPDATE meal_entries SET sort_order = ? WHERE id = ?`, [orderA, b.id])
  }

  /** 프리셋 → 오늘 meal_entries 1행 (Issue #3) */
  async applyPreset(presetId: number, date: string): Promise<number> {
    const presetSvc = new MealPresetService(this.db)
    const preset = await presetSvc.getById(presetId)
    if (!preset) throw new Error('프리셋을 찾을 수 없습니다.')
    const memo = preset.memo.trim() ? `${preset.name}: ${preset.memo}` : preset.name
    return this.addEntry({
      date,
      meal_type: preset.meal_type,
      memo,
      kcal: preset.kcal,
      protein_g: preset.protein_g,
    })
  }
}

function toNumber(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

/** sql.js 결과를 MealEntry 로 정규화 */
function normalizeMealRaw(raw: Record<string, SqlValue>): MealEntry {
  return {
    id: Math.trunc(toNumber(raw.id)),
    date: String(raw.date ?? ''),
    sort_order: Math.trunc(toNumber(raw.sort_order)),
    meal_type: raw.meal_type as MealType,
    memo: String(raw.memo ?? ''),
    kcal: toNumber(raw.kcal),
    protein_g: toNumber(raw.protein_g),
  }
}
