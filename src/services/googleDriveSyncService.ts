import type { LocalDatabase } from '@/db/LocalDatabase'
import { GoogleAuthService } from '@/services/googleAuthService'
import { SettingsService } from '@/services/settingsService'

/** PRD / Issue #10 — Drive 백업 고정 경로 */
const BACKUP_FOLDER = 'restTime'
const BACKUP_FILENAME = 'health.db'

export interface RemoteNewerResult {
  /** Drive 가 로컬이 기억하는 시각보다 최신이면 true (또는 로컬 기록 없이 원격 파일만 있음) */
  newer: boolean
  remoteModified?: string
  baseline?: string | null
}

export type PushResult =
  | { ok: true; modifiedTime: string }
  | { ok: false; reason: 'remote_newer'; remoteModified: string; baseline: string | null }

interface DriveFileMeta {
  id: string
  modifiedTime: string
}

/**
 * Drive v3 — restTime/health.db 수동 pull·push, 저장 전 원격 최신 여부 확인
 * (자동 백그라운드 동기는 범위 밖 — 한글 주석)
 */
export class GoogleDriveSyncService {
  private readonly settings: SettingsService

  constructor(
    private readonly db: LocalDatabase,
    private readonly auth: GoogleAuthService,
    settings?: SettingsService,
  ) {
    this.settings = settings ?? new SettingsService(db)
  }

  /**
   * 로컬 settings 의 drive_last_remote_modified 대비 Drive 메타데이터가 더 최신인지.
   * fileId 가 없고 폴더 내 파일도 없으면 newer=false.
   */
  async checkRemoteNewer(): Promise<RemoteNewerResult> {
    const token = await this.auth.ensureAccessToken()
    const remote = await this.resolveBackupFile(token)
    if (!remote) return { newer: false, baseline: await this.settings.get('drive_last_remote_modified') }

    const baseline = await this.settings.get('drive_last_remote_modified')
    if (!baseline) {
      return { newer: true, remoteModified: remote.modifiedTime, baseline: null }
    }
    const tr = Date.parse(remote.modifiedTime)
    const tb = Date.parse(baseline)
    if (Number.isNaN(tr) || Number.isNaN(tb)) {
      return { newer: true, remoteModified: remote.modifiedTime, baseline }
    }
    return {
      newer: tr > tb,
      remoteModified: remote.modifiedTime,
      baseline,
    }
  }

  /** Drive → importBlob, 메타데이터를 settings 에 반영 */
  async pull(): Promise<void> {
    const token = await this.auth.ensureAccessToken()
    const remote = await this.resolveBackupFile(token)
    if (!remote) {
      throw new Error(`Google Drive에 ${BACKUP_FOLDER}/${BACKUP_FILENAME} 백업이 없습니다.`)
    }
    const bytes = await this.downloadFileBytes(remote.id, token)
    await this.db.importBlob(bytes)
    await this.settings.set('drive_file_id', remote.id)
    await this.settings.set('drive_last_remote_modified', remote.modifiedTime)
    const email = this.auth.getCachedEmail()
    if (email) await this.settings.set('google_account_email', email)
  }

  /**
   * 로컬 → Drive — remote_newer 이면 force 가 아닐 때 ok:false 반환(UI 확인 후 force 재시도)
   */
  async push(force: boolean): Promise<PushResult> {
    const token = await this.auth.ensureAccessToken()
    if (!force) {
      const { newer, remoteModified } = await this.checkRemoteNewer()
      if (newer && remoteModified) {
        return {
          ok: false,
          reason: 'remote_newer',
          remoteModified,
          baseline: await this.settings.get('drive_last_remote_modified'),
        }
      }
    }

    const bytes = await this.db.exportBlob()
    const folderId = await this.ensureBackupFolder(token)
    let fileId = await this.settings.get('drive_file_id')
    let meta: DriveFileMeta

    if (fileId) {
      const head = await this.getFileMeta(fileId, token)
      if (!head) fileId = null
    }

    if (fileId) {
      meta = await this.updateFileMedia(fileId, bytes, token)
    } else {
      const existing = await this.findFileInFolder(folderId, BACKUP_FILENAME, token)
      if (existing) {
        meta = await this.updateFileMedia(existing.id, bytes, token)
        fileId = existing.id
      } else {
        meta = await this.createBinaryFile(folderId, BACKUP_FILENAME, bytes, token)
        fileId = meta.id
      }
    }

    await this.settings.set('drive_file_id', fileId)
    await this.settings.set('drive_last_remote_modified', meta.modifiedTime)
    const email = this.auth.getCachedEmail()
    if (email) await this.settings.set('google_account_email', email)
    return { ok: true, modifiedTime: meta.modifiedTime }
  }

  // ——— Drive API helpers ———

