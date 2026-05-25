# PRD: restTime — 식단·운동·인바디 기록 및 GPT 복붙 앱

**버전:** v1  
**상태:** Draft → ready-for-agent  
**최종 업데이트:** 2026-05-23

---

## Problem Statement

개인이 식단, 운동, 인바디(체성분) 데이터를 꾸준히 기록하고 싶지만, 기존 앱들은 다음 문제가 있다.

- 매일 같은 식단·운동을 반복 입력해야 해서 **기록 부담**이 크다.
- 장기 목표(체중 감량 등) 중심 UI가 많고, **이번 주 잘 지켰는지**(단백질, 칼로리, 운동 횟수)를 빠르게 확인하기 어렵다.
- ChatGPT에게 피드백을 받으려면 매번 **데이터를 손으로 정리**해야 한다.
- 폰에서 기록하고 PC에서 리뷰하거나, 그 반대로 **기기 간 데이터를 옮기기** 번거롭다.
- 인바디 수치는 들쭉날쭉한데, **최신값과 추이**를 함께 보고 싶다.
- BMR, TDEE 같은 **전문 용어** 없이, 「적자칼로리」처럼 이해하기 쉬운 표현으로 daily check를 하고 싶다.

---

## Solution

**Vue 3 PWA** 개인용 앱으로 식단·운동·인바디를 기록하고, **Google Drive에 SQLite 백업**으로 기기 간 동기화하며, **숫자·기록만 담긴 Markdown**을 한 번에 복사해 ChatGPT에 붙여넣을 수 있게 한다.

핵심 가치:

1. **주간 실행 체크** — 월~일 기준 칼로리·단백질 일평균, 운동 횟수, 적자칼로리
2. **프리셋으로 입력 최소화** — 반복 식단(끼니별), 반복 운동(요일별 루틴)
3. **GPT 복붙 워크플로** — 질문 없이 데이터만 전달, GPT 앱에서 자유롭게 질문
4. **인바디 연동 루프** — 측정 시 「하루 소모 칼로리」 자동 갱신 → 적자칼로리 계산
5. **개인용 v1, 확장 가능 구조** — v2에서 FastAPI + MariaDB + JWT 다중 사용자

---

## User Stories

### 인증·동기화

1. As a 사용자, I want Google 계정으로 로그인하고 싶다, so that 개인 Google Drive에 내 데이터를 연결할 수 있다.
2. As a 사용자, I want 「Drive에서 불러오기」 버튼으로 다른 기기의 최신 DB를 가져오고 싶다, so that 폰에서 기록한 데이터를 PC에서 이어서 볼 수 있다.
3. As a 사용자, I want 「Drive에 저장하기」 버튼으로 현재 DB를 Drive에 올리고 싶다, so that 기기를 바꿀 때 데이터를 잃지 않는다.
4. As a 사용자, I want Drive에 더 새로운 백업이 있을 때 저장 전에 경고받고 싶다, so that 실수로 덮어쓰지 않는다.
5. As a 사용자, I want 한 번에 한 기기에서만 DB를 수정한다, so that SQLite 파일 손상·충돌을 피할 수 있다.
6. As a 사용자, I want v1에서 별도 서버 없이 앱을 쓰고 싶다, so that 배포·유지가 간단하다.

### 오늘 화면 — 식단

7. As a 사용자, I want 하루 식단을 순서 있는 목록으로 관리하고 싶다, so that 아침→간식→점심→… 실제 먹은 순서대로 기록할 수 있다.
8. As a 사용자, I want 「+ 끼니 추가」로 아침/점심/저녁/간식 항목을 추가하고 싶다, so that 고정 3칸이 아닌 유연하게 기록할 수 있다.
9. As a 사용자, I want 각 끼니에 음식 메모, kcal, 단백질(g)을 입력하고 싶다, so that GPT에 보낼 숫자와 맥락을 동시에 남길 수 있다.
10. As a 사용자, I want 간식은 프리셋 없이 항상 수동 입력하고 싶다, so that 예외적인 간식을 빠르게 적을 수 있다.
11. As a 사용자, I want 오늘 총 kcal과 총 단백질이 자동 합산되길 원한다, so that 매번 계산하지 않아도 된다.
12. As a 사용자, I want 아침/점심/저녁용 식단 프리셋을 저장하고 싶다, so that 자주 먹는 조합을 한 번에 채울 수 있다.
13. As a 사용자, I want 프리셋을 끼니 타입(아침/점심/저녁)별로 분류해 선택하고 싶다, so that 점심 프리셋만 빠르게 찾을 수 있다.
14. As a 사용자, I want 프리셋 적용 시 메모·kcal·단백질이 한 번에 채워지길 원한다, so that 입력 탭 수를 줄일 수 있다.
15. As a 사용자, I want 프리셋 적용 후 값을 수정할 수 있길 원한다, so that 그날만 다른 양을 반영할 수 있다.
16. As a 사용자, I want 같은 타입(예: 간식)을 하루에 여러 번 추가하고 싶다, so that 간식 여러 번을 각각 기록할 수 있다.

