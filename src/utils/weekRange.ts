import { formatLocalDateIso } from '@/utils/dateIso'

/** 월~일 주간 범위 (로컬 TZ) — Issue #7 */
export interface WeekRange {
  /** 월요일 YYYY-MM-DD */
  from: string
  /** 일요일 YYYY-MM-DD */
  to: string
  /** 월→일 7일 ISO 목록 */
  days: string[]
}

/** anchor 날짜가 속한 주의 월요일~일요일 */
export function getWeekRange(anchorIso: string): WeekRange {
  const [y, m, d] = anchorIso.split('-').map(Number)
  const anchor = new Date(y, (m ?? 1) - 1, d ?? 1)
  const jsDay = anchor.getDay()
  const mondayOffset = jsDay === 0 ? -6 : 1 - jsDay
  const monday = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + mondayOffset)
  const days: string[] = []
  for (let i = 0; i < 7; i += 1) {
    const dt = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i)
    days.push(formatLocalDateIso(dt))
  }
  return { from: days[0]!, to: days[6]!, days }
}

/** ISO 날짜 ± N일 */
export function addDaysIso(iso: string, delta: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, (m ?? 1) - 1, (d ?? 1) + delta)
  return formatLocalDateIso(dt)
}

/** anchor 주 ± N주 (같은 요일 anchor 유지) */
export function shiftWeekAnchor(anchorIso: string, weekDelta: number): string {
  return addDaysIso(anchorIso, weekDelta * 7)
}

/** from~to(inclusive) ISO 날짜 목록 — 잘못된 순서면 빈 배열 */
export function enumerateIsoRange(from: string, to: string): string[] {
  if (from > to) return []
  const days: string[] = []
  let cur = from
  while (cur <= to) {
    days.push(cur)
    cur = addDaysIso(cur, 1)
  }
  return days
}
