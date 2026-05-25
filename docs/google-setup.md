# Google Cloud — OAuth 클라이언트 ID 설정 (Issue #9)

개발 단계에서 **한 번만** 진행하면 됩니다. 로컬에서는 Client ID 만 있으면 되며(**Client Secret은 브라우저 SPA 에서 사용하지 않음**), 생성한 값은 **`.env`에만 넣고 git 에 커밋하지 마세요.**

- **전제**: [Google Cloud Console](https://console.cloud.google.com/) 에 접근 가능한 Google 계정
- **목적**: 이후 **[#10](../.issues/010-google-drive-sync.md)** 에서 Google Identity Services 로그인 + Drive API 호출 시 사용할 **웹 클라이언트 ID**

---

## 절차 요약

| 단계 | 작업 |
|------|------|
| 1 | 프로젝트 생성(또는 기존 프로젝트 선택) |
| 2 | **Google Drive API** 활성화 |
| 3 | **OAuth 동의 화면** 설정(External · Testing 모드로 개인용 가능) |
| 4 | **OAuth 2.0 클라이언트 ID** — 유형 「웹 애플리케이션」 |
| 5 | 승인된 JavaScript 시작 위치 · 리디렉션 URI 등록 |
| 6 | 표시되는 **클라이언트 ID** 를 복사 → `.env` 의 `VITE_GOOGLE_CLIENT_ID` |

---

## 1. 프로젝트

1. Console 상단 프로젝트 선택 → **새 프로젝트**(또는 기존 것 선택).

---

## 2. Google Drive API 활성화

1. **API 및 서비스** → **라이브러리**
2. **Google Drive API** 검색 → **사용 설정**

> AC: 「Drive API enabled」 — Console 에서 활성 상태로 표시되면 됩니다.

---

## 3. OAuth 동의 화면

1. **API 및 서비스** → **OAuth 동의 화면**
2. **외부** 선택(개인/소수 사용자면 Testing 로 충분한 경우 많음).
3. 앱 이름 · 지원 이메일 등 필수 입력 후 저장.

실제 배포 후 일반 사용자에게 열려면 **OAuth 동의 화면을 Production(게시)** 으로 전환합니다. restTime 은 `drive.file` 등 비민감 스코프 위주라 검증 없이 게시되는 경우가 많습니다(미검증 경고 화면은 사용자가 「고급 → 이동」으로 진행 가능).

**Production 게시 전 필수 URL** (앱과 함께 배포되는 정적 페이지):

| 문서 | Console 에 넣을 URL (배포 주소 기준) |
|------|--------------------------------------|
| 개인정보처리방침 | `https://YOUR_DEPLOY_URL/privacy/` |
| 서비스 약관 | `https://YOUR_DEPLOY_URL/terms/` |

예: Cloudflare Pages `https://resttime.pages.dev/privacy/` · `https://resttime.pages.dev/terms/`

소스: [`public/privacy/`](../public/privacy/), [`public/terms/`](../public/terms/) — `npm run build` 시 `dist/` 에 포함됩니다.

**게시 절차:** OAuth 동의 화면 → 앱 정보(홈페이지·개인정보처리방침·약관 URL) 저장 → **앱 게시(Publish app)** → Production.

**테스트 사용자(External + Testing)** — Production 전까지는 아래만 해당:

---

## 4. OAuth 2.0 클라이언트 ID (웹)

1. **API 및 서비스** → **사용자 인증 정보**
2. **+ 사용자 인증 정보 만들기** → **OAuth 클라이언트 ID**
3. 애플리케이션 유형: **웹 애플리케이션**

---

## 5. 시작 위치(Origins) · 리디렉션 URI

Vite 개발 서버 기본 포트가 **5173** 이라는 전제입니다. 이 저장소 README 와 동일합니다.

### 승인된 JavaScript 생성 출처

| 환경 | URI (예시) |
|------|------------|
| 로컬 Vite dev | `http://localhost:5173` |

동일 호스트라도 스킴·호스트·포트가 다르면 별개입니다. 필요하면 브라우저에서 실제로 열 주소에 맞춰 **`http://127.0.0.1:5173`** 등도 추가하세요.

### 승인된 리디렉션 URI

Google Identity Services / OAuth 설정에 따라 **`http://localhost:5173`**(또는 앱 라우트 포함 경로, 예: **`http://localhost:5173/`**) 을 추가해야 하는 경우가 있습니다. **#10** 구현 시 콜백 URL 이 정해지면, Console 의 값과 정확히 일치해야 합니다. 오류 발생 시 여기부터 확인하세요.

### 프로덕션 (#11 배포 후 — HITL)

HTTPS 배포 URL 이 확정되면 **승인된 JavaScript 생성 출처**에 추가합니다.

| 환경 | URI (예시) |
|------|------------|
| Cloudflare Pages | `https://resttime.pages.dev` |
| 커스텀 도메인 | `https://resttime.example.com` |

상세 배포·체크리스트: **[docs/deploy.md](./deploy.md)**

리디렉션 URI 에도 **`https://YOUR_DEPLOY_URL/`** 를 추가해 두면 origin 불일치를 줄일 수 있습니다.

E2E 전용 포트 **5179** 에서 브라우저 OAuth 까지 돌린다면, 해당 origin 도 별도로 등록합니다.

---

## 6. Client ID → `.env`

프로젝트 루트에 `.env` 파일을 만들고(이미 있다면 수정):

```env
VITE_GOOGLE_CLIENT_ID=여기에-클라이언트-ID.apps.googleusercontent.com
```

형식 참고용으로 루트의 [`.env.example`](../.env.example) 을 참고하면 됩니다.

- `npm run dev` 재시작 후 Vite 가 환경 변수를 반영합니다.
- `.env` 는 `.gitignore` 대상입니다. 팀원과 공유할 때는 1회 이 절차로 각자 발급하거나, 안전한 비밀 채널만 사용하세요.

---

## Drive 스코프 (#10 구현됨 — 동의 화면에 다음 추가)

앱이 GIS 토큰으로 요청하는 스코프는 다음과 같습니다 (**OAuth 동의 화면 > 범위** 에 모두 추가).

| 스코프 | 용도 |
|---|---|
| `openid` | OpenID 연결 |
| `email` | 로그인 이메일 표시·계정 전환 판별 |
| `profile` | 기본 프로필(선택 표시 시) |
| `https://www.googleapis.com/auth/drive.file` | 앱이 만든/다루는 파일만 접근(restTime/health.db) |

동의 화면 저장 시 사용자에게 노출되는 설명 문구를 위 용도에 맞춥니다.

---

## 완료 체크리스트(Issue #9 AC)

다음 항목이 만족되면 #9 사람 작업은 끝으로 볼 수 있습니다.

- [ ] Google Drive API 가 프로젝트에서 **사용 설정** 상태
- [ ] OAuth 클라이언트 ID(웹) **발급**
- [ ] 로컬 `.env` 에 `VITE_GOOGLE_CLIENT_ID` 설정 및 dev 에서 변수 로드 확인
- [ ] 배포 후 [docs/deploy.md](./deploy.md) 체크리스트에 따라 **프로덕션 origin** 추가 (HITL)

코드 레포에는 이 문서와 `.env.example` 만 커밋합니다. 클라이언트 ID 문자열 자체는 커밋하지 않습니다.

---

## 관련 이슈

- **차단 해제 대상**: [#10 Google 로그인 + Drive sync](../.issues/010-google-drive-sync.md)
- **요약 카드**: [ISSUES.md](../ISSUES.md) 의 #9 블록
