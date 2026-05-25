import type { SqlValue } from 'sql.js'

import type { LocalDatabase } from '@/db/LocalDatabase'
import type { Weekday } from '@/types/domain'

export interface WorkoutPreset {
  id: number
  name: string
  weekday: Weekday
}

export interface WorkoutPresetItem {
  id: number
  preset_id: number
  sort_order: number
  exercise_name: string
  sets: number
  reps: number
  weight_kg: number | null
}

export interface WorkoutPresetWithItems {
  preset: WorkoutPreset
  items: WorkoutPresetItem[]
}

export interface WorkoutPresetItemInput {
  exercise_name: string
  sets: number
  reps: number
  weight_kg?: number | null
}

/**
 * 요일별 운동 프리셋 — weekday UNIQUE (Issue #5)
 */
export class WorkoutPresetService {
  constructor(private readonly db: LocalDatabase) {}

  async getForWeekday(weekday: Weekday): Promise<WorkoutPresetWithItems | null> {
    const presets = await this.db.query<Record<string, SqlValue>>(
      `SELECT id, name, weekday FROM workout_presets WHERE weekday = ? LIMIT 1`,
      [weekday],
    )
    const raw = presets[0]
    if (!raw) return null
    const preset = normalizePreset(raw)
    const items = await this.listItems(preset.id)
    return { preset, items }
  }

  async listItems(presetId: number): Promise<WorkoutPresetItem[]> {
    const rows = await this.db.query<Record<string, SqlValue>>(
      `SELECT id, preset_id, sort_order, exercise_name, sets, reps, weight_kg
       FROM workout_preset_items WHERE preset_id = ? ORDER BY sort_order ASC, id ASC`,
      [presetId],
    )
    return rows.map(normalizeItem)
  }

  /** 기존 프리셋 이름·종목 갱신 (id 유지 — 세션 preset_id 보존) */
  async updatePreset(presetId: number, name: string, items: WorkoutPresetItemInput[]): Promise<void> {
    await this.db.exec('UPDATE workout_presets SET name = ? WHERE id = ?', [name.trim(), presetId])
    await this.db.exec('DELETE FROM workout_preset_items WHERE preset_id = ?', [presetId])
    let order = 0
    for (const it of items) {
      await this.db.exec(
        `INSERT INTO workout_preset_items (preset_id, sort_order, exercise_name, sets, reps, weight_kg)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [presetId, order, it.exercise_name.trim(), it.sets, it.reps, it.weight_kg ?? null],
      )
      order += 1
    }
  }

  /** 요일 프리셋 저장 — existingId 있으면 해당 preset+items 전부 교체 */
  async savePresetForWeekday(
    weekday: Weekday,
    name: string,
    items: WorkoutPresetItemInput[],
    replaceExistingId?: number | null,
  ): Promise<number> {
    if (replaceExistingId) {
      await this.db.exec('DELETE FROM workout_preset_items WHERE preset_id = ?', [replaceExistingId])
      await this.db.exec('DELETE FROM workout_presets WHERE id = ?', [replaceExistingId])
    }
    await this.db.exec(`INSERT INTO workout_presets (name, weekday) VALUES (?, ?)`, [name.trim(), weekday])
    const idRow = await this.db.query<Record<string, SqlValue>>('SELECT last_insert_rowid() AS id')
    const presetId = Math.trunc(toNumber(idRow[0]?.id))
    let order = 0
    for (const it of items) {
      await this.db.exec(
        `INSERT INTO workout_preset_items (preset_id, sort_order, exercise_name, sets, reps, weight_kg)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          presetId,
          order,
          it.exercise_name.trim(),
          it.sets,
          it.reps,
          it.weight_kg ?? null,
        ],
      )
      order += 1
    }
    return presetId
  }

  async deletePreset(id: number): Promise<void> {
    await this.db.exec('DELETE FROM workout_presets WHERE id = ?', [id])
  }

  async moveItemRelative(presetId: number, itemId: number, delta: -1 | 1): Promise<void> {
    const list = await this.listItems(presetId)
    const idx = list.findIndex((e) => e.id === itemId)
    const j = idx + delta
    if (idx < 0 || j < 0 || j >= list.length) return
    const a = list[idx]
    const b = list[j]
    await this.db.exec(`UPDATE workout_preset_items SET sort_order = ? WHERE id = ?`, [b.sort_order, a.id])
    await this.db.exec(`UPDATE workout_preset_items SET sort_order = ? WHERE id = ?`, [a.sort_order, b.id])
  }
}

function toNumber(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

function normalizePreset(raw: Record<string, SqlValue>): WorkoutPreset {
  return {
    id: Math.trunc(toNumber(raw.id)),
    name: String(raw.name ?? ''),
    weekday: Math.trunc(toNumber(raw.weekday)) as Weekday,
  }
}

function normalizeItem(raw: Record<string, SqlValue>): WorkoutPresetItem {
  const w = raw.weight_kg
  return {
    id: Math.trunc(toNumber(raw.id)),
    preset_id: Math.trunc(toNumber(raw.preset_id)),
    sort_order: Math.trunc(toNumber(raw.sort_order)),
    exercise_name: String(raw.exercise_name ?? ''),
    sets: Math.trunc(toNumber(raw.sets)),
    reps: Math.trunc(toNumber(raw.reps)),
    weight_kg: w === null || w === undefined || w === '' ? null : toNumber(w),
  }
}
