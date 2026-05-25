import { dailyDeficit } from '@/domain/deficitCalculator'
import { dailyProteinTargetKg, proteinTargetMet } from '@/domain/proteinTargetCalculator'
import type { LocalDatabase } from '@/db/LocalDatabase'
import { InBodyService } from '@/services/inBodyService'
import { MealLogService, type MealEntry } from '@/services/mealLogService'
import { SettingsService } from '@/services/settingsService'
import { WeeklySummaryAggregator } from '@/services/weeklySummaryAggregator'
import { WorkoutDayLogService, type WorkoutDayLogEntry } from '@/services/workoutDayLogService'
import { WorkoutPresetService } from '@/services/workoutPresetService'
import { WorkoutService, type WorkoutSession } from '@/services/workoutService'
import type { MealType } from '@/types/domain'
import { enumerateIsoRange, getWeekRange, type WeekRange } from '@/utils/weekRange'
import { isoDateToWeekday, weekdayLabel } from '@/utils/weekday'

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: '아침',
  lunch: '점심',
  dinner: '저녁',
  snack: '간식',
}

/**
 * GPT용 Markdown — 숫자·기록만, 질문·코칭 문구 없음 (Issue #8)
 */
export class GptExportFormatter {
  private readonly meals: MealLogService
  private readonly workout: WorkoutService
  private readonly dayLog: WorkoutDayLogService
  private readonly workoutPreset: WorkoutPresetService
  private readonly inbody: InBodyService
  private readonly settings: SettingsService
  private readonly weekly: WeeklySummaryAggregator

  constructor(db: LocalDatabase) {
    this.meals = new MealLogService(db)
    this.workout = new WorkoutService(db)
    this.dayLog = new WorkoutDayLogService(db)
    this.workoutPreset = new WorkoutPresetService(db)
    this.inbody = new InBodyService(db)
    this.settings = new SettingsService(db)
    this.weekly = new WeeklySummaryAggregator(db)
  }

  /** 하루 블록 */
  async formatDay(date: string): Promise<string> {
    const entries = await this.meals.listByDate(date)
    const totals = await this.meals.getDailyTotals(date)
    const sessions = await this.workout.listByDate(date)
    const { burn, proteinTargetG } = await this.loadTargets()
    const latest = await this.inbody.getLatest()

    const w = weekdayLabel(isoDateToWeekday(date))
    const lines: string[] = [`## ${date} (${w})`, '', '# 식단']

    if (entries.length === 0) {
      lines.push('- (기록 없음)')
    } else {
      for (const e of entries) {
        lines.push(formatMealLine(e))
      }
    }

    const proteinBadge = badgeProtein(totals.protein_g, proteinTargetG)
    const targetPart =
      proteinTargetG !== null && proteinTargetG > 0
        ? ` (목표 ${proteinTargetG.toFixed(1)}g${proteinBadge})`
        : ''
    lines.push(`- 합계: ${Math.round(totals.kcal)} kcal, ${totals.protein_g.toFixed(1)}g 단백질${targetPart}`)
    lines.push('', '# 운동')
    lines.push(...(await this.formatWorkoutBlock(date, sessions)))
    lines.push('', '# 적자')
    lines.push(formatDeficitLine(burn, totals.kcal))

    if (latest) {
      lines.push('', '# 인바디 (최근)')
      lines.push(formatInBodyLine(latest))
    }

    return lines.join('\n')
  }

