<script setup lang="ts">
/** 오늘 요일 운동 프리셋 — 읽기 전용 체크리스트 (Issue #5) */
import type { WorkoutPresetWithItems } from '@/services/workoutPresetService'

import { weekdayLabel } from '@/utils/weekday'
import type { Weekday } from '@/types/domain'

defineProps<{
  weekday: Weekday
  data: WorkoutPresetWithItems | null
}>()

defineOptions({ name: 'TodayWorkoutPresetSection' })
</script>

<template>
  <el-card shadow="never" class="section-card">
    <template #header>
      <span class="hdr">오늘 운동 ({{ weekdayLabel(weekday) }})</span>
    </template>
    <el-empty v-if="!data" description="오늘 요일 프리셋이 없습니다." :image-size="64" />
    <div v-else>
      <p class="preset-name">{{ data.preset.name }}</p>
      <ul class="list">
        <li v-for="it in data.items" :key="it.id">
          {{ it.exercise_name }} — {{ it.sets }}×{{ it.reps }}
          <span v-if="it.weight_kg !== null"> @ {{ it.weight_kg }}kg</span>
        </li>
      </ul>
    </div>
  </el-card>
</template>

<style scoped>
.section-card {
  margin-bottom: 12px;
  border-radius: 12px;
}
.hdr {
  font-weight: 600;
}
.preset-name {
  margin: 0 0 8px;
  font-weight: 600;
}
.list {
  margin: 0;
  padding-left: 18px;
  font-size: 14px;
  line-height: 1.6;
}
</style>
