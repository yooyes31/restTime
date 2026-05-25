import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig, devices } from '@playwright/test'

/** ESM 에서 디렉터리 루트 (vite type:module 호환) */
const rootDir = path.dirname(fileURLToPath(import.meta.url))

/** Playwright 통합 테스트 전용 호스트 포트 — 로컬 `npm run dev` 기본값(5173)과 분리 */
const E2E_PORT = 5179
const origin = `http://127.0.0.1:${E2E_PORT}` as const

/**
 * Playwright 설정 — Issue #1 AC 자동 검증(webServer 에서 Vite dev 기동).
 * Chromium만 사용해 OPFS 우선 브라우저와 근사한 환경을 맞춤.
 */
export default defineConfig({
  /** sql.js WASM + 스키마 부트가 저사양/콜드스타트에서 길어질 수 있음 */
  timeout: 90_000,
  testDir: path.join(rootDir, 'e2e'),
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [['list']],
  use: {
    baseURL: origin,
    trace: 'on-first-retry',
    video: process.env.CI ? 'off' : 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // wasm/sql.js 부트가 dev SW 에 막히는 것을 피하기 위해 VITE_E2E=1 (main.ts 참고)
    command: `VITE_E2E=1 npm run dev -- --host 127.0.0.1 --port ${E2E_PORT}`,
    url: origin,
    // 다른 터미널에서 띄운 일반 dev(SW 활성·VITE_E2E 없음)를 붙잡아 오면 무한 초기화에 걸릴 수 있음
    reuseExistingServer: Boolean(process.env.PLAYWRIGHT_REUSE_DEV_SERVER),
    timeout: 120_000,
  },
})
