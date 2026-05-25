import type { BindParams, Database, SqlValue } from 'sql.js'
import sqlWasmUrl from 'sql.js/dist/sql-wasm-browser.wasm?url'

import { applyInitialMigration } from '@/db/migrations'
import type { PersistBackend } from '@/db/persistence'
import {
  checkOpfsAvailable,
  loadPersistedDbBytes,
  savePersistedDbBytes,
} from '@/db/persistence'

/**
 * sql.js 패키지의 initSqlJs() 가 넘겨 주는 WASM 모듈.
 * 브라우저 번들(`sql-wasm-browser.js`)은 ESM default 가 없어 동적 import + 런타임 탐색 — 한글 주석
 */
interface SqlJsResolved {
  Database: new (data?: ArrayLike<number> | null | undefined) => Database
}

const PERSIST_DEBOUNCE_MS = 400

/**
 * 브라우저 로컬 SQLite 래퍼 — PRD LocalDatabase 계약.
 * - sql.js 인메모리 + 주기적 export
 * - 영속: OPFS 우선, 미지원 시 IndexedDB
 */
export class LocalDatabase {
  private sql: SqlJsResolved | null = null
  private db: Database | null = null
  /** init 시 결정되는 저장소 종류 — 이후 export/import까지 동일하게 사용 */
  private persistBackend: PersistBackend | null = null

  private persistTimer: ReturnType<typeof setTimeout> | null = null

  /** 앱 마운트 전 1회: WASM 로드 후 DB 초기화·마이그레이션 */
  async init(): Promise<void> {
    const SQL = await LocalDatabase.loadSqlModule()
    // Playwright headless 등에서 OPFS 가 응답 없이 대기하는 경우가 있어 E2E(VITE_E2E) 에서는 IndexedDB만 사용 — 한글 주석
    const useOpfs = import.meta.env.VITE_E2E !== '1' && (await checkOpfsAvailable())
    this.persistBackend = useOpfs ? 'opfs' : 'indexeddb'

    const existing = await loadPersistedDbBytes(this.persistBackend)

    const instance =
      existing && existing.byteLength > 0 ? new SQL.Database(existing) : new SQL.Database()

    instance.run('PRAGMA foreign_keys = ON')
    applyInitialMigration(instance)

    this.sql = SQL
    this.db = instance
    await this.persistImmediately()
    this.attachLifecycleFlush()
  }

  /** 단일 DDL/DML 실행(파라메터 선택) — 자동 영속 저장(디바운스) */
  async exec(sql: string, params?: SqlValue[]): Promise<void> {
    const d = this.requireDb()
    if (params?.length) d.run(sql, params as BindParams)
    else d.run(sql)
    this.schedulePersistDebounced()
  }

  /** SELECT 등 다행 조회를 객체 배열로 반환 */
  async query<T extends Record<string, SqlValue>>(sql: string, params?: SqlValue[]): Promise<T[]> {
    const d = this.requireDb()
    const stmt = d.prepare(sql)
    try {
      if (params?.length) stmt.bind(params as BindParams)
      const rows: T[] = []
      while (stmt.step()) {
        rows.push(stmt.getAsObject() as T)
      }
      return rows
    } finally {
      stmt.free()
    }
  }

  /** 전체 파일 바이트 — Drive 동기화(#10)·수동 내보내기용 */
  async exportBlob(): Promise<Uint8Array> {
    await this.persistImmediately()
    return this.requireDb().export()
  }

  /**
   * 외부 백업(blob) 적용.
   * import 후 DDL은 schema.sql 의 IF NOT EXISTS 로 idempotent 재적용.
   */
  async importBlob(data: Uint8Array): Promise<void> {
    if (!this.persistBackend) {
      const opfsAllowed = import.meta.env.VITE_E2E !== '1' && (await checkOpfsAvailable())
      this.persistBackend = opfsAllowed ? 'opfs' : 'indexeddb'
    }
    await this.persistImmediately()
    const SQL = this.sql ?? (await LocalDatabase.loadSqlModule())
    this.sql = SQL
    const prev = this.db
    prev?.close()
    const next = new SQL.Database(data)
    next.run('PRAGMA foreign_keys = ON')
    applyInitialMigration(next)
    this.db = next
    await this.persistImmediately()
  }

  private static extractInitFn(
    imported: Record<string, unknown>,
  ): ((cfg?: Record<string, unknown>) => Promise<SqlJsResolved>) | undefined {
    let node: unknown = imported.default ?? imported.Module ?? imported
    for (let depth = 0; depth < 8; depth += 1) {
      if (typeof node === 'function') {
        return node as (cfg?: Record<string, unknown>) => Promise<SqlJsResolved>
      }
      if (node && typeof node === 'object' && 'default' in node) {
        node = (node as { default: unknown }).default
        continue
      }
      break
    }
    return undefined
  }

  private static async loadSqlModule(): Promise<SqlJsResolved> {
    const imported = (await import('sqljs-wasm-browser')) as unknown as Record<string, unknown>

    const initCandidate = LocalDatabase.extractInitFn(imported)
    if (!initCandidate) {
      throw new Error('sql.js: initSqlJs 함수를 브라우저 번들에서 불러오지 못했습니다.')
    }

    return initCandidate({
      locateFile: (file: string) => (file.endsWith('.wasm') ? sqlWasmUrl : file),
    })
  }

  private requireDb(): Database {
    if (!this.db) throw new Error('LocalDatabase: init 전에는 사용할 수 없습니다.')
    return this.db
  }

  private attachLifecycleFlush(): void {
    if (typeof window === 'undefined') return

    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') void this.persistImmediately()
    })
    window.addEventListener('pagehide', () => {
      void this.persistImmediately()
    })
  }

  private schedulePersistDebounced(): void {
    if (!this.db) return
    if (typeof window === 'undefined') {
      void this.persistImmediately()
      return
    }
    if (this.persistTimer !== null) window.clearTimeout(this.persistTimer)
    this.persistTimer = window.setTimeout(() => {
      this.persistTimer = null
      void this.persistImmediately()
    }, PERSIST_DEBOUNCE_MS)
  }

  /**
   * 디스크(또는 OPFS)에 즉시 동기화 — debounce 타이머 무효화.
   */
  private async persistImmediately(): Promise<void> {
    if (this.persistTimer !== null && typeof window !== 'undefined') {
      window.clearTimeout(this.persistTimer)
      this.persistTimer = null
    }
    const d = this.db
    if (!d || !this.persistBackend) return
    const bytes = d.export()
    await savePersistedDbBytes(this.persistBackend, bytes)
  }
}
