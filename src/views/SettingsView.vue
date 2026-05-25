<script setup lang="ts">
/** 설정: Google 로그인·Drive 수동 동기화, 단백질 계수, 로컬 DB 백업(Issue #10+디버깅) */
import type { UploadFile } from 'element-plus'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, Upload } from '@element-plus/icons-vue'
import { computed, onMounted, ref } from 'vue'

import { useDatabase } from '@/composables/useDatabase'
import { GoogleAuthService } from '@/services/googleAuthService'
import { GoogleDriveSyncService } from '@/services/googleDriveSyncService'
import { SettingsService } from '@/services/settingsService'

defineOptions({ name: 'SettingsView' })

const clientId = computed(() => (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '').trim())

const db = useDatabase()
const auth = new GoogleAuthService(clientId.value || '')
const settingsSvc = new SettingsService(db)
const drive = new GoogleDriveSyncService(db, auth, settingsSvc)

/** 표시용 이메일 — GIS 캐시 우선이나 DB 에도 남겨 두면 새로고침 후에 표시 가능 */
const displayEmail = ref('')
const exporting = ref(false)
const importing = ref(false)
const signingIn = ref(false)
const pulling = ref(false)
const pushing = ref(false)
/** 체중×계수 목표 계산 등에 쓰이는 설정 값 */
const proteinFactor = ref<number>(1.7)

const hasClientId = computed(() => Boolean(clientId.value))
const loggedInLikely = computed(
  () =>
    Boolean(
      displayEmail.value ||
        auth.getCachedEmail() ||
        auth.isSignedIn(),
    ),
)

onMounted(() => void bootstrap())

async function bootstrap(): Promise<void> {
  const emailFromDb = await settingsSvc.get('google_account_email')
  displayEmail.value = auth.getCachedEmail() || emailFromDb || ''
  const pv = await settingsSvc.get('protein_factor')
  const n = pv ? Number(pv) : NaN
  proteinFactor.value = Number.isFinite(n) && n > 0 ? n : 1.7
}

async function saveProteinFactor(): Promise<void> {
  const v = proteinFactor.value
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n) || n <= 0) {
    ElMessage.warning('0보다 큰 숫자를 입력해 주세요.')
    return
  }
  await settingsSvc.set('protein_factor', String(n))
  ElMessage.success('단백질 계수를 저장했습니다.')
}

async function signInGoogle(): Promise<void> {
  if (!hasClientId.value) {
    ElMessage.error('먼저 .env 에 VITE_GOOGLE_CLIENT_ID 를 넣어 주세요.')
    return
  }
  signingIn.value = true
  try {
    const prevEmail = await settingsSvc.get('google_account_email')
    const { email } = await auth.signIn()

    /** 계정 바뀌면 Drive 파일 id 가 무의미할 수 있어 메타만 비웁니다 — 한글 안내와 동일 */
    if (prevEmail && prevEmail !== email) {
      try {
        await ElMessageBox.confirm(
          '이전과 다른 Google 계정입니다. Drive 연동 정보(파일 식별·마지막 동기 시각)만 초기화할까요? 이 기기에 이미 들어 있는 기록은 그대로 둡니다.',
          '계정 변경',
          { confirmButtonText: '초기화 후 계속', cancelButtonText: '취소', type: 'warning' },
        )
        await settingsSvc.clearDriveMeta()
      } catch {
        auth.signOut()
        await settingsSvc.deleteKey('google_account_email')
        displayEmail.value = ''
        ElMessage.info('로그인을 취소했습니다.')
        return
      }
    }

    await settingsSvc.set('google_account_email', email)
    displayEmail.value = email
    ElMessage.success('Google 계정과 연결되었습니다.')
  } catch (e: unknown) {
    console.error(e)
    const msg = e instanceof Error ? e.message : '로그인에 실패했습니다.'
    ElMessage.error(msg)
  } finally {
    signingIn.value = false
  }
}

