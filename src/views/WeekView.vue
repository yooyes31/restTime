<script setup lang="ts">
/** 주간(월~일) 표 · 일평균 · 인바디 — Issue #7 */
import type { WeeklySummary } from '@/services/weeklySummaryAggregator'

import { ArrowLeft, ArrowRight } from '@element-plus/icons-vue'
import { computed, onMounted, ref } from 'vue'

import { useDatabase } from '@/composables/useDatabase'
import { WeeklySummaryAggregator } from '@/services/weeklySummaryAggregator'
import { todayLocalIso } from '@/utils/dateIso'
import { isoDateToWeekday, weekdayLabel } from '@/utils/weekday'
import { shiftWeekAnchor } from '@/utils/weekRange'

defineOptions({ name: 'WeekView' })

const db = useDatabase()
const agg = new WeeklySummaryAggregator(db)

const anchor = ref(todayLocalIso())
const summary = ref<WeeklySummary | null>(null)
const loading = ref(false)

const rangeLabel = computed(() => {
  const s = summary.value
  if (!s) return ''
  return `${s.range.from} (월) ~ ${s.range.to} (일)`
})

const tableRows = computed(() => {
  const s = summary.value
  if (!s) return []
  return s.mealsByDay.map((m, i) => ({
    weekday: weekdayLabel(isoDateToWeekday(m.date)),
    date: m.date,
    kcal: Math.round(m.kcal),
    protein_g: m.protein_g.toFixed(1),
    deficit: s.deficitsByDay[i]?.deficit,
    sessions: s.sessionsByDay[i]?.count ?? 0,
  }))
})

async function reload(): Promise<void> {
  loading.value = true
  try {
    summary.value = await agg.buildSummary(anchor.value)
  } finally {
    loading.value = false
  }
}

onMounted(() => void reload())

function prevWeek(): void {
  anchor.value = shiftWeekAnchor(anchor.value, -1)
  void reload()
}

function nextWeek(): void {
  anchor.value = shiftWeekAnchor(anchor.value, 1)
  void reload()
}

function goThisWeek(): void {
  anchor.value = todayLocalIso()
  void reload()
}
</script>

<template>
  <div class="view">
    <div class="head">
      <h1 class="title">주간</h1>
      <p class="sub">{{ rangeLabel }}</p>
    </div>

    <div class="nav touch-row">
      <el-button :icon="ArrowLeft" @click="prevWeek">이전 주</el-button>
      <el-button @click="goThisWeek">이번 주</el-button>
      <el-button :icon="ArrowRight" @click="nextWeek">다음 주</el-button>
    </div>

    <el-skeleton v-if="loading" animated :rows="6" />

    <template v-else-if="summary">
      <el-card shadow="never" class="mb">
        <template #header><span class="hdr">요약</span></template>
        <div class="stats">
          <div class="stat">
            <span class="label">일평균 kcal</span>
            <strong>{{ Math.round(summary.avgKcal) }}</strong>
          </div>
          <div class="stat">
            <span class="label">일평균 단백질</span>
            <strong>
              {{ summary.avgProtein.toFixed(1) }} g
              <template v-if="summary.proteinTargetG">
                / 목표 {{ summary.proteinTargetG.toFixed(1) }} g
                <span v-if="summary.proteinAvgMet !== null">{{
                  summary.proteinAvgMet ? '✅' : '❌'
                }}</span>
              </template>
            </strong>
          </div>
          <div class="stat">
            <span class="label">운동 세션</span>
            <strong>{{ summary.workoutSessionCount }}회</strong>
          </div>
        </div>
      </el-card>

      <el-card shadow="never" class="mb table-wrap table-scroll">
        <template #header><span class="hdr">요일별</span></template>
        <el-table :data="tableRows" stripe size="small" style="width: 100%">
          <el-table-column prop="weekday" label="요일" width="56" />
          <el-table-column prop="date" label="날짜" width="110" />
          <el-table-column prop="kcal" label="kcal" width="80" />
          <el-table-column prop="protein_g" label="단백(g)" width="88" />
          <el-table-column label="적자">
            <template #default="{ row }">
              <span v-if="row.deficit === null" class="muted">소모 미설정</span>
              <span v-else>{{ Math.round(row.deficit) }} kcal</span>
            </template>
          </el-table-column>
          <el-table-column prop="sessions" label="운동" width="56" />
        </el-table>
      </el-card>

      <el-card shadow="never" class="mb">
        <template #header><span class="hdr">인바디 (최근 {{ summary.inbodyRecent.length }}회)</span></template>
        <el-empty v-if="summary.inbodyRecent.length === 0" description="인바디 기록 없음" :image-size="64" />
        <template v-else>
          <p v-if="summary.inbodyAverage" class="avg">
            {{ summary.inbodyAverage.count }}회 평균 — 체지방
            {{ summary.inbodyAverage.body_fat_pct.toFixed(1) }}% · 근육
            {{ summary.inbodyAverage.muscle_kg.toFixed(1) }}kg · 소모
            {{ Math.round(summary.inbodyAverage.burn_kcal) }} kcal
          </p>
          <ul class="inbody-list">
            <li v-for="log in summary.inbodyRecent" :key="log.id">
              {{ String(log.measured_at).slice(0, 10) }} — 체지방 {{ log.body_fat_pct }}% / 근육
              {{ log.muscle_kg }}kg / 소모 {{ Math.round(log.burn_kcal) }} kcal
            </li>
          </ul>
        </template>
      </el-card>
    </template>
  </div>
</template>

<style scoped>
.view {
  padding: var(--spacing, 16px);
  max-width: 800px;
  margin: 0 auto;
  padding-bottom: calc(var(--spacing, 16px) + 56px + env(safe-area-inset-bottom, 0px));
}
.head {
  margin-bottom: 12px;
}
.title {
  margin: 0;
  font-size: 22px;
}
.sub {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.nav {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}
.mb {
  margin-bottom: 16px;
}
.hdr {
  font-weight: 600;
}
.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
}
.stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.table-wrap {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
.table-wrap :deep(.el-table) {
  min-width: 520px;
}
.muted {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.avg {
  margin: 0 0 8px;
  font-size: 14px;
}
.inbody-list {
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
  line-height: 1.6;
}
</style>
