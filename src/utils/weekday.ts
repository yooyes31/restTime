import type { Weekday } from '@/types/domain'

/** JS Date.getDay() 0=일…6=토 → PRD weekday 0=월…6=일 — 한글 주석 */
export function dateToWeekday(d: Date): Weekday {
  return ((d.getDay() + 6) % 7) as Weekday
}

/** ISO date 문자열(로컬) → PRD weekday */
export function isoDateToWeekday(iso: string): Weekday {
  const [y, m, day] = iso.split('-').map(Number)
  return dateToWeekday(new Date(y, (m ?? 1) - 1, day ?? 1))
}

export const WEEKDAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'] as const

export function weekdayLabel(w: Weekday): string {
  return WEEKDAY_LABELS[w]
}

export const ALL_WEEKDAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6]