### 오늘 화면 — 운동

17. As a 사용자, I want 운동을 세션 단위(종류 + 시간(분))로 기록하고 싶다, so that 하루에 여러 번 운동해도 구분할 수 있다.
18. As a 사용자, I want 운동 기록 시 해당 날의 프리셋(예: Push Day)을 연결하고 싶다, so that 무슨 루틴을 했는지 남길 수 있다.
19. As a 사용자, I want 프리셋 없이 자유 텍스트 운동도 기록하고 싶다, so that 계획 밖 운동도 입력할 수 있다.
20. As a 사용자, I want 요일별 운동 프리셋(월=Push, 수=Pull 등)을 만들고 싶다, so that 운동 전 오늘 할 종목을 바로 볼 수 있다.
21. As a 사용자, I want 운동 프리셋에 종목·세트×횟수·중량(목표)를 넣고 싶다, so that 운동 중 체크리스트처럼 사용할 수 있다.
22. As a 사용자, I want 오늘 해당 요일의 프리셋이 홈에 표시되길 원한다, so that 「오늘 뭐 하지?」를 앱에서 바로 확인할 수 있다.

### 오늘 화면 — 인바디·적자

23. As a 사용자, I want 인바디 측정 후 체중, 골격근량, 체지방률, 하루 소모 칼로리를 입력하고 싶다, so that 가정용 인바디 화면 값을 그대로 옮길 수 있다.
24. As a 사용자, I want 인바디 측정 빈도를 강제받지 않고 자유롭게 기록하고 싶다, so that 재고 싶을 때만 입력할 수 있다.
25. As a 사용자, I want 인바디 저장 시 「평소 하루 쓰는 칼로리」 설정이 자동 갱신되길 원한다, so that 적자칼로리 계산에 최신 소모량이 반영된다.
26. As a 사용자, I want BMR/TDEE 같은 용어 없이 「먹은 칼로리」「하루 소모 칼로리」「적자칼로리」로 보고 싶다, so that 직관적으로 이해할 수 있다.
27. As a 사용자, I want 적자칼로리 = 하루 소모 칼로리 − 먹은 칼로리를 오늘 화면에서 보고 싶다, so that 그날 섭취가 소모 대비 어땠는지 바로 알 수 있다.
28. As a 사용자, I want 단백질 목표가 최근 인바디 체중 × 1.7g으로 자동 계산되길 원한다, so that 근육 유지 최소선을 매번 계산하지 않아도 된다.
29. As a 사용자, I want 오늘 단백질 섭취가 목표 대비 충분한지 표시되길 원한다, so that 실행 여부를 즉시 확인할 수 있다.

### 주간 화면 (월~일)

30. As a 사용자, I want 주간 뷰가 월요일~일요일 기준임을 원한다, so that 한 주 단위로 식단·운동을 리뷰할 수 있다.
31. As a 사용자, I want 요일별 총 kcal과 단백질을 표로 보고 싶다, so that 패턴을 한눈에 파악할 수 있다.
32. As a 사용자, I want 주간 일평균 kcal과 일평균 단백질을 보고 싶다, so that GPT 없이도 이번 주 전반을 판단할 수 있다.
33. As a 사용자, I want 주간 일평균 단백질을 체중×1.7g 목표와 비교하고 싶다, so that 근육 유지 식단을 지켰는지 확인할 수 있다.
34. As a 사용자, I want 칼로리에 대해 「1900 미만」 같은 상한 목표 ✅/❌는 없길 원한다, so that 숫자만 보고 GPT·본인이 해석할 수 있다.
35. As a 사용자, I want 이번 주 운동 횟수(세션 수)를 보고 싶다, so that 운동 빈도를 추적할 수 있다.
36. As a 사용자, I want 요일별 적자칼로리를 주간에서 보고 싶다, so that 주간 적자 패턴을 확인할 수 있다.
37. As a 사용자, I want 인바디 최근 기록과 N회 평균(체지방 등)을 주간/GPT 영역에서 보고 싶다, so that 들쭉날쭉한 수치를 추이로 이해할 수 있다.

