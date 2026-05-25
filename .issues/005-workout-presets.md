---
id: 5
title: 운동 프리셋 (요일별 루틴 + 종목)
category: enhancement
state: done
blocked_by: []
type: AFK
user_stories: [20, 21, 22, 47, 48]
---

# 운동 프리셋 (요일별)

## What to build

월~일 요일당 프리셋 1개. 종목: exercise_name, sets, reps, weight_kg(선택), sort_order. 오늘 요일 프리셋 체크리스트 on Today.

## Acceptance criteria

- [x] workout_presets + items CRUD
- [x] weekday당 1 프리셋
- [x] 오늘 요일 프리셋 표시

---

## Agent Brief

**Current behavior:** `/workout-presets` + Today 읽기 전용 체크리스트.

**Acceptance criteria:**

- [x] CRUD presets and exercises with sort_order
- [x] One preset per weekday (v1)
- [x] Today view shows current weekday preset

**Out of scope:**

- Workout session logging (#6)
- Session check-off persistence (optional v1.1)
