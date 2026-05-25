/** 적자칼로리 = 하루 소모 − 먹은 칼로리 — BMR/TDEE 용어 UI 금지 */

export type DeficitResult =
  | { ok: true; deficit: number }
  | { ok: false; reason: 'burn_unset' }

export function dailyDeficit(burnKcal: number | null | undefined, intakeKcal: number): DeficitResult {
  if (burnKcal === null || burnKcal === undefined || !Number.isFinite(burnKcal)) {
    return { ok: false, reason: 'burn_unset' }
  }
  return { ok: true, deficit: burnKcal - intakeKcal }
}
