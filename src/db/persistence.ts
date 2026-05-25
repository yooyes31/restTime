/**
 * sql.js DB 파일 바이트 영속화 레이어.
 * - OPFS(Origin Private File System) 우선: 대용량 blob·export/import에 유리.
 * - 미지원/실패 시 IndexedDB 폴백.
 * - OPFS로 전환 시 기존 IndexedDB 백업은 읽기 후 제거(단일 소스).
 */

const IDB_NAME = 'resttime_v1'
const IDB_STORE = 'sqlite'
const IDB_KEY = 'health.db'
/** OPFS 루트에 둘 SQLite 파일명 (Drive sync·PRD 백업 경로와 별개 — 로컬만) */
const OPFS_DB_FILE = 'health.db'

interface OpenDbUpgradeEvent extends Event {
  target: IDBOpenDBRequest
}

function isOpfsApiAvailable(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    navigator.storage !== undefined &&
    typeof navigator.storage.getDirectory === 'function'
  )
}

/**
 * OPFS 사용 가능 여부 — API 존재 + getDirectory 실제 성공 여부까지 확인.
 */
export async function checkOpfsAvailable(): Promise<boolean> {
  if (!isOpfsApiAvailable()) return false
  try {
    await navigator.storage.getDirectory()
    return true
  } catch {
    return false
  }
}

async function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'))
    req.onupgradeneeded = (evt: Event) => {
      const e = evt as OpenDbUpgradeEvent
      const idb = e.target.result
      if (!idb.objectStoreNames.contains(IDB_STORE)) idb.createObjectStore(IDB_STORE)
    }
    req.onsuccess = () => resolve(req.result)
  })
}

export async function idbPut(data: Uint8Array): Promise<void> {
  const idb = await openIdb()
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readwrite')
    tx.oncomplete = () => {
      idb.close()
      resolve()
    }
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB tx failed'))
    tx.objectStore(IDB_STORE).put(data, IDB_KEY)
  })
}

export async function idbGet(): Promise<Uint8Array | undefined> {
  const idb = await openIdb()
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readonly')
    const req = tx.objectStore(IDB_STORE).get(IDB_KEY)
    req.onerror = () => reject(req.error ?? new Error('IDB get failed'))
    req.onsuccess = () => {
      idb.close()
      resolve(req.result as Uint8Array | undefined)
    }
  })
}

/** IndexedDB 키 삭제 — OPFS로 이전 완료 후 중복 저장 방지 */
export async function idbDeleteKey(): Promise<void> {
  const idb = await openIdb()
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readwrite')
    tx.oncomplete = () => {
      idb.close()
      resolve()
    }
    tx.onerror = () => reject(tx.error ?? new Error('IDB delete failed'))
    tx.objectStore(IDB_STORE).delete(IDB_KEY)
  })
}

export async function readOpfsDb(): Promise<Uint8Array | undefined> {
  if (!(await checkOpfsAvailable())) return undefined
  try {
    const root = await navigator.storage.getDirectory()
    const handle = await root.getFileHandle(OPFS_DB_FILE)
    const file = await handle.getFile()
    if (file.size === 0) return undefined
    return new Uint8Array(await file.arrayBuffer())
  } catch (e) {
    if (e instanceof DOMException && e.name === 'NotFoundError') return undefined
    throw e
  }
}

export async function writeOpfsDb(data: Uint8Array): Promise<void> {
  const root = await navigator.storage.getDirectory()
  const handle = await root.getFileHandle(OPFS_DB_FILE, { create: true })
  const writable = await handle.createWritable()
  try {
    // FileSystemWritableFileStream 타입 호환(ArrayBuffer 고정 버퍼)을 위해 복사본 전달 — 한글 주석
    await writable.write(new Uint8Array(data))
  } finally {
    await writable.close()
  }
}

export type PersistBackend = 'opfs' | 'indexeddb'

/**
 * 부팅 시 저장소에서 DB 바이트 로드.
 * OPFS 모드일 때는 OPFS → 비어 있으면 IndexedDB(구버전/Safari 등 마이그레이션).
 */
export async function loadPersistedDbBytes(backend: PersistBackend): Promise<Uint8Array | undefined> {
  if (backend === 'opfs') {
    const fromOpfs = await readOpfsDb()
    if (fromOpfs && fromOpfs.byteLength > 0) return fromOpfs
    return idbGet()
  }
  return idbGet()
}

/**
 * DB export 바이트를 백엔드에 맞게 기록. OPFS 사용 시 IndexedDB 키는 제거.
 */
export async function savePersistedDbBytes(backend: PersistBackend, data: Uint8Array): Promise<void> {
  if (backend === 'opfs') {
    await writeOpfsDb(data)
    try {
      await idbDeleteKey()
    } catch {
      // 삭제 실패해도 OPFS가 정본 — 로그만
      console.warn('LocalDatabase: IndexedDB 정리(idbDeleteKey)에 실패했습니다. OPFS 데이터는 저장됨.')
    }
    return
  }
  await idbPut(data)
}