### GPT 복붙

38. As a 사용자, I want 「오늘」「이번 주(월~일)」「기간 선택」 프리셋으로 GPT용 Markdown을 생성하고 싶다, so that 상황에 맞게 빠르게 복사할 수 있다.
39. As a 사용자, I want 「GPT용 복사」 한 번으로 클립보드에 담기길 원한다, so that ChatGPT 앱/웹에 바로 붙여넣을 수 있다.
40. As a 사용자, I want GPT 템플릿에 질문 문구를 포함하지 않길 원한다, so that 숫자·기록만 보내고 질문은 GPT에서 직접 할 수 있다.
41. As a 사용자, I want GPT 출력에 식단(끼니별 메모·kcal·단백질), 운동, 인바디 추이, 적자칼로리, 주간 평균이 포함되길 원한다, so that GPT가 맥락 없이도 분석할 수 있다.
42. As a 사용자, I want 폰에서도 GPT 복붙·주간 리뷰를 할 수 있길 원한다, so that PC 없이도 피드백 루프를 돌릴 수 있다.

### 설정

43. As a 사용자, I want 단백질 계수(기본 1.7g/kg)를 설정에서 변경하고 싶다, so that 개인 기준에 맞출 수 있다.
44. As a 사용자, I want Google Drive 백업 파일 위치/이름이 일관되길 원한다, so that sync를 예측 가능하게 쓸 수 있다.
45. As a 사용자, I want 오프라인에서도 기록하고, 온라인 시 Drive sync를 하고 싶다, so that 네트워크 없을 때도 입력할 수 있다.

### 프리셋 관리

46. As a 사용자, I want 식단 프리셋을 CRUD(생성·수정·삭제)하고 싶다, so that 식단이 바뀔 때 프리셋을 갱신할 수 있다.
47. As a 사용자, I want 운동 프리셋과 요일 매핑을 CRUD하고 싶다, so that 루틴 변경 시 스케줄을 조정할 수 있다.
48. As a 사용자, I want 운동 프리셋 내 종목 순서를 관리하고 싶다, so that 운동 순서대로 체크할 수 있다.

### PWA·UX

49. As a 사용자, I want 모바일·PC 브라우저에서 같은 PWA를 쓰고 싶다, so that 기기별 앱을 따로 만들 필요가 없다.
50. As a 사용자, I want 모바일에서 입력 UI가 한 손으로 빠르게 동작하길 원한다, so that 식당·헬스장에서도 기록할 수 있다.
51. As a 사용자, I want PC에서 주간 표·GPT 미리보기가 넓은 화면에 잘 보이길 원한다, so that 리뷰가 편하다.

---

## Implementation Decisions

### 아키텍처

- **v1:** Vue 3 + Element Plus **PWA**, 브라우저 **SQLite** (wa-sqlite 등), **백엔드 없음**
- **인증·동기화:** Google Identity Services (OAuth PKCE) + Google Drive API, 프론트엔드에서만 처리
- **v2 (Out of Scope):** FastAPI + MariaDB + JWT 다중 사용자
- **배포:** 정적 호스팅 (Cloudflare Pages, GitHub Pages 등)
- **동기화 모델:** 한 기기씩 사용; 수동 「Drive 불러오기」「Drive 저장하기」; Drive에 더 새 파일 있으면 저장 전 확인

### 핵심 모듈 (Deep Modules)

사용자 확인 완료. 각 모듈은 단순 공개 인터페이스 + 내부 복잡도 캡슐화.