  private async resolveBackupFile(token: string): Promise<DriveFileMeta | null> {
    const stored = await this.settings.get('drive_file_id')
    if (stored) {
      const m = await this.getFileMeta(stored, token)
      if (m) return m
    }
    const folderId = await this.findBackupFolder(token)
    if (!folderId) return null
    const f = await this.findFileInFolder(folderId, BACKUP_FILENAME, token)
    return f
  }

  /** 루트에 restTime 폴더 검색(없으면 생성 후 id) */
  private async ensureBackupFolder(token: string): Promise<string> {
    const existing = await this.findBackupFolder(token)
    if (existing) return existing
    const res = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: BACKUP_FOLDER,
        mimeType: 'application/vnd.google-apps.folder',
        parents: ['root'],
      }),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Drive 폴더 생성 실패: ${text}`)
    }
    const created = (await res.json()) as { id?: string }
    if (!created.id) throw new Error('Drive 폴더 id 를 받지 못했습니다.')
    return created.id
  }

  private async findBackupFolder(token: string): Promise<string | null> {
    const q = [
      `mimeType = 'application/vnd.google-apps.folder'`,
      `name = '${escapeQuery(BACKUP_FOLDER)}'`,
      `'root' in parents`,
      'trashed = false',
    ].join(' and ')
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&spaces=drive`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) return null
    const data = (await res.json()) as { files?: { id?: string }[] }
    const id = data.files?.[0]?.id
    return id ?? null
  }

  private async findFileInFolder(folderId: string, name: string, token: string): Promise<DriveFileMeta | null> {
    const q = [
      `name = '${escapeQuery(name)}'`,
      `'${folderId}' in parents`,
      'trashed = false',
    ].join(' and ')
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,modifiedTime)&spaces=drive`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) return null
    const data = (await res.json()) as { files?: DriveFileMeta[] }
    const f = data.files?.[0]
    return f?.id && f.modifiedTime ? f : null
  }

  private async getFileMeta(fileId: string, token: string): Promise<DriveFileMeta | null> {
    const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,modifiedTime`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (res.status === 404) return null
    if (!res.ok) return null
    const meta = (await res.json()) as DriveFileMeta
    return meta.id && meta.modifiedTime ? meta : null
  }

  private async downloadFileBytes(fileId: string, token: string): Promise<Uint8Array> {
    const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Drive 파일 다운로드 실패: ${text}`)
    }
    const buf = await res.arrayBuffer()
    return new Uint8Array(buf)
  }

  /** 간단 PATCH media 업로드 — 응답에 modifiedTime 포함 요청(fields) Drive v3 상 기본값이 비어 나올 수 있음 */
  private async updateFileMedia(fileId: string, data: Uint8Array, token: string): Promise<DriveFileMeta> {
    const q = new URLSearchParams({
      uploadType: 'media',
      fields: 'id,modifiedTime',
    })
    const url = `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(fileId)}?${q}`
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/octet-stream',
      },
      body: arrayBufferFromUint8(data),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Drive 업로드(갱신) 실패: ${text}`)
    }
    const meta = (await res.json()) as DriveFileMeta
    if (meta.modifiedTime) return meta

    /** 일부 환경에서 업로드 응답이 비어 나오면 메타 단건 조회 — 한글 주석 */
    const head = await this.getFileMeta(fileId, token)
    if (!head?.modifiedTime) throw new Error('Drive 응답에 modifiedTime 을 받지 못했습니다.')
    return head
  }

  private async createBinaryFile(parentId: string, name: string, data: Uint8Array, token: string): Promise<DriveFileMeta> {
    const boundary = `resttime_${crypto.randomUUID().replace(/-/g, '')}`
    const metaJson = JSON.stringify({
      name,
      parents: [parentId],
    })
    const crlf = '\r\n'
    const parts: BlobPart[] = [
      `--${boundary}${crlf}`,
      `Content-Type: application/json; charset=UTF-8${crlf}${crlf}`,
      metaJson,
      crlf,
      `--${boundary}${crlf}`,
      `Content-Type: application/octet-stream${crlf}${crlf}`,
      arrayBufferFromUint8(data),
      crlf,
      `--${boundary}--`,
    ]
    const body = new Blob(parts)
    const createQ = new URLSearchParams({
      uploadType: 'multipart',
      fields: 'id,modifiedTime',
    })
    const url = `https://www.googleapis.com/upload/drive/v3/files?${createQ}`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Drive 파일 생성 실패: ${text}`)
    }
    const meta = (await res.json()) as DriveFileMeta
    if (meta.modifiedTime) return meta
    if (!meta.id) throw new Error('Drive 생성 응답에 id 가 없습니다.')
    const head = await this.getFileMeta(meta.id, token)
    if (!head?.modifiedTime) throw new Error('Drive 생성 후 modifiedTime 을 받지 못했습니다.')
    return head
  }
}

function escapeQuery(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

/** fetch Body 로 넘길 순수 ArrayBuffer (TypedArray 가 SharedArrayBuffer 를 참조할 때 대비) */
function arrayBufferFromUint8(data: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(data.byteLength)
  copy.set(data)
  return copy.buffer
}
