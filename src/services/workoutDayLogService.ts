import type { SqlValue } from 'sql.js'

import type { LocalDatabase } from '@/db/LocalDatabase'

/** 오늘(특정 일) 실제 수행 종목 — 프리셋과 별도 저장 (Issue follow-up) */
export interface WorkoutDayLogEntry {
  id: number
  date: string
  sort_order: number
  exercise_name: string
  sets: number
  reps: number
  weight_kg: number | null
  memo: string
}

export interface WorkoutDayLogInput {
  exercise_name: string
  sets: number
  reps: number
  weight_kg?: number | null
  memo?: string
}

/**
 * 날짜별 운동 종목 로그 — 프리셋 템플릿과 분리, 오늘 화면에서 수정
 */
export class WorkoutDayLogService {
  constructor(private readonly db: LocalDatabase) {}

  async listByDate(date: string): Promise<WorkoutDayLogEntry[]> {
    const rows = await this.db.query<Record<string, SqlValue>>(
      `SELECT id, date, sort_order, exercise_name, sets, reps, weight_kg, memo
       FROM workout_day_log WHERE date = ? ORDER BY sort_order ASC, id ASC`,
      [date],
    )
    return rows.map(normalize)
  }

  /** 해당 일 전체 교체 저장 */
  async replaceForDate(date: string, items: WorkoutDayLogInput[]): Promise<void> {
    await this.db.exec('DELETE FROM workout_day_log WHERE date = ?', [date])
    let order = 0
    for (const it of items) {
      const name = it.exercise_name.trim()
      if (!name) continue
      await this.db.exec(
        `INSERT INTO workout_day_log (date, sort_order, exercise_name, sets, reps, weight_kg, memo)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [date, order, name, it.sets, it.reps, it.weight_kg ?? null, (it.memo ?? '').trim()],
      )
      order += 1
    }
  }

  /** 프리셋 종목 → 오늘 일지 입력 형태 */
  static fromPresetItems(
    items: { exercise_name: string; sets: number; reps: number; weight_kg: number | null }[],
  ): WorkoutDayLogInput[] {
    return items.map((it) => ({
      exercise_name: it.exercise_name,
      sets: it.sets,
      reps: it.reps,
      weight_kg: it.weight_kg,
      memo: '',
    }))
  }
}

function toNumber(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

function normalize(raw: Record<string, SqlValue>): WorkoutDayLogEntry {
  const w = raw.weight_kg
  return {
    id: Math.trunc(toNumber(raw.id)),
    date: String(raw.date ?? ''),
    sort_order: Math.trunc(toNumber(raw.sort_order)),
    exercise_name: String(raw.exercise_name ?? ''),
    sets: Math.trunc(toNumber(raw.sets)),
    reps: Math.trunc(toNumber(raw.reps)),
    weight_kg: w === null || w === undefined || w === '' ? null : toNumber(w),
    memo: String(raw.memo ?? ''),
  }
}
