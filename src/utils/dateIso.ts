/** 로컬 날짜를 YYYY-MM-DD 로 포맷 (주간「월~일」·식단 일자 키에 사용) */

export function formatLocalDateIso(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 오늘(로컬)의 meal_entries.date 키 */
export function todayLocalIso(): string {
  return formatLocalDateIso(new Date())
}
