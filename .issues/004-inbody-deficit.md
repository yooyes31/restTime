---
id: 4
title: 인바디 기록 + 적자칼로리 + 단백질 목표
category: enhancement
state: done
blocked_by: []
type: AFK
user_stories: [23, 24, 25, 26, 27, 28, 29, 43]
---

# 인바디 + 적자 + 단백질 (오늘 요약)

## What to build

인바디: 체중, 골격근량, 체지방률, 하루 소모 칼로리, note. 저장 → `latest_burn_kcal` 갱신. 오늘 카드: 먹은/소모/적자칼로리, 단백질 vs 목표(체중×1.7). BMR/TDEE UI 금지.

## Acceptance criteria

- [x] inbody_logs CRUD + 이력
- [x] 저장 → latest_burn_kcal
- [x] 소모 미설정 시 적자 안내
- [x] protein_factor 기본 1.7

---

## Agent Brief

**Current behavior:** `/inbody` CRUD + `TodaySummaryCard` (적자·단백 목표).

**Acceptance criteria:**

- [x] InBody CRUD + history list
- [x] Burn auto-sync on save
- [x] Deficit shows 「미설정」 when no burn
- [x] Protein target from latest InBody weight × factor (default 1.7)

**Out of scope:**

- InBody device auto-sync
- Weekly view (#7)
