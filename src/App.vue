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
  min-height: 100dvh;
  background-color: var(--el-bg-color);
}
.shell {
  min-height: 100dvh;
}
.topbar.safe-top {
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
  overflow: auto;
}
/* 한 클래스에 패딩/레이아웃 묶음: .tab-bar.el-footer 단독 패딩:0 규칙이 아래 패딩을 덮어쓰면 안 됨 */
.tab-bar.el-footer {
  margin: 0;
  box-sizing: border-box;
  flex-shrink: 0;
  display: flex;
  gap: 4px;
  justify-content: space-around;
  align-items: center;
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
