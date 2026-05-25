/** 최근 체중 × 계수 → 일일 단백질 목표(g) — PRD 도메인 규칙 */

export function dailyProteinTargetKg(weightKg: number, factor: number): number {
  if (!Number.isFinite(weightKg) || weightKg <= 0) return 0
  if (!Number.isFinite(factor) || factor <= 0) return 0
  return weightKg * factor
}

/** 목표 대비 충분 여부 — UI ✅/❌ (칼로리 상한에는 사용 안 함) */
export function proteinTargetMet(actualG: number, targetG: number): boolean | null {
  if (targetG <= 0) return null
  return actualG >= targetG
}