async function signOutGoogle(): Promise<void> {
  try {
    await ElMessageBox.confirm('Drive 연동 세션만 지웁니다. 로컬 기록은 남습니다.', '로그아웃', {
      type: 'info',
      confirmButtonText: '로그아웃',
      cancelButtonText: '돌아가기',
    })
  } catch {
    return
  }
  auth.signOut()
  await settingsSvc.deleteKey('google_account_email')
  displayEmail.value = ''
  ElMessage.success('로그아웃했습니다.')
}

async function pullDrive(): Promise<void> {
  pulling.value = true
  try {
    await ElMessageBox.confirm(
      'Drive 의 restTime/health.db 로 이 기기 통째 바꿉니다. 덮어쓰기 전에 필요하면 로컬에서 먼저 내보내세요.',
      'Drive에서 불러오기',
      { type: 'warning', confirmButtonText: '불러오기', cancelButtonText: '취소' },
    )
    await drive.pull()
    const pv = await settingsSvc.get('protein_factor')
    const n = pv ? Number(pv) : NaN
    proteinFactor.value = Number.isFinite(n) && n > 0 ? n : 1.7
    const mail = auth.getCachedEmail() ?? (await settingsSvc.get('google_account_email')) ?? ''
    displayEmail.value = mail
    ElMessage.success('Drive에서 불러왔습니다.')
  } catch (e: unknown) {
    if ((e as { message?: string })?.message?.includes?.('cancel')) return
    console.error(e)
    const msg =
      typeof e === 'object' &&
      e &&
      typeof (e as { message?: string }).message === 'string'
        ? (e as { message?: string }).message!
        : '불러오기에 실패했습니다.'
    ElMessage.error(msg)
  } finally {
    pulling.value = false
  }
}

async function pushDrive(): Promise<void> {
  pushing.value = true
  try {
    const first = await drive.push(false)
    if (first.ok) {
      ElMessage.success('Drive에 저장했습니다.')
      return
    }
    if (first.reason !== 'remote_newer') return
    try {
      await ElMessageBox.confirm(
        `Drive 쪽 파일이 이 기기가 기록한 마지막 동기보다 최신입니다 (원격: ${first.remoteModified}). 그래도 이 기기 내용으로 덮어쓸까요?`,
        '원격이 더 새로움',
        { type: 'warning', confirmButtonText: '덮어쓰기', cancelButtonText: '취소' },
      )
    } catch {
      return
    }
    const second = await drive.push(true)
    if (!second.ok) {
      ElMessage.error('덮어쓰기에 실패했습니다.')
      return
    }
    ElMessage.success('Drive에 저장했습니다.')
  } catch (e: unknown) {
    console.error(e)
    const msg =
      typeof e === 'object' &&
      e &&
      typeof (e as { message?: string }).message === 'string'
        ? (e as { message?: string }).message!
        : '저장에 실패했습니다.'
    ElMessage.error(msg)
  } finally {
    pushing.value = false
  }
}