| 모듈 | 책임 | 공개 인터페이스 (개념) |
|---|---|---|
| **LocalDatabase** | SQLite 초기화, 마이그레이션, CRUD 실행 | `query()`, `exec()`, `exportBlob()`, `importBlob()` |
| **MealLogService** | 끼니 항목 CRUD, 일/주 합계, 프리셋 적용 | `addEntry()`, `listByDate()`, `getDailyTotals()`, `applyPreset()` |
| **MealPresetService** | 아침/점심/저녁 프리셋 CRUD (간식 제외) | `listByMealType()`, `create()`, `update()`, `delete()` |
| **WorkoutService** | 세션 CRUD, 주간 횟수 집계 | `addSession()`, `listByDate()`, `countWeeklySessions()` |
| **WorkoutPresetService** | 요일별 프리셋, 종목·세트 목표 CRUD | `getForWeekday()`, `createPreset()`, `listExercises()` |
| **InBodyService** | 인바디 로그 CRUD, 최근 N회·평균 | `addLog()`, `getLatest()`, `getRecentWithAverage(n)` |
| **SettingsService** | 단백질 계수, 최신 소모 칼로리 등 | `get()`, `update()`, `syncBurnFromLatestInBody()` |
| **ProteinTargetCalculator** | 최근 체중 × 계수 → 일일 단백질 목표 | `dailyTargetKg(weightKg, factor)` |
| **DeficitCalculator** | 적자칼로리 = 소모 − 섭취 | `dailyDeficit(burnKcal, intakeKcal)` |
| **WeeklySummaryAggregator** | 월~일 주간 범위, 일별·평균 집계 | `getWeekRange(date)`, `aggregateMeals()`, `aggregateDeficits()` |
| **GptExportFormatter** | 숫자·기록만 Markdown 생성 (질문 없음) | `formatDay(date)`, `formatWeek(range)`, `formatRange(from, to)` |
| **GoogleAuthService** | OAuth 로그인·토큰 갱신 | `signIn()`, `signOut()`, `getAccessToken()` |
| **GoogleDriveSyncService** | DB blob 업/다운, 충돌 감지 | `pull()`, `push()`, `checkRemoteNewer()` |

### 데이터 스키마 (개념)

```
meal_entries
  id, date, sort_order, meal_type (breakfast|lunch|dinner|snack)
  memo, kcal, protein_g, created_at

meal_presets
  id, meal_type (breakfast|lunch|dinner only), name, memo, kcal, protein_g

workout_sessions
  id, date, preset_id (nullable), name, minutes, created_at

workout_presets
  id, name, weekday (0=Mon .. 6=Sun)

workout_preset_items
  id, preset_id, sort_order, exercise_name, sets, reps, weight_kg (nullable)

inbody_logs
  id, measured_at, weight_kg, muscle_kg, body_fat_pct, burn_kcal, note (nullable)

settings
  key, value   -- protein_factor (default 1.7), latest_burn_kcal, ...
```

**향후 v2 확장:** `user_id` 컬럼 추가, settings per user.

### 도메인 규칙

1. **주간 범위:** ISO 아님 — **월요일 00:00 ~ 일요일 23:59** (로컬 타임존)
2. **단백질 목표:** `최근 inbody_logs.weight_kg × settings.protein_factor` (기본 1.7)
3. **칼로리:** 일별·주간 **총 kcal 숫자만** — 상한 목표 ✅/❌ 없음
4. **적자칼로리:** `settings.latest_burn_kcal`(최근 인바디) − 당일 `sum(meal_entries.kcal)`; 인바디 없으면 「소모 미설정」 표시
5. **인바디 저장 시:** `settings.latest_burn_kcal` 자동 갱신 (`InBodyService` → `SettingsService`)
6. **GPT 템플릿:** 질문·코칭 문구 **포함 금지** — 표, 숫자, ✅/❌(단백질·적자만)만
7. **식단 프리셋:** `meal_type`이 snack인 프리셋 **불가**
8. **운동 프리셋:** 요일당 0~1 프리셋 (중복 시 UX 정책: 최신 또는 사용자 선택 — v1은 1개 권장)

### GPT Export 형식 (결정 스니ippet)

```markdown
## 이번 주 (YYYY-MM-DD 월 ~ YYYY-MM-DD 일)

# 식단
| 요일 | 총 kcal | 단백질 | 목표(체중×1.7) |
...

# 운동
- 월: Push Day 45분
- 이번 주: N회

# 인바디 (최근)
- 날짜: 체지방 X% / 근육 Ykg / 소모 Z kcal
- N회 평균 체지방: ...

# 일별 적자
- 월: N kcal / ...
```

### Google Drive Sync

- 백업 파일: 고정 경로 (예: `restTime/health.db` 또는 `.sqlite`)
- `pull()`: Drive에서 다운로드 → `LocalDatabase.importBlob()`
- `push()`: `LocalDatabase.exportBlob()` → Drive 업로드
- `checkRemoteNewer()`: 로컬 `last_synced_at` vs Drive `modifiedTime`

### UI 화면 (v1)

1. **오늘** — 식단 목록(+추가), 운동 세션, 오늘 프리셋(운동), 인바디 빠른입력, 적자·단백질 요약
2. **주간** — 월~일 표, 일평균, 운동 횟수, 인바디 미니 추이
3. **식단 프리셋** — 타입별 목록·편집
4. **운동 프리셋** — 요일별·종목 편집
5. **인바디 기록** — 이력·입력
6. **설정** — 단백질 계수, Drive sync, 로그아웃
7. **GPT 복사** — 프리셋·기간·미리보기·복사

