import type { InjectionKey } from 'vue'
import { inject } from 'vue'

import type { LocalDatabase } from '@/db/LocalDatabase'

/** provide/inject 키 — main.ts 에서 제공 */
export const LocalDatabaseKey: InjectionKey<LocalDatabase> = Symbol('LocalDatabase')

export function useDatabase(): LocalDatabase {
  const db = inject(LocalDatabaseKey)
  if (!db) {
    throw new Error('LocalDatabase 제공자가 등록되어 있지 않습니다.')
  }
  return db
}