async function exportDatabase(): Promise<void> {
  exporting.value = true
  try {
    const bytes = await db.exportBlob()
    const blob = new Blob([Uint8Array.prototype.slice.call(bytes)], { type: 'application/x-sqlite3' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `resttime-backup-${new Date().toISOString().slice(0, 10)}.sqlite`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  } finally {
    exporting.value = false
  }
}

async function handleFileChange(uploadFile: UploadFile): Promise<void> {
  importing.value = true
  try {
    const raw = uploadFile.raw
    if (!(raw instanceof File)) throw new Error('파일을 선택해 주세요.')
    const buf = new Uint8Array(await raw.arrayBuffer())
    await db.importBlob(buf)
    await bootstrap()
    ElMessage.success('DB를 덮어썼습니다.')
  } catch (e: unknown) {
    const msg =
      typeof e === 'object' &&
      e &&
      typeof (e as { message?: string }).message === 'string'
        ? (e as { message?: string }).message!
        : '가져오기에 실패했습니다.'
    window.alert(msg)
  } finally {
    importing.value = false
  }
}
</script>

<template>
  <div class="view">
    <el-alert v-if="!hasClientId" title="클라이언트 ID 없음" type="warning" show-icon class="mb">
      <template #default>
        <code>VITE_GOOGLE_CLIENT_ID</code> 가 비어 있습니다. 프로젝트 루트 <code>.env</code> 와
        <strong>docs/google-setup.md</strong> 를 참고해 주세요. 변경 후 dev 서버를 재시작합니다.
      </template>
    </el-alert>

    <el-card shadow="never" class="mb">
      <template #header>
        <span class="hdr">기능</span>
      </template>
      <nav class="feature-links" aria-label="추가 기능">
        <RouterLink to="/meal-presets" class="feature-link">식단 프리셋</RouterLink>
        <RouterLink to="/inbody" class="feature-link">인바디 기록</RouterLink>
        <RouterLink to="/workout-presets" class="feature-link">운동 프리셋</RouterLink>
        <RouterLink to="/gpt" class="feature-link">GPT 복사</RouterLink>
      </nav>
    </el-card>

    <el-card shadow="never" class="mb">
      <template #header>
        <span class="hdr">Google Drive 동기화</span>
      </template>
      <p class="hint">
        고정 위치에 백업합니다: 폴더 <code>{{ 'restTime' }}</code>, 파일 <code>{{ 'health.db' }}</code> — 본인 Drive
        에만 작성됩니다.
      </p>
      <div class="acct">
        <span v-if="displayEmail"><strong>{{ displayEmail }}</strong></span>
        <span v-else class="muted">연결된 계정 없음</span>
      </div>
      <el-space wrap class="mt">
        <el-button type="primary" :loading="signingIn" @click="signInGoogle">Google 로그인</el-button>
        <el-button :disabled="!loggedInLikely" @click="signOutGoogle">로그아웃</el-button>
        <el-button :icon="Refresh" :loading="pulling" type="warning" plain @click="pullDrive">
          Drive에서 불러오기
        </el-button>
        <el-button :icon="Upload" :loading="pushing" type="success" plain @click="pushDrive">
          Drive에 저장하기
        </el-button>
      </el-space>
      <p class="hint mt">
        토큰이 만료되었으면 Drive 버튼 실행 시 재로그인 안내가 뜰 수 있습니다. 오프라인 입력은 로컬 DB 에만 적용되며, 온라인일
        때 수동으로 저장하세요(PRD).
      </p>
    </el-card>

    <el-card shadow="never" class="mb">
      <template #header>
        <span class="hdr">단백질 계수</span>
      </template>
      <p class="hint">일일 목표 단백질(g) = 최근 체중(kg) × 이 계수. 인바디는 「기능」에서 기록합니다.</p>
      <div class="protein-row">
        <el-input-number v-model="proteinFactor" :min="0.1" :max="10" :step="0.1" :precision="2" controls-position="right" />
        <el-button type="primary" @click="saveProteinFactor">저장</el-button>
      </div>
    </el-card>

    <el-card shadow="never">
      <template #header>
        <span class="hdr">SQLite 로컬 백업(개발·비상 복구)</span>
      </template>
      <el-space wrap>
        <el-button type="primary" :loading="exporting" @click="exportDatabase"> DB 내보내기(blob) </el-button>

        <el-upload :auto-upload="false" accept=".sqlite,.db,application/octet-stream" :show-file-list="false" @change="handleFileChange">
          <template #trigger>
            <el-button type="default" :loading="importing">DB 가져오기(blob)</el-button>
          </template>
        </el-upload>
      </el-space>
      <p class="hint">
        OPFS/IndexedDB 에 저장되어 새로 고침 후 유지되는 DB 를, 파일 하나로 들고 이동할 때 사용합니다.
      </p>
    </el-card>
  </div>
</template>

<style scoped>
.view {
  padding: var(--spacing, 16px);
  max-width: 720px;
  margin: 0 auto;
}
.mb {
  margin-bottom: 16px;
}
.mt {
  margin-top: 10px;
}
.hdr {
  font-weight: 600;
}
.hint {
  margin: 8px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  line-height: 1.5;
}
.acct {
  margin-top: 8px;
  font-size: 14px;
}
.muted {
  color: var(--el-text-color-secondary);
}
.protein-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  margin-top: 12px;
}
.feature-links {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.feature-link {
  color: var(--el-color-primary);
  text-decoration: none;
  font-size: 14px;
}
.feature-link:hover {
  text-decoration: underline;
}
</style>