  /** 월~일 주간 — PRD snippet 형식 */
  async formatWeek(range: WeekRange): Promise<string> {
    const anchor = range.from
    const summary = await this.weekly.buildSummary(anchor)
    const { proteinFactor, proteinTargetG } = await this.loadTargets()
    const factorLabel = proteinFactor.toFixed(1)

    const lines: string[] = [
      `## 이번 주 (${summary.range.from} 월 ~ ${summary.range.to} 일)`,
      '',
      '# 식단',
      `| 요일 | 총 kcal | 단백질 | 목표(체중×${factorLabel}) |`,
      '| --- | ---: | ---: | ---: |',
    ]

    for (let i = 0; i < summary.mealsByDay.length; i += 1) {
      const m = summary.mealsByDay[i]!
      const w = weekdayLabel(isoDateToWeekday(m.date))
      const proteinCell = formatProteinCell(m.protein_g, proteinTargetG)
      const targetCell =
        proteinTargetG !== null && proteinTargetG > 0 ? `${proteinTargetG.toFixed(1)}g` : '—'
      lines.push(`| ${w} | ${Math.round(m.kcal)} | ${proteinCell} | ${targetCell} |`)
    }

    lines.push(
      '',
      `- 일평균 kcal: ${Math.round(summary.avgKcal)}`,
      `- 일평균 단백질: ${summary.avgProtein.toFixed(1)}g${badgeProtein(summary.avgProtein, proteinTargetG)}`,
      '',
      '# 운동',
    )

    for (const day of summary.range.days) {
      const sessions = await this.workout.listByDate(day)
      const dayLines = await this.formatWorkoutBlock(day, sessions)
      const hasContent = dayLines.some((l) => !l.startsWith('- (기록 없음)'))
      if (!hasContent) continue
      const w = weekdayLabel(isoDateToWeekday(day))
      lines.push(`- ${w}:`)
      for (const dl of dayLines) {
        lines.push(`  ${dl}`)
      }
    }
    lines.push(`- 이번 주: ${summary.workoutSessionCount}회`)

    lines.push('', '# 인바디 (최근)')
    if (summary.inbodyRecent.length === 0) {
      lines.push('- (기록 없음)')
    } else {
      for (const log of summary.inbodyRecent) {
        lines.push(formatInBodyLine(log))
      }
      if (summary.inbodyAverage) {
        const a = summary.inbodyAverage
        lines.push(
          `- ${a.count}회 평균 체지방: ${a.body_fat_pct.toFixed(1)}% / 근육 ${a.muscle_kg.toFixed(1)}kg / 소모 ${Math.round(a.burn_kcal)} kcal`,
        )
      }
    }

    lines.push('', '# 일별 적자')
    for (let i = 0; i < summary.deficitsByDay.length; i += 1) {
      const d = summary.deficitsByDay[i]!
      const w = weekdayLabel(isoDateToWeekday(d.date))
      if (d.deficit === null) {
        lines.push(`- ${w}: 소모 미설정`)
      } else {
        const badge = d.deficit >= 0 ? ' ✅' : ' ❌'
        lines.push(`- ${w}: ${Math.round(d.deficit)} kcal${badge}`)
      }
    }

    return lines.join('\n')
  }

  /** 임의 기간 — 일별 블록 + 기간 합계 */
  async formatRange(from: string, to: string): Promise<string> {
    const days = enumerateIsoRange(from, to)
    if (days.length === 0) return '## 기간\n\n(유효한 날짜 범위가 아닙니다)'

    const dayBlocks: string[] = []
    let totalKcal = 0
    let totalProtein = 0
    let sessionCount = 0

    for (const date of days) {
      dayBlocks.push(await this.formatDay(date))
      const totals = await this.meals.getDailyTotals(date)
      totalKcal += totals.kcal
      totalProtein += totals.protein_g
      sessionCount += (await this.workout.listByDate(date)).length
    }

    const summaryLines = [
      '---',
      '',
      `## 기간 합계 (${from} ~ ${to})`,
      '',
      `- 일수: ${days.length}일`,
      `- 총 kcal: ${Math.round(totalKcal)}`,
      `- 총 단백질: ${totalProtein.toFixed(1)}g`,
      `- 일평균 kcal: ${Math.round(totalKcal / days.length)}`,
      `- 일평균 단백질: ${(totalProtein / days.length).toFixed(1)}g`,
      `- 운동 세션: ${sessionCount}회`,
    ]

    return [...dayBlocks, summaryLines.join('\n')].join('\n\n')
  }

  /** 오늘 ISO 기준 이번 주 */
  async formatThisWeek(anchorIso: string): Promise<string> {
    return this.formatWeek(getWeekRange(anchorIso))
  }

