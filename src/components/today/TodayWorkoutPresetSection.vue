<script setup lang="ts">
/** 오늘 요일 운동 — 프리셋 기반, 당일 종목·메모 수정 가능 */
import type { WorkoutPresetWithItems } from '@/services/workoutPresetService'
import type { WorkoutDayLogInput } from '@/services/workoutDayLogService'

import { ArrowDown, ArrowUp, Delete, Plus } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { onMounted, ref, watch } from 'vue'

import { useDatabase } from '@/composables/useDatabase'
import { WorkoutDayLogService } from '@/services/workoutDayLogService'
import { weekdayLabel } from '@/utils/weekday'
import type { Weekday } from '@/types/domain'

const props = defineProps<{
  date: string
  weekday: Weekday
  data: WorkoutPresetWithItems | null
}>()

defineOptions({ name: 'TodayWorkoutPresetSection' })

const db = useDatabase()
const dayLogSvc = new WorkoutDayLogService(db)

const items = ref<WorkoutDayLogInput[]>([])
const loading = ref(false)
const dirty = ref(false)

async function reload(): Promise<void> {
  loading.value = true
  try {
    const saved = await dayLogSvc.listByDate(props.date)
    if (saved.length > 0) {
      items.value = saved.map((r) => ({
        exercise_name: r.exercise_name,
        sets: r.sets,
        reps: r.reps,
        weight_kg: r.weight_kg,
        memo: r.memo,
      }))
    } else if (props.data) {
      items.value = WorkoutDayLogService.fromPresetItems(props.data.items)
    } else {
      items.value = []
    }
    dirty.value = false
  } finally {
    loading.value = false
  }
}

onMounted(() => void reload())
watch(() => [props.date, props.data], () => void reload())

function markDirty(): void {
  dirty.value = true
}

function addItem(): void {
  items.value.push({ exercise_name: '', sets: 3, reps: 10, weight_kg: null, memo: '' })
  markDirty()
}

function removeItem(index: number): void {
  items.value.splice(index, 1)
  markDirty()
}

function moveItem(index: number, delta: -1 | 1): void {
  const j = index + delta
  if (j < 0 || j >= items.value.length) return
  const tmp = items.value[index]!
  items.value[index] = items.value[j]!
  items.value[j] = tmp
  markDirty()
}

function resetFromPreset(): void {
  if (!props.data) return
  items.value = WorkoutDayLogService.fromPresetItems(props.data.items)
  markDirty()
}

async function save(): Promise<void> {
  const valid = items.value.filter((it) => it.exercise_name.trim())
  if (valid.length === 0) {
    ElMessage.warning('종목을 1개 이상 입력해 주세요.')
    return
  }
  await dayLogSvc.replaceForDate(props.date, valid)
  dirty.value = false
  ElMessage.success('오늘 운동 기록을 저장했습니다.')
  await reload()
}

defineExpose({ reload })
</script>

<template>
  <el-card shadow="never" class="section-card">
    <template #header>
      <div class="hdr-row">
        <span class="hdr">오늘 운동 ({{ weekdayLabel(weekday) }})</span>
        <el-space wrap v-if="items.length > 0 || data">
          <el-button v-if="data" size="small" @click="resetFromPreset">프리셋 불러오기</el-button>
          <el-button type="primary" size="small" @click="save">저장</el-button>
        </el-space>
      </div>
    </template>

    <el-skeleton v-if="loading" animated :rows="3" />
    <el-empty v-else-if="!data && items.length === 0" description="오늘 요일 프리셋이 없습니다." :image-size="64" />

    <template v-else>
      <p v-if="data" class="preset-name">루틴: {{ data.preset.name }} · 아래는 오늘 실제 기록(프리셋과 별도 저장)</p>

      <div v-for="(it, idx) in items" :key="idx" class="item-row">
        <el-input v-model="it.exercise_name" placeholder="종목" class="grow" @input="markDirty" />
        <el-input-number v-model="it.sets" :min="1" controls-position="right" class="num" @change="markDirty" />
        <span class="x">×</span>
        <el-input-number v-model="it.reps" :min="1" controls-position="right" class="num" @change="markDirty" />
        <el-input-number
          v-model="it.weight_kg"
          :min="0"
          :precision="1"
          placeholder="kg"
          controls-position="right"
          class="num"
          @change="markDirty"
        />
        <el-input v-model="it.memo" placeholder="메모" class="memo" @input="markDirty" />
        <el-button-group size="small">
          <el-button :icon="ArrowUp" :disabled="idx === 0" @click="moveItem(idx, -1)" />
          <el-button :icon="ArrowDown" :disabled="idx === items.length - 1" @click="moveItem(idx, 1)" />
        </el-button-group>
        <el-button :icon="Delete" type="danger" plain @click="removeItem(idx)" />
      </div>

      <el-button :icon="Plus" class="mt" @click="addItem">종목 추가</el-button>
    </template>
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
.preset-name {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
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
  min-width: 100px;
}
.memo {
  flex: 1;
  min-width: 120px;
}
.num {
  width: 80px;
}
.x {
  color: var(--el-text-color-secondary);
}
.mt {
  margin-top: 8px;
}
</style>
