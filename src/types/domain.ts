/** PRD 도메인 공통 타입 (UI/서비스 계층에서 재사용) */

/** 아침/점심/저녁/간식 — 프리셋은 snack 제외 (도메인 규칙) */
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

/** 로컬 주간 계산용: 월=0 … 일=6 */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6
