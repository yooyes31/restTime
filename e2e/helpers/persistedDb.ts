import type { Page } from '@playwright/test'

export type PersistedDbInfo =
  | { backend: 'opfs'; bytes: number }
  | { backend: 'indexeddb'; bytes: number }

/**
 * LocalDatabase.persistImmediately 가 기록하는 실제 저장소 크기 확인.
 * - OPFS: `health.db` (persist.ts 의 OPFS_DB_FILE 과 동일)
 * - IndexedDB: `resttime_v1.sqlite` 저장소 의 `health.db` 키
 */
export async function readPersistedSqlite(page: Page): Promise<PersistedDbInfo | null> {
  return page.evaluate(async () => {
    // OPFS 우선 (Chromium 에서 가능한 경우 — 앱과 동일한 경로 검사)
    try {
      const getDir = navigator.storage?.getDirectory
      if (typeof getDir === 'function') {
        const root = await navigator.storage.getDirectory()
        const fh = await root.getFileHandle('health.db')
        const file = await fh.getFile()
        const bytes = file.size ?? 0
        if (bytes > 0) return { backend: 'opfs' as const, bytes }
      }
    } catch {
      // NotFoundError 등 → IndexedDB 경로 검사
    }

    const fromIdb = await new Promise<number | null>((resolve) => {
      const req = indexedDB.open('resttime_v1', 1)
      req.onerror = () => resolve(null)
      req.onsuccess = () => {
        const idb = req.result
        try {
          if (!idb.objectStoreNames.contains('sqlite')) {
            idb.close()
            resolve(null)
            return
          }
          const tx = idb.transaction('sqlite', 'readonly')
          const r = tx.objectStore('sqlite').get('health.db')
          r.onerror = () => {
            idb.close()
            resolve(null)
          }
          r.onsuccess = () => {
            const raw = r.result as ArrayBuffer | Uint8Array | undefined
            let n = 0
            if (raw instanceof Uint8Array) n = raw.byteLength
            else if (raw instanceof ArrayBuffer) n = raw.byteLength
            idb.close()
            resolve(n > 0 ? n : null)
          }
        } catch {
          idb.close()
          resolve(null)
        }
      }
    })

    if (fromIdb != null) return { backend: 'indexeddb' as const, bytes: fromIdb }

    return null
  })
}
