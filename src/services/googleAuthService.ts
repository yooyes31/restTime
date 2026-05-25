/**
 * Google Identity Services — Token Client 기반 접근 토큰
 * SPA 에서 Client Secret 미사용; refresh 는 만료 후 재 요청(prompt 조절) — 한글 주석
 */

const STORAGE_KEY = 'resttime:google:session'

/** localStorage 에 저장되는 세션 형태 */
interface GoogleSessionStored {
  accessToken: string
  /** unix ms */
  expiresAt: number
  email?: string
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (cfg: TokenClientConfig) => TokenClient
        }
      }
    }
  }
}

interface TokenClientConfig {
  client_id: string
  scope: string
  callback: (resp: TokenResponse) => void
}

interface TokenResponse {
  access_token?: string
  expires_in?: number
  error?: string
  error_description?: string
}

interface TokenClient {
  requestAccessToken: (overrideConfig?: Record<string, unknown>) => void
}

const GIS_SCRIPT = 'https://accounts.google.com/gsi/client'
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo'
/** Drive 앱 생성 파일 접근 + 이메일 표시(OAuth 동의 화면에 스코프 등록 필요) */
export const GOOGLE_DRIVE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/drive.file',
].join(' ')

let gisLoadPromise: Promise<void> | null = null

function loadGisScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('브라우저 환경이 아닙니다.'))
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  if (gisLoadPromise) return gisLoadPromise
  gisLoadPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = GIS_SCRIPT
    s.async = true
    s.defer = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Google Identity Services 스크립트를 불러오지 못했습니다.'))
    document.head.appendChild(s)
  })
  return gisLoadPromise
}

function readSession(): GoogleSessionStored | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as GoogleSessionStored
    if (!p.accessToken || !p.expiresAt) return null
    return p
  } catch {
    return null
  }
}

function writeSession(s: GoogleSessionStored | null): void {
  if (!s) localStorage.removeItem(STORAGE_KEY)
  else localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
}

export class GoogleAuthService {
  private session: GoogleSessionStored | null = readSession()

  constructor(private readonly clientId: string) {}

  hasClientId(): boolean {
    return Boolean(this.clientId?.trim())
  }

  /** 저장된 세션이 있으면 true (만료 여부는 getAccessToken 에서 판단) */
  isSignedIn(): boolean {
    return Boolean(this.session?.accessToken)
  }

  /** 만료 전·유효 토큰 또는 null */
  getAccessToken(): string | null {
    const s = this.session
    if (!s?.accessToken) return null
    if (Date.now() >= s.expiresAt - 60_000) return null
    return s.accessToken
  }

  getCachedEmail(): string | undefined {
    return this.session?.email
  }

  /** GIS 로그인 — 사용자 클릭 핸들러 안에서 호출 권장 */
  async signIn(): Promise<{ email: string }> {
    if (!this.hasClientId()) throw new Error('VITE_GOOGLE_CLIENT_ID 가 비어 있습니다.')
    await loadGisScript()
    const token = await this.requestAccessTokenFromGis('interactive')
    const email = await this.fetchEmail(token)
    this.session = {
      accessToken: token.accessToken,
      expiresAt: token.expiresAt,
      email,
    }
    writeSession(this.session)
    return { email }
  }

  /**
   * API 호출 직전: 유효 토큰 확보 — 만료 시 조용 재요청 불가하면 에러 → UI 에서 재로그인 유도.
   */
  async ensureAccessToken(): Promise<string> {
    const cur = this.getAccessToken()
    if (cur) return cur
    if (!this.hasClientId()) throw new Error('클라이언트 ID가 없습니다.')

    /** 만료 후: 세션 리프레시가 로그인 없이 가능한 경우 */
    await loadGisScript()
    try {
      /** 만료 직후: 동의가 남아 있으면 팝업 없이 갱신 시도 */
      const token = await this.requestAccessTokenFromGis('silent')
      const email =
        this.session?.email ?? (await this.fetchEmail(token)) ?? ''
      if (email && !this.session?.email)
        await this.persistEmailOnly(email)

      if (!email && this.session?.email) {
        this.session = {
          accessToken: token.accessToken,
          expiresAt: token.expiresAt,
          email: this.session.email,
        }
      } else {
        this.session = {
          accessToken: token.accessToken,
          expiresAt: token.expiresAt,
          email: email || this.session?.email,
        }
      }
      writeSession(this.session!)
      return this.session!.accessToken
    } catch {
      throw new Error('로그인이 만료되었습니다. 다시 로그인해 주세요.')
    }
  }

  signOut(): void {
    this.session = null
    writeSession(null)
  }

  private async persistEmailOnly(email: string): Promise<void> {
    if (!this.session) return
    this.session = { ...this.session, email }
    writeSession(this.session)
  }

  /**
   * @param mode interactive — 사용자 제스처(로그인 버튼)·silent — 만료 후 최소 프롬프트 갱신
   */
  private requestAccessTokenFromGis(mode: 'interactive' | 'silent'): Promise<{
    accessToken: string
    expiresIn: number
    expiresAt: number
  }> {
    return new Promise((resolve, reject) => {
      const oauth2 = window.google?.accounts?.oauth2
      if (!oauth2) {
        reject(new Error('GIS oauth2 를 초기화할 수 없습니다.'))
        return
      }
      const client = oauth2.initTokenClient({
        client_id: this.clientId,
        scope: GOOGLE_DRIVE_SCOPES,
        callback: (resp: TokenResponse) => {
          if (resp.error) {
            reject(new Error(resp.error_description || resp.error))
            return
          }
          if (!resp.access_token || !resp.expires_in) {
            reject(new Error('액세스 토큰을 받지 못했습니다.'))
            return
          }
          const expiresAt = Date.now() + resp.expires_in * 1000
          resolve({
            accessToken: resp.access_token,
            expiresIn: resp.expires_in,
            expiresAt,
          })
        },
      })
      if (mode === 'silent') client.requestAccessToken({ prompt: '' })
      else client.requestAccessToken()
    })
  }

  private async fetchEmail(access: { accessToken: string }): Promise<string> {
    const res = await fetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${access.accessToken}` },
    })
    if (!res.ok) return ''
    const j = (await res.json()) as { email?: string }
    return j.email ?? ''
  }
}
