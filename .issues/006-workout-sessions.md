---
id: 6
title: 운동 세션 기록
category: enhancement
state: done
blocked_by: []
type: AFK
user_stories: [17, 18, 19, 35]
---

# 운동 세션 기록

## What to build

세션: name + minutes + date. preset_id optional. 하루 N세션. Today 목록.

## Acceptance criteria

- [x] workout_sessions CRUD
- [x] preset_id nullable
- [x] Today 세션 목록

---

## Agent Brief

**Current behavior:** `WorkoutService` + `TodayWorkoutSessionsSection` on Today.

**Acceptance criteria:**

- [x] CRUD sessions; name + minutes required
- [x] Optional preset association
- [x] Multiple sessions per day on Today UI

**Out of scope:**

- Exercise calorie burn
- Weekly view (#7)
