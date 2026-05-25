<script setup lang="ts">
/** 오늘 운동 세션 CRUD — Issue #6 */
import type { WorkoutPresetWithItems } from '@/services/workoutPresetService'

import { Delete, Plus } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { onMounted, ref, watch } from 'vue'

import { useDatabase } from '@/composables/useDatabase'
import { WorkoutService, type WorkoutSession } from '@/services/workoutService'

const props = defineProps<{
  date: string
  todayPreset: WorkoutPresetWithItems | null
}>()

defineOptions({ name: 'TodayWorkoutSessionsSection' })

const db = useDatabase()
const svc = new WorkoutService(db)

const sessions = ref<WorkoutSession[]>([])
const loading = ref(false)
const dialogOpen = ref(false)
const editingId = ref<number | null>(null)
const form = ref({
  name: '',
  minutes: 30,
  linkPreset: false,
})

async function reload(): Promise<void> {
  loading.value = true
  try {
    sessions.value = await svc.listByDate(props.date)
  } finally {
    loading.value = false
  }
}

onMounted(() => void reload())
watch(() => props.date, () => void reload())

function openCreate(fromPreset = false): void {
  editingId.value = null
  form.value = {
    name: fromPreset && props.todayPreset ? props.todayPreset.preset.name : '',
    minutes: 30,
    linkPreset: fromPreset && Boolean(props.todayPreset),
  }
  dialogOpen.value = true
}

function openEdit(row: WorkoutSession): void {
  editingId.value = row.id
  form.value = {
    name: row.name,
    minutes: row.minutes,
    linkPreset: row.preset_id !== null,
  }
  dialogOpen.value = true
}

async function saveForm(): Promise<void> {
  const name = form.value.name.trim()
  if (!name) {
    ElMessage.warning('운동 이름을 입력해 주세요.')
    return
  }
  const presetId =
    form.value.linkPreset && props.todayPreset ? props.todayPreset.preset.id : null
  try {
    if (editingId.value === null) {
      await svc.addSession({
        date: props.date,
        name,
        minutes: form.value.minutes,
        preset_id: presetId,
      })
      ElMessage.success('운동 세션을 추가했습니다.')
    } else {
      await svc.updateSession(editingId.value, {
        name,
        minutes: form.value.minutes,
        preset_id: presetId,
      })
      ElMessage.success('저장했습니다.')
    }
    dialogOpen.value = false
    await reload()
  } catch (e: unknown) {
    console.error(e)
    ElMessage.error('저장에 실패했습니다.')
  }
}

async function remove(row: WorkoutSession): Promise<void> {
  try {
    await ElMessageBox.confirm(`「${row.name}」 세션을 삭제할까요?`, '삭제', { type: 'warning' })
    await svc.deleteSession(row.id)
    await reload()
    ElMessage.success('삭제했습니다.')
  } catch {
    /* cancel */
  }
}

defineExpose({ reload })
</script>

<template>
  <el-card shadow="never" class="section-card">
    <template #header>
      <div class="hdr-row">
        <span class="hdr">운동 세션</span>
        <el-space wrap>
          <el-button v-if="todayPreset" size="small" @click="openCreate(true)">프리셋으로 추가</el-button>
          <el-button type="primary" size="small" :icon="Plus" @click="openCreate(false)">세션 추가</el-button>
        </el-space>
      </div>
    </template>

    <el-skeleton v-if="loading" animated :rows="2" />
    <el-empty v-else-if="sessions.length === 0" description="기록된 운동이 없습니다." :image-size="64" />

    <ul v-else class="list">
      <li v-for="s in sessions" :key="s.id" class="row">
        <div class="main">
          <strong>{{ s.name }}</strong>
          <span class="meta">{{ s.minutes }}분</span>
          <el-tag v-if="s.preset_id" size="small" type="info">프리셋 연결</el-tag>
        </div>
        <div class="acts">
          <el-button link type="primary" @click="openEdit(s)">편집</el-button>
          <el-button link type="danger" :icon="Delete" @click="remove(s)" />
        </div>
      </li>
    </ul>

    <el-dialog v-model="dialogOpen" :title="editingId ? '세션 편집' : '세션 추가'" width="92%" style="max-width: 400px">
      <el-form label-position="top">
        <el-form-item label="운동 이름" required>
          <el-input v-model="form.name" placeholder="예: Push Day" />
        </el-form-item>
        <el-form-item label="시간(분)" required>
          <el-input-number v-model="form.minutes" :min="1" :step="5" controls-position="right" class="full" />
        </el-form-item>
        <el-form-item v-if="todayPreset">
          <el-checkbox v-model="form.linkPreset">오늘 프리셋({{ todayPreset.preset.name }}) 연결</el-checkbox>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogOpen = false">취소</el-button>
        <el-button type="primary" @click="saveForm">저장</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<style scoped>
.section-card {
  margin-bottom: 12px;
  border-radius: 12px;
}
.hdr-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.hdr {
  font-weight: 600;
}
.list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.row:last-child {
  border-bottom: none;
}
.main {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}
.meta {
  color: var(--el-text-color-secondary);
}
.acts {
  flex-shrink: 0;
}
.full {
  width: 100%;
}
</style>
