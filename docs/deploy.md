# 정적 배포 (Issue #11)

restTime 은 **백엔드 없는 SPA** 입니다. `npm run build` 결과물(`dist/`)을 HTTPS 정적 호스트에 올리면 됩니다.

## 빌드·로컬 확인

```bash
npm install
npm run build
npm run preview
```

브라우저에서 preview URL(기본 `http://localhost:4173`)로 접속해 라우팅·PWA manifest·Service Worker를 확인합니다.

### PWA 설치(홈 화면 추가)

- **Android Chrome:** 메뉴 → 「앱 설치」 또는 「홈 화면에 추가」
- **iOS Safari:** 공유 → 「홈 화면에 추가」
- **Desktop Chrome:** 주소창 옆 설치 아이콘

개발 서버(`npm run dev`)에서도 `vite-plugin-pwa` devOptions 로 manifest/SW 를 볼 수 있지만, **설치·OAuth 검증은 preview 또는 프로덕션 HTTPS** 를 권장합니다.

---

## Cloudflare Pages (권장)

| 항목 | 값 |
|------|-----|
| Framework preset | None (Vite 직접 빌드) |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node version | 18+ |

### Git 연동 배포

1. GitHub 등에 저장소 push
2. Cloudflare Dashboard → **Workers & Pages** → **Create application** → **Pages** → Connect to Git
3. 위 빌드 설정 입력
4. **Environment variables** (Production):
   - `VITE_GOOGLE_CLIENT_ID` = Google Console 웹 클라이언트 ID

> `VITE_*` 변수는 **빌드 시점**에 번들에 포함됩니다. 값 변경 후 **재배포**가 필요합니다.

### SPA 라우팅

`public/_redirects` 가 저장소에 포함되어 있어, `/today`, `/week` 등 직접 URL 접근 시 `index.html` 로 fallback 됩니다.

---

## 프로덕션 URL (HITL — 사용자가 확정)

배포가 끝나면 Cloudflare 가 부여한 URL을 메모합니다. 예:

```text
https://resttime.pages.dev
```

또는 커스텀 도메인:

```text
https://resttime.example.com
```

이 URL 을 아래 **OAuth origin** 등록에 사용합니다. AFK 에이전트는 placeholder 로 문서만 작성하며, **실제 deploy·URL 확정은 사용자 작업**입니다.

---

## Google OAuth — 프로덕션 origin (HITL)

배포 URL 이 확정된 뒤 [google-setup.md](./google-setup.md) 의 Console 설정을 갱신합니다.

### 승인된 JavaScript 생성 출처에 추가

| 환경 | URI |
|------|-----|
| 로컬 dev | `http://localhost:5173` (필요 시 `http://127.0.0.1:5173`) |
| **프로덕션** | `https://YOUR_DEPLOY_URL` (trailing slash 없음) |

### 승인된 리디렉션 URI

GIS 는 주로 popup/redirect 없이 동작하지만, Console 에 **`https://YOUR_DEPLOY_URL/`** 를 추가해 두면 origin 불일치 오류를 줄일 수 있습니다.

### 체크리스트

- [ ] Cloudflare Pages Production 배포 성공
- [ ] 브라우저에서 `https://…/today` 직접 접속 시 404 없음
- [ ] Console JavaScript origin 에 **프로덕션 HTTPS URL** 추가
- [ ] Production 빌드에 `VITE_GOOGLE_CLIENT_ID` 설정 후 재배포
- [ ] 프로덕션에서 Google 로그인·Drive push/pull 스모크

---

## 반응형 스모크 (수동)

배포 또는 preview 에서 다음을 확인합니다.

| 화면 | 확인 |
|------|------|
| 하단 탭 | 오늘/주간/설정 전환, 탭 터치 영역 ~44px |
| 주간 | 이전/다음 주 버튼, 요일별 표 가로 스크롤 |
| GPT 복사 | 범위 선택, 미리보기 스크롤, 「복사」 버튼 |
| 설정 → 기능 | 식단/인바디/운동/GPT 링크 |

Chrome DevTools 기기 툴바(iPhone SE·Pixel)와 데스크톱 너비(≥1024px) 모두 확인하면 됩니다.

---

## 관련

- OAuth 발급: [google-setup.md](./google-setup.md) · Issue #9
- Drive sync: Issue #10 · 설정 화면