### 기술 스택

- Vue 3, Vite, Element Plus, PWA plugin
- wa-sqlite ( 또는 sql.js ) + OPFS/IndexedDB persistence
- Google Identity Services, Google Drive API v3
- TypeScript 권장 (집계·포맷터 타입 안전)

---

## Testing Decisions

**v1:** 사용자 결정 — **자동 테스트 작성 보류**. PRD에 추천만 기록.

### 좋은 테스트의 기준 (v1.1+ 적용 시)

- **외부 동작만** 검증 — 내부 private 함수·DB 쿼리 문자열 assert 금지
- Given 날짜/입력 데이터 → When 서비스/포맷터 호출 → Then **사용자可见 결과**(합계, Markdown, 적자) assert
- Google Drive·OAuth는 **mock**; 순수 함수 모듈 우선

### 우선 테스트 추천 모듈 (v1.1)

1. **DeficitCalculator** — 소모/섭취 조합, 인바디 미설정
2. **ProteinTargetCalculator** — 체중×계수, 반올림 정책
3. **WeeklySummaryAggregator** — 월~일 경계, 빈 날, 일평균
4. **GptExportFormatter** — 질문 미포함, 주간 표 행 수, 인바디 평균 줄
5. **MealLogService** — 끼니 합계, sort_order, 프리셋 적용 후 수정

**Prior art:** greenfield — 테스트 패턴은 v1.1에서 Vitest + 서비스 레이어 단위 테스트로 확립.

---

## Out of Scope

### v1 제외

- Flask / FastAPI 백엔드
- 다중 사용자·회원가입 (JWT)
- MariaDB
- InBody 기기 블루투스/Wi‑Fi 자동 연동
- 인바디 결과지 OCR
- GPT API 직접 연동 (앱 내 ChatGPT 호출)
- GPT 템플릿 내 질문·코칭 문구 자동 생성
- 칼로리 상한 목표 (예: 1900 미만) ✅/❌
- 운동 소모 kcal 입력 및 적자 가산
- 식단·운동 간식/끼니 프리셋
- 실시간 Drive 자동 sync (백그라운드 watch)
- 동시 다기기 편집·CRDT merge
- BMR/TDEE/활동계수 UI 노출
- 수면·컨디션·물 섭취 추적
- 푸시 알림 (인바디·운동 리마인더)
- 소셜·공유·코치 연동

### v2 후보

- FastAPI + MariaDB + JWT
- 칼로리 목표 자동 (소모 − N)
- InBody OCR / 기기 연동
- 운동 kcal 추정
- 자동 테스트 전 모듈
- 연속 측정 streak 등 게이미피케이션

---

## Further Notes

### 프로젝트 상태

- `restTime` 워크스pace **greenfield** (코드·git·이슈 트래커 없음)
- 이 PRD는 grill-me 세션(2026-05-23) 합의사항을 반영
- 이슈 트래커 publish는 repo·`/setup-matt-pocock-skills` 설정 후 `ready-for-agent` 라벨로 이슈 생성 가능

### 용어집 (UI)

| 내부/DB | UI 표기 |
|---|---|
| burn_kcal | 하루 소모 칼로리 |
| sum(kcal) | 먹은 칼로리 |
| deficit | 적자칼로리 |
| protein_factor × weight | 단백질 목표 (g) |

### 구현 순서 제안 (tracer bullet)

1. LocalDatabase + schema migration
2. MealLogService + 오늘 식단 UI
3. MealPresetService
4. DeficitCalculator + InBodyService + SettingsService
5. WorkoutService + WorkoutPresetService
6. WeeklySummaryAggregator + 주간 UI
7. GptExportFormatter + 복사 UX
8. GoogleAuthService + GoogleDriveSyncService
9. PWA manifest + 배포

### 리스크

| 리스크 | 완화 |
|---|---|
| Drive API OAuth refresh (SPA) | PKCE + token storage; 막히면 v1.1 초소형 token proxy |
| SQLite WASM 성능 | 일별 수십 row 수준 — 문제 없음 |
| Drive sync 충돌 | 수동 버튼 + 저장 전 remote newer 체크 |
| 인바디 미입력 시 적자 | 「소모 칼로리 미설정」 안내 |

---

**Label:** `ready-for-agent`
