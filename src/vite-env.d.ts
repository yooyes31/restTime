/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/** Playwright 등 E2E에서 SW 비활성화할 때 vite 가 주입합니다. */
interface ImportMetaEnv {
  readonly VITE_E2E?: string
  /** Google 웹 클라이언트 ID — Issue #9 / Drive #10 — 한글: 로컬 .env 에만 두고 커밋 금지 */
  readonly VITE_GOOGLE_CLIENT_ID?: string
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

declare module '*?raw' {
  const content: string
  export default content
}

declare module '*.wasm?url' {
  const url: string
  export default url
}

/** Vite alias — sql.js/dist/sql-wasm-browser.js */
declare module 'sqljs-wasm-browser' {
  const mod: Record<string, unknown>
  export default mod
}
