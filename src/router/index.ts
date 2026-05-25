import { createRouter, createWebHistory } from 'vue-router'

import SettingsView from '@/views/SettingsView.vue'
import TodayView from '@/views/TodayView.vue'
import WeekView from '@/views/WeekView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/today' },
    {
      path: '/today',
      name: 'today',
      component: TodayView,
      meta: { title: '오늘' },
    },
    {
      path: '/week',
      name: 'week',
      component: WeekView,
      meta: { title: '주간' },
    },
    {
      path: '/settings',
      name: 'settings',
      component: SettingsView,
      meta: { title: '설정' },
    },
    {
      path: '/meal-presets',
      name: 'meal-presets',
      component: () => import('@/views/MealPresetsView.vue'),
      meta: { title: '식단 프리셋' },
    },
    {
      path: '/inbody',
      name: 'inbody',
      component: () => import('@/views/InBodyView.vue'),
      meta: { title: '인바디' },
    },
    {
      path: '/workout-presets',
      name: 'workout-presets',
      component: () => import('@/views/WorkoutPresetsView.vue'),
      meta: { title: '운동 프리셋' },
    },
    {
      path: '/gpt',
      name: 'gpt',
      component: () => import('@/views/GptExportView.vue'),
      meta: { title: 'GPT 복사' },
    },
  ],
})

router.afterEach((to) => {
  const title = typeof to.meta.title === 'string' ? `${to.meta.title} · restTime` : 'restTime'
  document.title = title
})

export default router