  /** 종목 일지 + 세션(메모 포함) */
  private async formatWorkoutBlock(date: string, sessions: WorkoutSession[]): Promise<string[]> {
    const lines: string[] = []
    const entries = await this.dayLog.listByDate(date)

    if (entries.length > 0) {
      lines.push('## 종목')
      for (const e of entries) {
        lines.push(formatDayLogLine(e))
      }
    } else {
      const preset = await this.workoutPreset.getForWeekday(isoDateToWeekday(date))
      if (preset && preset.items.length > 0) {
        lines.push('## 종목 (프리셋 템플릿)')
        for (const it of preset.items) {
          lines.push(formatPresetItemLine(it))
        }
      }
    }

    if (sessions.length > 0) {
      lines.push('## 세션')
      for (const s of sessions) {
        lines.push(formatSessionLine(s))
      }
    }

    if (lines.length === 0) return ['- (기록 없음)']
    return lines
  }

  private async loadTargets(): Promise<{
    burn: number | null
    proteinFactor: number
    proteinTargetG: number | null
  }> {
    const burnRaw = await this.settings.get('latest_burn_kcal')
    const burn =
      burnRaw !== null && burnRaw !== '' && Number.isFinite(Number(burnRaw))
        ? Number(burnRaw)
        : null
    const factorRaw = await this.settings.get('protein_factor')
    const factor = factorRaw ? Number(factorRaw) : 1.7
    const proteinFactor = Number.isFinite(factor) && factor > 0 ? factor : 1.7
    const latest = await this.inbody.getLatest()
    const proteinTargetG =
      latest && latest.weight_kg > 0
        ? dailyProteinTargetKg(latest.weight_kg, proteinFactor)
        : null
    return { burn, proteinFactor, proteinTargetG }
  }
}

function formatDayLogLine(e: WorkoutDayLogEntry): string {
  const base = `- ${e.exercise_name} ${e.sets}×${e.reps}${formatWeight(e.weight_kg)}`
  const memo = e.memo.trim()
  return memo ? `${base} — ${memo}` : base
}

function formatPresetItemLine(it: {
  exercise_name: string
  sets: number
  reps: number
  weight_kg: number | null
}): string {
  return `- ${it.exercise_name} ${it.sets}×${it.reps}${formatWeight(it.weight_kg)}`
}

function formatSessionLine(s: WorkoutSession): string {
  const base = `- ${s.name} ${s.minutes}분`
  const memo = s.memo.trim()
  return memo ? `${base} — ${memo}` : base
}

function formatWeight(kg: number | null): string {
  return kg !== null && kg > 0 ? ` @ ${kg}kg` : ''
}

function formatMealLine(e: MealEntry): string {
  const label = MEAL_LABELS[e.meal_type] ?? e.meal_type
  const memo = e.memo.trim() || '(메모 없음)'
  return `- ${label}: ${memo} — ${Math.round(e.kcal)} kcal, ${e.protein_g.toFixed(1)}g`
}

function formatDeficitLine(burn: number | null, intakeKcal: number): string {
  const d = dailyDeficit(burn, intakeKcal)
  if (!d.ok) return '- 소모 미설정'
  const badge = d.deficit >= 0 ? ' ✅' : ' ❌'
  return `- ${Math.round(d.deficit)} kcal${badge}`
}

function formatInBodyLine(log: {
  measured_at: string
  body_fat_pct: number
  muscle_kg: number
  burn_kcal: number
}): string {
  const date = String(log.measured_at).slice(0, 10)
  return `- ${date}: 체지방 ${log.body_fat_pct}% / 근육 ${log.muscle_kg}kg / 소모 ${Math.round(log.burn_kcal)} kcal`
}

function badgeProtein(actualG: number, targetG: number | null): string {
  if (targetG === null || targetG <= 0) return ''
  const met = proteinTargetMet(actualG, targetG)
  if (met === null) return ''
  return met ? ' ✅' : ' ❌'
}

function formatProteinCell(proteinG: number, targetG: number | null): string {
  const base = `${proteinG.toFixed(1)}g`
  return `${base}${badgeProtein(proteinG, targetG)}`
}
