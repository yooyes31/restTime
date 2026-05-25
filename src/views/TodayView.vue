<script setup lang="ts">
/** 오늘 식단 CRUD · 일별 합계 — Issue #2 */
import type { MealType } from '@/types/domain'

import { ArrowDown, ArrowUp, Delete, Plus } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, onMounted, onUnmounted, ref } from 'vue'

import { useDatabase } from '@/composables/useDatabase'
import { MealLogService, type MealEntry } from '@/services/mealLogService'
import { MealPresetService, type MealPreset, type MealPresetType } from '@/services/mealPresetService'
import { todayLocalIso } from '@/utils/dateIso'
import TodaySummaryCard from '@/components/today/TodaySummaryCard.vue'
import TodayWorkoutPresetSection from '@/components/today/TodayWorkoutPresetSection.vue'
import TodayWorkoutSessionsSection from '@/components/today/TodayWorkoutSessionsSection.vue'
import { WorkoutPresetService, type WorkoutPresetWithItems } from '@/services/workoutPresetService'
import { isoDateToWeekday } from '@/utils/weekday'

defineOptions({ name: 'TodayView' })

const MEAL_LABEL: Record<MealType, string> = {
  breakfast: '아침',
  lunch: '점심',
  dinner: '저녁',
  snack: '간식',
}

const MEAL_OPTIONS: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']

const db = useDatabase()
const service = new MealLogService(db)
const presetSvc = new MealPresetService(db)
const workoutPresetSvc = new WorkoutPresetService(db)

const todayWeekday = computed(() => isoDateToWeekday(activeDate.value))
const workoutPresetToday = ref<WorkoutPresetWithItems | null>(null)

const presetsByType = ref<Record<MealPresetType, MealPreset[]>>({
  breakfast: [],
  lunch: [],
  dinner: [],
})

/** 표시 일자 — 기본 오늘(로컬); 탭 진입 시 갱신 */
const activeDate = ref(todayLocalIso())
const entries = ref<MealEntry[]>([])
const totals = ref({ kcal: 0, protein_g: 0 })
const loading = ref(false)
const summaryRef = ref<InstanceType<typeof TodaySummaryCard> | null>(null)
const sessionsRef = ref<InstanceType<typeof TodayWorkoutSessionsSection> | null>(null)

const dateLabel = computed(() => formatKoreanWeekday(activeDate.value))

async function reload(): Promise<void> {
  activeDate.value = todayLocalIso()
  loading.value = true
  try {
    entries.value = await service.listByDate(activeDate.value)
    totals.value = await service.getDailyTotals(activeDate.value)
    await loadPresets()
    workoutPresetToday.value = await workoutPresetSvc.getForWeekday(todayWeekday.value)
    await summaryRef.value?.reload?.()
    await sessionsRef.value?.reload?.()
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void reload()
  /** 페이지 가시 시 오늘 날짜·목록 재로드(브라우저 탭 전환 후 자정 경과 등) */
  const onVis = (): void => {
    if (document.visibilityState === 'visible') void reload()
  }
  document.addEventListener('visibilitychange', onVis)
  onUnmounted(() => document.removeEventListener('visibilitychange', onVis))
})

function formatKoreanWeekday(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  if (!y || !m || !d) return isoDate
  const dt = new Date(y, m - 1, d)
  const w = ['일', '월', '화', '수', '목', '금', '토'][dt.getDay()]
  return `${y}.${String(m).padStart(2, '0')}.${String(d).padStart(2, '0')} (${w})`
}

async function loadPresets(): Promise<void> {
  const types: MealPresetType[] = ['breakfast', 'lunch', 'dinner']
  for (const t of types) {
    presetsByType.value[t] = await presetSvc.listByMealType(t)
  }
}

async function applyPreset(preset: MealPreset): Promise<void> {
  try {
    await service.applyPreset(preset.id, activeDate.value)
    await reload()
    ElMessage.success(`「${preset.name}」 프리셋을 적용했습니다.`)
  } catch (e: unknown) {
    console.error(e)
    ElMessage.error('프리셋 적용에 실패했습니다.')
  }
}

async function addMeal(mealType: MealType): Promise<void> {
  try {
    await service.addEntry({ date: activeDate.value, meal_type: mealType })
    await reload()
    ElMessage.success(`${MEAL_LABEL[mealType]} 끼니를 추가했습니다.`)
  } catch (e: unknown) {
    console.error(e)
    ElMessage.error('추가에 실패했습니다.')
  }
}

async function onDelete(entry: MealEntry): Promise<void> {
  try {
    await service.deleteEntry(entry.id)
    await reload()
  } catch (e: unknown) {
    console.error(e)
    ElMessage.error('삭제에 실패했습니다.')
  }
}

async function savePatch(
  id: number,
  patch: Partial<Pick<MealEntry, 'memo' | 'kcal' | 'protein_g'>>,
): Promise<void> {
  try {
    await service.updateEntry(id, patch)
    totals.value = await service.getDailyTotals(activeDate.value)
  } catch (e: unknown) {
    console.error(e)
    ElMessage.error('저장에 실패했습니다.')
    await reload()
  }
}

async function move(entry: MealEntry, delta: -1 | 1): Promise<void> {
  try {
    await service.moveEntryRelative(activeDate.value, entry.id, delta)
    await reload()
  } catch (e: unknown) {
    console.error(e)
    ElMessage.error('순서 변경에 실패했습니다.')
  }
}
</script>

