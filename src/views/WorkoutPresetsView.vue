<script setup lang="ts">
/** 운동 프리셋 — 요일별 1개 (Issue #5) */
import type { Weekday } from '@/types/domain'

import { ArrowDown, ArrowUp, Delete, Plus } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { onMounted, ref, watch } from 'vue'

import { useDatabase } from '@/composables/useDatabase'
import {
  WorkoutPresetService,
  type WorkoutPresetItemInput,
  type WorkoutPresetWithItems,
} from '@/services/workoutPresetService'
import { ALL_WEEKDAYS, weekdayLabel } from '@/utils/weekday'

defineOptions({ name: 'WorkoutPresetsView' })

const db = useDatabase()
const svc = new WorkoutPresetService(db)

const activeWeekday = ref<Weekday>(0)
const current = ref<WorkoutPresetWithItems | null>(null)
const loading = ref(false)
const presetName = ref('')
const items = ref<WorkoutPresetItemInput[]>([])

async function reload(): Promise<void> {
  loading.value = true
  try {
    current.value = await svc.getForWeekday(activeWeekday.value)
    if (current.value) {
      presetName.value = current.value.preset.name
      items.value = current.value.items.map((it) => ({
        exercise_name: it.exercise_name,
        sets: it.sets,
        reps: it.reps,
        weight_kg: it.weight_kg,
      }))
    } else {
      presetName.value = ''
      items.value = []
    }
  } finally {
    loading.value = false
  }
}

onMounted(() => void reload())
watch(activeWeekday, () => void reload())

function addItem(): void {
  items.value.push({ exercise_name: '', sets: 3, reps: 10, weight_kg: null })
}

function removeItem(index: number): void {
  items.value.splice(index, 1)
}

function moveItem(index: number, delta: -1 | 1): void {
  const j = index + delta
  if (j < 0 || j >= items.value.length) return
  const tmp = items.value[index]
  items.value[index] = items.value[j]
  items.value[j] = tmp
}

async function save(): Promise<void> {
  const name = presetName.value.trim()
  if (!name) {
    ElMessage.warning('프리셋 이름을 입력해 주세요.')
    return
  }
  const validItems = items.value.filter((it) => it.exercise_name.trim())
  if (validItems.length === 0) {
    ElMessage.warning('종목을 1개 이상 입력해 주세요.')
    return
  }
  try {
    if (current.value) {
      await ElMessageBox.confirm(
        `${weekdayLabel(activeWeekday.value)}요일 기존 프리셋을 덮어씁니다.`,
        '저장',
        { type: 'warning' },
      )
    }
    await svc.savePresetForWeekday(
      activeWeekday.value,
      name,
      validItems,
      current.value?.preset.id ?? null,
    )
    ElMessage.success('저장했습니다.')
    await reload()
  } catch {
    /* cancel */
  }
}

async function deletePreset(): Promise<void> {
  if (!current.value) return
  try {
    await ElMessageBox.confirm('이 요일 프리셋을 삭제할까요?', '삭제', { type: 'warning' })
    await svc.deletePreset(current.value.preset.id)
    ElMessage.success('삭제했습니다.')
    await reload()
  } catch {
    /* cancel */
  }
}
</script>

<template>
  <div class="view">
    <h1 class="title">운동 프리셋</h1>
    <p class="hint">요일당 1개 루틴. 오늘 화면에 체크리스트로 표시됩니다.</p>

    <el-radio-group v-model="activeWeekday" class="weekday-row">
      <el-radio-button v-for="w in ALL_WEEKDAYS" :key="w" :value="w">{{ weekdayLabel(w) }}</el-radio-button>
    </el-radio-group>

    <el-skeleton v-if="loading" animated :rows="4" class="mt" />

    <template v-else>
      <el-form label-position="top" class="mt">
        <el-form-item label="루틴 이름">
          <el-input v-model="presetName" placeholder="예: Push Day" />
        </el-form-item>
      </el-form>

      <div v-for="(it, idx) in items" :key="idx" class="item-row">
        <el-input v-model="it.exercise_name" placeholder="종목" class="grow" />
        <el-input-number v-model="it.sets" :min="1" controls-position="right" class="num" />
        <span class="x">×</span>
        <el-input-number v-model="it.reps" :min="1" controls-position="right" class="num" />
        <el-input-number
          v-model="it.weight_kg"
          :min="0"
          :precision="1"
          placeholder="kg"
          controls-position="right"
          class="num"
        />
        <el-button-group size="small">
          <el-button :icon="ArrowUp" :disabled="idx === 0" @click="moveItem(idx, -1)" />
          <el-button :icon="ArrowDown" :disabled="idx === items.length - 1" @click="moveItem(idx, 1)" />
        </el-button-group>
        <el-button :icon="Delete" type="danger" plain @click="removeItem(idx)" />
      </div>

      <el-button :icon="Plus" class="mt" @click="addItem">종목 추가</el-button>

      <div class="actions mt">
        <el-button type="primary" @click="save">저장</el-button>
        <el-button v-if="current" type="danger" plain @click="deletePreset">삭제</el-button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.view {
  padding: var(--spacing, 16px);
  max-width: 720px;
  margin: 0 auto;
}
.title {
  margin: 0 0 4px;
  font-size: 22px;
}
.hint {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.weekday-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.mt {
  margin-top: 12px;
}
.item-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}
.grow {
  flex: 1;
  min-width: 120px;
}
.num {
  width: 88px;
}
.x {
  color: var(--el-text-color-secondary);
}
.actions {
  display: flex;
  gap: 8px;
}
</style>
