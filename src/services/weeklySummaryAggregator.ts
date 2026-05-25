import type { SqlValue } from 'sql.js'

import { dailyDeficit } from '@/domain/deficitCalculator'
import { dailyProteinTargetKg, proteinTargetMet } from '@/domain/proteinTargetCalculator'
import type { LocalDatabase } from '@/db/LocalDatabase'
import { InBodyService, type InBodyAverage, type InBodyLog } from '@/services/inBodyService'
import { SettingsService } from '@/services/settingsService'
import { WorkoutService } from '@/services/workoutService'
import { getWeekRange, type WeekRange } from '@/utils/weekRange'

export interface DayMealRow {
  date: string
  kcal: number
  protein_g: number
}

export interface DayDeficitRow {
  date: string
  /** null = 소모 미설정 */
  deficit: number | null
}

export interface DaySessionRow {
  date: string
  count: number
}

export interface WeeklySummary {
  range: WeekRange
  mealsByDay: DayMealRow[]
  sessionsByDay: DaySessionRow[]
  avgKcal: number
  avgProtein: number
  deficitsByDay: DayDeficitRow[]
  workoutSessionCount: number
  proteinTargetG: number | null
  proteinAvgMet: boolean | null
  inbodyRecent: InBodyLog[]
  inbodyAverage: InBodyAverage | null
}

const INBODY_AVG_N = 5

/**
 * 주간(월~일) 식단·적자·운동·인바디 집계 — Issue #7
 */
export class WeeklySummaryAggregator {
  private readonly settings: SettingsService
  private readonly workout: WorkoutService
  private readonly inbody: InBodyService

  constructor(private readonly db: LocalDatabase) {
    this.settings = new SettingsService(db)
    this.workout = new WorkoutService(db)
    this.inbody = new InBodyService(db)
  }

  getWeekRange(anchorIso: string): WeekRange {
    return getWeekRange(anchorIso)
  }

  /** anchor 주 전체 요약 */
  async buildSummary(anchorIso: string): Promise<WeeklySummary> {
    const range = getWeekRange(anchorIso)
    const mealsByDay = await this.aggregateMeals(range)
    const sessionsByDay = await this.aggregateSessions(range)
    const deficitsByDay = await this.aggregateDeficits(mealsByDay)
    const workoutSessionCount = await this.workout.countWeeklySessions({
      from: range.from,
      to: range.to,
    })
    const { recent, average } = await this.inbody.getRecentWithAverage(INBODY_AVG_N)

    const totalKcal = mealsByDay.reduce((s, r) => s + r.kcal, 0)
    const totalProtein = mealsByDay.reduce((s, r) => s + r.protein_g, 0)
    const avgKcal = totalKcal / 7
    const avgProtein = totalProtein / 7

    const factorRaw = await this.settings.get('protein_factor')
    const factor = factorRaw ? Number(factorRaw) : 1.7
    const proteinFactor = Number.isFinite(factor) && factor > 0 ? factor : 1.7
    const latest = await this.inbody.getLatest()
    const proteinTargetG =
      latest && latest.weight_kg > 0
        ? dailyProteinTargetKg(latest.weight_kg, proteinFactor)
        : null
    const proteinAvgMet =
      proteinTargetG !== null && proteinTargetG > 0
        ? proteinTargetMet(avgProtein, proteinTargetG)
        : null

    return {
      range,
      mealsByDay,
      sessionsByDay,
      avgKcal,
      avgProtein,
      deficitsByDay,
      workoutSessionCount,
      proteinTargetG,
      proteinAvgMet,
      inbodyRecent: recent,
      inbodyAverage: average,
    }
  }

  async aggregateMeals(range: WeekRange): Promise<DayMealRow[]> {
    const rows = await this.db.query<Record<string, SqlValue>>(
      `SELECT date, COALESCE(SUM(kcal), 0) AS kcal, COALESCE(SUM(protein_g), 0) AS protein_g
       FROM meal_entries WHERE date >= ? AND date <= ?
       GROUP BY date`,
      [range.from, range.to],
    )
    const byDate = new Map<string, { kcal: number; protein_g: number }>()
    for (const r of rows) {
      byDate.set(String(r.date), {
        kcal: toNumber(r.kcal),
        protein_g: toNumber(r.protein_g),
      })
    }
    return range.days.map((date) => {
      const v = byDate.get(date)
      return { date, kcal: v?.kcal ?? 0, protein_g: v?.protein_g ?? 0 }
    })
  }

  async aggregateSessions(range: WeekRange): Promise<DaySessionRow[]> {
    const rows = await this.db.query<Record<string, SqlValue>>(
      `SELECT date, COUNT(*) AS c FROM workout_sessions
       WHERE date >= ? AND date <= ? GROUP BY date`,
      [range.from, range.to],
    )
    const byDate = new Map<string, number>()
    for (const r of rows) {
      byDate.set(String(r.date), Math.trunc(toNumber(r.c)))
    }
    return range.days.map((date) => ({ date, count: byDate.get(date) ?? 0 }))
  }

  async aggregateDeficits(meals: DayMealRow[]): Promise<DayDeficitRow[]> {
    const burnRaw = await this.settings.get('latest_burn_kcal')
    const burn =
      burnRaw !== null && burnRaw !== '' && Number.isFinite(Number(burnRaw))
        ? Number(burnRaw)
        : null
    return meals.map((m) => {
      if (burn === null) return { date: m.date, deficit: null }
      const d = dailyDeficit(burn, m.kcal)
      return { date: m.date, deficit: d.ok ? d.deficit : null }
    })
  }
}

function toNumber(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}
