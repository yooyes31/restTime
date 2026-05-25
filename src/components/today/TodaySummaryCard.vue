<script setup lang="ts">
/** 오늘 요약 — 소모·적자·단백 목표 (Issue #4) */
import { dailyDeficit } from '@/domain/deficitCalculator'
import { dailyProteinTargetKg, proteinTargetMet } from '@/domain/proteinTargetCalculator'

import { computed, onMounted, ref, watch } from 'vue'

import { useDatabase } from '@/composables/useDatabase'
import { InBodyService } from '@/services/inBodyService'
import { SettingsService } from '@/services/settingsService'

const props = defineProps<{
  intakeKcal: number
  intakeProteinG: number
}>()

defineOptions({ name: 'TodaySummaryCard' })

const db = useDatabase()
const inbodySvc = new InBodyService(db)
const settingsSvc = new SettingsService(db)

const burnKcal = ref<number | null>(null)
const proteinFactor = ref(1.7)
const latestWeight = ref<number | null>(null)

const proteinTarget = computed(() => {
  if (latestWeight.value === null || latestWeight.value <= 0) return null
  return dailyProteinTargetKg(latestWeight.value, proteinFactor.value)
})

const deficit = computed(() => dailyDeficit(burnKcal.value, props.intakeKcal))

const proteinOk = computed(() => {
  const t = proteinTarget.value
  if (t === null || t <= 0) return null
  return proteinTargetMet(props.intakeProteinG, t)
})

async function reload(): Promise<void> {
  const burn = await settingsSvc.get('latest_burn_kcal')
  burnKcal.value = burn !== null && burn !== '' ? Number(burn) : null
  const pf = await settingsSvc.get('protein_factor')
  const pfn = pf ? Number(pf) : NaN
  proteinFactor.value = Number.isFinite(pfn) && pfn > 0 ? pfn : 1.7
  const latest = await inbodySvc.getLatest()
  latestWeight.value = latest?.weight_kg ?? null
}

onMounted(() => void reload())

watch(
  () => [props.intakeKcal, props.intakeProteinG],
  () => {
    /* intake 변경은 computed 로 반영 */
  },
)

defineExpose({ reload })
</script>

<template>
  <el-card shadow="never" class="summary-card">
    <template #header>
      <div class="hdr-row">
        <span class="hdr">오늘 요약</span>
        <RouterLink to="/inbody" class="link">인바디 기록</RouterLink>
      </div>
    </template>
    <div class="grid">
      <div class="cell">
        <span class="label">먹은 칼로리</span>
        <strong>{{ Math.round(intakeKcal) }} kcal</strong>
      </div>
      <div class="cell">
        <span class="label">하루 소모 칼로리</span>
        <strong v-if="burnKcal !== null && Number.isFinite(burnKcal)">{{ Math.round(burnKcal) }} kcal</strong>
        <span v-else class="muted">소모 미설정</span>
      </div>
      <div class="cell">
        <span class="label">적자칼로리</span>
        <template v-if="deficit.ok">
          <strong>{{ Math.round(deficit.deficit) }} kcal</strong>
          <span class="badge">{{ deficit.deficit >= 0 ? '✅' : '❌' }}</span>
        </template>
        <span v-else class="muted">소모 미설정</span>
      </div>
      <div class="cell">
        <span class="label">단백질</span>
        <template v-if="proteinTarget !== null && proteinTarget > 0">
          <strong>{{ intakeProteinG.toFixed(1) }} / {{ proteinTarget.toFixed(1) }} g</strong>
          <span v-if="proteinOk !== null" class="badge">{{ proteinOk ? '✅' : '❌' }}</span>
        </template>
        <span v-else class="muted">목표 미설정 (인바디 필요)</span>
      </div>
    </div>
  </el-card>
</template>

<style scoped>
.summary-card {
  margin-bottom: 12px;
  border-radius: 12px;
}
.hdr-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.hdr {
  font-weight: 600;
}
.link {
  font-size: 13px;
  color: var(--el-color-primary);
  text-decoration: none;
}
.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 14px;
}
.label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.muted {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.badge {
  margin-left: 4px;
}
</style>
