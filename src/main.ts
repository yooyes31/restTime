import ElementPlus from 'element-plus'
import ko from 'element-plus/es/locale/lang/ko'
import 'element-plus/dist/index.css'
import '@/styles/global.css'
import { registerSW } from 'virtual:pwa-register'
import { createApp } from 'vue'

import App from '@/App.vue'
import { LocalDatabaseKey } from '@/composables/useDatabase'
import { LocalDatabase } from '@/db/LocalDatabase'
import router from '@/router'

/** PWA SW 등록. Playwright+E2E 시 dev SW 가 sql.js WASM 요청 등과 충돌해 초기화가 멈추는 경우가 있어 등록하지 않음. */
if (import.meta.env.VITE_E2E !== '1') {
  registerSW({
    immediate: true,
  })
}

async function bootstrap(): Promise<void> {
  const app = createApp(App)
  const db = new LocalDatabase()
  await db.init()
  app.provide(LocalDatabaseKey, db)
  app.use(router)
  app.use(ElementPlus, { locale: ko })
  app.mount('#app')
}

void bootstrap().catch((e: unknown) => {
  console.error(e)
  const root = document.getElementById('app')
  if (root) {
    root.textContent =
      '앱 시작에 실패했습니다. 새로 고침하거나 브라우저 콘솔 로그를 확인해 주세요.'
  }
})
