<script setup lang="ts">
/** 전역 앱 껍데기 — 하단 탭 · iOS safe-area 패딩 */
import { Calendar, Notebook, Setting } from '@element-plus/icons-vue'

const tabs = [
  { to: '/today', label: '오늘', icon: Notebook },
  { to: '/week', label: '주간', icon: Calendar },
  { to: '/settings', label: '설정', icon: Setting },
] as const
</script>

<template>
  <div class="app-root">
    <el-container direction="vertical" class="shell">
      <el-header height="auto" class="topbar safe-top">
        <div class="brand">restTime</div>
      </el-header>

      <el-main class="main-pane">
        <router-view />
      </el-main>

      <!-- Element Plus 셸과 통일된 하단 탭 바 (PWA safe-area 포함) -->
      <el-footer class="tab-bar safe-bottom" height="auto" role="navigation" aria-label="주요 화면">
        <RouterLink v-for="t in tabs" :key="t.to" :to="t.to" class="tab touch-target" active-class="active">
          <el-icon :size="20">
            <component :is="t.icon" />
          </el-icon>
          <span>{{ t.label }}</span>
        </RouterLink>
      </el-footer>
    </el-container>
  </div>
</template>

<style scoped>
.app-root {
  height: 100dvh;
  overflow: hidden;
  background-color: var(--el-bg-color);
}
.shell {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.topbar.safe-top {
  flex-shrink: 0;
  padding-top: max(12px, env(safe-area-inset-top));
  padding-left: calc(16px + env(safe-area-inset-left));
  padding-right: calc(16px + env(safe-area-inset-right));
}
.brand {
  font-weight: 700;
  font-size: 18px;
  padding: 8px 0;
}
.main-pane {
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 0;
}
/* 하단 탭 — viewport 하단 고정(본문 스크롤과 분리) */
.tab-bar.el-footer {
  position: relative;
  z-index: 10;
  margin: 0;
  box-sizing: border-box;
  flex-shrink: 0;
  display: flex;
  gap: 4px;
  justify-content: space-around;
  align-items: center;
  min-height: var(--tab-bar-height, 56px);
  padding: 8px calc(12px + env(safe-area-inset-left))
    max(8px, env(safe-area-inset-bottom)) calc(12px + env(safe-area-inset-right));
  border-top: 1px solid var(--el-border-color);
  background-color: var(--el-bg-color);
}
.tab-bar.el-footer .tab {
  flex: 1;
  text-decoration: none;
  appearance: none;
  border: 0;
  background: transparent;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  padding: 6px 4px;
  box-sizing: border-box;
}
.tab-bar.el-footer .tab.active {
  color: var(--el-color-primary);
  font-weight: 600;
}
</style>
