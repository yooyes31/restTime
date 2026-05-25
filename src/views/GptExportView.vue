<script setup lang="ts">
/** GPT Markdown 미리보기·복사 — Issue #8 */
import { DocumentCopy } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, onMounted, ref, watch } from 'vue'

import { useDatabase } from '@/composables/useDatabase'
import { GptExportFormatter } from '@/services/gptExportFormatter'
import { copyToClipboard } from '@/utils/copyToClipboard'
import { todayLocalIso } from '@/utils/dateIso'
import { getWeekRange } from '@/utils/weekRange'

defineOptions({ name: 'GptExportView' })

type ExportMode = 'today' | 'week' | 'range'

const db = useDatabase()
const formatter = new GptExportFormatter(db)

const mode = ref<ExportMode>('today')
const rangeFrom = ref(todayLocalIso())
const rangeTo = ref(todayLocalIso())
const preview = ref('')
const loading = ref(false)
const copying = ref(false)

const weekHint = computed(() => {
  const r = getWeekRange(todayLocalIso())
  return `${r.from} (월) ~ ${r.to} (일)`
})

async function refreshPreview(): Promise<void> {
  loading.value = true
  try {
    if (mode.value === 'today') {
      preview.value = await formatter.formatDay(todayLocalIso())
    } else if (mode.value === 'week') {
      preview.value = await formatter.formatThisWeek(todayLocalIso())
    } else {
      if (rangeFrom.value > rangeTo.value) {
        preview.value = '시작일이 종료일보다 늦습니다.'
        return
      }
      preview.value = await formatter.formatRange(rangeFrom.value, rangeTo.value)
    }
  } catch (e) {
    console.error(e)
    preview.value = '미리보기 생성에 실패했습니다.'
  } finally {
    loading.value = false
  }
}

onMounted(() => void refreshPreview())

watch([mode, rangeFrom, rangeTo], () => void refreshPreview())

async function copyMarkdown(): Promise<void> {
  if (!preview.value.trim()) {
    ElMessage.warning('복사할 내용이 없습니다.')
    return
  }
  copying.value = true
  try {
    const ok = await copyToClipboard(preview.value)
    if (ok) ElMessage.success('클립보드에 복사했습니다.')
    else ElMessage.error('복사에 실패했습니다. 텍스트를 직접 선택해 주세요.')
  } finally {
    copying.value = false
  }
}
</script>

<template>
  <div class="view">
    <div class="head">
      <h1 class="title">GPT 복사</h1>
      <p class="sub">숫자·기록만 Markdown으로 복사합니다. 질문·코칭 문구는 포함하지 않습니다.</p>
    </div>

    <el-card shadow="never" class="mb">
      <template #header><span class="hdr">범위</span></template>
      <el-radio-group v-model="mode" class="mode-group touch-row">
        <el-radio value="today">오늘</el-radio>
        <el-radio value="week">이번 주 ({{ weekHint }})</el-radio>
        <el-radio value="range">기간 선택</el-radio>
      </el-radio-group>

      <div v-if="mode === 'range'" class="range-row">
        <el-date-picker
          v-model="rangeFrom"
          type="date"
          value-format="YYYY-MM-DD"
          format="YYYY-MM-DD"
          placeholder="시작일"
        />
        <span class="range-sep">~</span>
        <el-date-picker
          v-model="rangeTo"
          type="date"
          value-format="YYYY-MM-DD"
          format="YYYY-MM-DD"
          placeholder="종료일"
        />
      </div>
    </el-card>

    <el-card shadow="never" class="mb">
      <template #header>
        <div class="preview-hdr touch-row">
          <span class="hdr">미리보기</span>
          <el-button
            type="primary"
            :icon="DocumentCopy"
            :loading="copying"
            :disabled="loading || !preview"
            @click="copyMarkdown"
          >
            복사
          </el-button>
        </div>
      </template>
      <el-skeleton v-if="loading" animated :rows="8" />
      <el-input
        v-else
        v-model="preview"
        type="textarea"
        :rows="16"
        readonly
        class="preview-area"
        aria-label="GPT Markdown 미리보기"
      />
    </el-card>
  </div>
</template>

<style scoped>
.view {
  padding: var(--spacing, 16px);
  max-width: 800px;
  margin: 0 auto;
  padding-bottom: var(--spacing, 16px);
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
  line-height: 1.5;
}
.mb {
  margin-bottom: 16px;
}
.hdr {
  font-weight: 600;
}
.mode-group {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}
.range-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
}
.range-sep {
  color: var(--el-text-color-secondary);
}
.preview-hdr {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
.preview-area :deep(textarea) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 13px;
  line-height: 1.5;
  max-height: min(60vh, 480px);
  overflow-y: auto;
}
@media (min-width: 1024px) {
  .preview-area :deep(textarea) {
    max-height: 520px;
  }
}
</style>
