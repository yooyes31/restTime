import type { SqlValue } from 'sql.js'

import type { LocalDatabase } from '@/db/LocalDatabase'
import type { MealType } from '@/types/domain'

/** 프리셋 meal_type — snack 불가 (PRD) */
export type MealPresetType = Exclude<MealType, 'snack'>

export interface MealPreset {
  id: number
  meal_type: MealPresetType
  name: string
  memo: string
  kcal: number
  protein_g: number
}

export interface MealPresetInput {
  meal_type: MealPresetType
  name: string
  memo?: string
  kcal?: number
  protein_g?: number
}

/**
 * 식단 프리셋 CRUD — Issue #3
 * snack 타입 생성·수정 시 거부 — 한글 주석
 */
export class MealPresetService {
  constructor(private readonly db: LocalDatabase) {}

  async listByMealType(mealType: MealPresetType): Promise<MealPreset[]> {
    const rows = await this.db.query<Record<string, SqlValue>>(
      `SELECT id, meal_type, name, memo, kcal, protein_g
       FROM meal_presets WHERE meal_type = ? ORDER BY name ASC, id ASC`,
      [mealType],
    )
    return rows.map(normalizePreset)
  }

  async getById(id: number): Promise<MealPreset | null> {
    const rows = await this.db.query<Record<string, SqlValue>>(
      `SELECT id, meal_type, name, memo, kcal, protein_g FROM meal_presets WHERE id = ?`,
      [id],
    )
    return rows[0] ? normalizePreset(rows[0]) : null
  }

  async create(input: MealPresetInput): Promise<number> {
    assertPresetType(input.meal_type)
    await this.db.exec(
      `INSERT INTO meal_presets (meal_type, name, memo, kcal, protein_g) VALUES (?, ?, ?, ?, ?)`,
      [
        input.meal_type,
        input.name.trim(),
        input.memo ?? '',
        input.kcal ?? 0,
        input.protein_g ?? 0,
      ],
    )
    const idRow = await this.db.query<Record<string, SqlValue>>('SELECT last_insert_rowid() AS id')
    return Math.trunc(toNumber(idRow[0]?.id))
  }

  async update(id: number, patch: Partial<MealPresetInput>): Promise<void> {
    if (patch.meal_type !== undefined) assertPresetType(patch.meal_type)
    const parts: string[] = []
    const params: SqlValue[] = []
    if (patch.meal_type !== undefined) {
      parts.push('meal_type = ?')
      params.push(patch.meal_type)
    }
    if (patch.name !== undefined) {
      parts.push('name = ?')
      params.push(patch.name.trim())
    }
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
    await this.db.exec(`UPDATE meal_presets SET ${parts.join(', ')} WHERE id = ?`, params)
  }

  async delete(id: number): Promise<void> {
    await this.db.exec('DELETE FROM meal_presets WHERE id = ?', [id])
  }
}

function assertPresetType(t: MealType): asserts t is MealPresetType {
  if (t === 'snack') throw new Error('간식 프리셋은 지원하지 않습니다.')
}

function toNumber(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

function normalizePreset(raw: Record<string, SqlValue>): MealPreset {
  return {
    id: Math.trunc(toNumber(raw.id)),
    meal_type: raw.meal_type as MealPresetType,
    name: String(raw.name ?? ''),
    memo: String(raw.memo ?? ''),
    kcal: toNumber(raw.kcal),
    protein_g: toNumber(raw.protein_g),
  }
}