<template>
  <div class="view">
    <div class="head">
      <h1 class="title">오늘</h1>
      <span class="sub">{{ dateLabel }}</span>
    </div>

    <TodaySummaryCard ref="summaryRef" :intake-kcal="totals.kcal" :intake-protein-g="totals.protein_g" />

    <TodayWorkoutPresetSection :date="activeDate" :weekday="todayWeekday" :data="workoutPresetToday" />

    <TodayWorkoutSessionsSection
      ref="sessionsRef"
      :date="activeDate"
      :today-preset="workoutPresetToday"
    />

    <div class="actions">
      <el-dropdown trigger="click" placement="bottom-start">
        <el-button type="primary" :icon="Plus"> 끼니 추가 </el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item v-for="t in MEAL_OPTIONS" :key="t" @click="addMeal(t)">
              {{ MEAL_LABEL[t] }}
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>

      <el-dropdown trigger="click" placement="bottom-start">
        <el-button type="default"> 프리셋 적용 </el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <template v-for="t in (['breakfast', 'lunch', 'dinner'] as MealPresetType[])" :key="t">
              <el-dropdown-item v-if="presetsByType[t].length === 0" disabled>
                {{ MEAL_LABEL[t] }} — 없음
              </el-dropdown-item>
              <el-dropdown-item
                v-for="p in presetsByType[t]"
                :key="p.id"
                @click="applyPreset(p)"
              >
                {{ MEAL_LABEL[t] }} · {{ p.name }}
              </el-dropdown-item>
            </template>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>

    <el-skeleton v-if="loading" animated :rows="4" />

    <el-empty v-else-if="entries.length === 0" description="기록된 끼니가 없습니다." />

    <div v-else class="cards">
      <section v-for="(e, index) in entries" :key="e.id" class="card-row" :aria-label="MEAL_LABEL[e.meal_type]">
        <el-card shadow="never" class="meal-card">
          <div class="row-top">
            <el-tag size="small" type="info">{{ MEAL_LABEL[e.meal_type] }}</el-tag>
            <div class="row-actions">
              <el-button-group size="small">
                <el-button :icon="ArrowUp" :disabled="index === 0" @click="move(e, -1)" aria-label="위로" />
                <el-button
                  :icon="ArrowDown"
                  :disabled="index === entries.length - 1"
                  @click="move(e, 1)"
                  aria-label="아래로"
                />
              </el-button-group>
              <el-popconfirm title="이 끼니를 삭제할까요?" @confirm="onDelete(e)">
                <template #reference>
                  <el-button :icon="Delete" size="small" type="danger" plain aria-label="삭제" />
                </template>
              </el-popconfirm>
            </div>
          </div>

          <el-input
            v-model="e.memo"
            type="textarea"
            :autosize="{ minRows: 1, maxRows: 4 }"
            placeholder="메모"
            class="memo"
            @blur="savePatch(e.id, { memo: e.memo })"
          />

          <div class="nums">
            <div class="field">
              <span class="label">kcal</span>
              <el-input-number
                v-model="e.kcal"
                :min="0"
                :step="10"
                controls-position="right"
                class="grow"
                @change="savePatch(e.id, { kcal: e.kcal ?? 0 })"
              />
            </div>
            <div class="field">
              <span class="label">단백질(g)</span>
              <el-input-number
                v-model="e.protein_g"
                :min="0"
                :step="1"
                :precision="1"
                controls-position="right"
                class="grow"
                @change="savePatch(e.id, { protein_g: e.protein_g ?? 0 })"
              />
            </div>
          </div>
        </el-card>
      </section>
    </div>

    <!-- 하단 고정 요약 바 — FAB·키보드와 겹치지 않게 패딩 -->
    <div class="sticky-total safe-bottom-extra" role="region" aria-label="오늘 합계">
      <span>합계</span>
      <strong>{{ Math.round(totals.kcal) }} kcal</strong>
      <span class="sep">·</span>
      <strong>{{ totals.protein_g.toFixed(1) }} g 단백질</strong>
    </div>
  </div>
</template>

<style scoped>
.view {
  padding: var(--spacing, 16px);
  padding-bottom: calc(var(--spacing, 16px) + 56px + env(safe-area-inset-bottom, 0px));
  max-width: 720px;
  margin: 0 auto;
}

.head {
  margin-bottom: 12px;
}
.title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
}
.sub {
  display: inline-block;
  margin-top: 4px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.actions {
  margin-bottom: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.cards {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.meal-card {
  border-radius: 12px;
}

.row-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  gap: 8px;
}
.row-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.memo {
  margin-bottom: 10px;
}

.nums {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.grow {
  width: 100%;
}

.sticky-total {
  position: fixed;
  left: 0;
  right: 0;
  bottom: calc(56px + env(safe-area-inset-bottom, 0px));
  padding: 10px calc(16px + env(safe-area-inset-left)) 10px calc(16px + env(safe-area-inset-right));
  border-top: 1px solid var(--el-border-color);
  background: var(--el-bg-color-overlay, var(--el-bg-color));
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  z-index: 5;
}

.safe-bottom-extra {
  /* reserved for tab bar stacking */
}

.sticky-total .sep {
  color: var(--el-text-color-secondary);
}

@media (prefers-reduced-motion: reduce) {
  .meal-card {
    transition: none;
  }
}
</style>
