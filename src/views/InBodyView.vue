<script setup lang="ts">
/** 인바디 기록·이력 — Issue #4 */
import { Delete, Plus } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { onMounted, ref } from 'vue'

import { useDatabase } from '@/composables/useDatabase'
import { InBodyService, type InBodyLog } from '@/services/inBodyService'
import { todayLocalIso } from '@/utils/dateIso'

defineOptions({ name: 'InBodyView' })

const db = useDatabase()
const svc = new InBodyService(db)

const list = ref<InBodyLog[]>([])
const loading = ref(false)
const dialogOpen = ref(false)
const editingId = ref<number | null>(null)
const form = ref({
  measured_at: todayLocalIso(),
  weight_kg: 0,
  muscle_kg: 0,
  body_fat_pct: 0,
  burn_kcal: 0,
  note: '',
})

async function reload(): Promise<void> {
  loading.value = true
  try {
    list.value = await svc.listAll()
  } finally {
    loading.value = false
  }
}

onMounted(() => void reload())

function openCreate(): void {
  editingId.value = null
  form.value = {
    measured_at: todayLocalIso(),
    weight_kg: 0,
    muscle_kg: 0,
    body_fat_pct: 0,
    burn_kcal: 0,
    note: '',
  }
  dialogOpen.value = true
}

function openEdit(row: InBodyLog): void {
  editingId.value = row.id
  form.value = {
    measured_at: row.measured_at.slice(0, 10),
    weight_kg: row.weight_kg,
    muscle_kg: row.muscle_kg,
    body_fat_pct: row.body_fat_pct,
    burn_kcal: row.burn_kcal,
    note: row.note ?? '',
  }
  dialogOpen.value = true
}

async function saveForm(): Promise<void> {
  if (form.value.burn_kcal <= 0) {
    ElMessage.warning('하루 소모 칼로리를 입력해 주세요.')
    return
  }
  try {
    const payload = {
      measured_at: form.value.measured_at,
      weight_kg: form.value.weight_kg,
      muscle_kg: form.value.muscle_kg,
      body_fat_pct: form.value.body_fat_pct,
      burn_kcal: form.value.burn_kcal,
      note: form.value.note || null,
    }
    if (editingId.value === null) {
      await svc.add(payload)
      ElMessage.success('인바디를 저장했습니다. 하루 소모 칼로리가 갱신됩니다.')
    } else {
      await svc.update(editingId.value, payload)
      ElMessage.success('저장했습니다.')
    }
    dialogOpen.value = false
    await reload()
  } catch (e: unknown) {
    console.error(e)
    ElMessage.error('저장에 실패했습니다.')
  }
}

async function remove(row: InBodyLog): Promise<void> {
  try {
    await ElMessageBox.confirm('이 인바디 기록을 삭제할까요?', '삭제', { type: 'warning' })
    await svc.delete(row.id)
    await reload()
    ElMessage.success('삭제했습니다.')
  } catch {
    /* cancel */
  }
}
</script>

<template>
  <div class="view">
    <h1 class="title">인바디 기록</h1>
    <p class="hint">저장 시 「하루 소모 칼로리」 설정이 자동 갱신됩니다.</p>
    <el-button type="primary" :icon="Plus" class="mb" @click="openCreate">기록 추가</el-button>

    <el-skeleton v-if="loading" animated :rows="4" />
    <el-empty v-else-if="list.length === 0" description="기록이 없습니다." />
    <el-table v-else :data="list" stripe size="small">
      <el-table-column prop="measured_at" label="측정일" width="110">
        <template #default="{ row }">{{ String(row.measured_at).slice(0, 10) }}</template>
      </el-table-column>
      <el-table-column prop="weight_kg" label="체중" width="70" />
      <el-table-column prop="muscle_kg" label="근육" width="70" />
      <el-table-column prop="body_fat_pct" label="체지방%" width="80" />
      <el-table-column prop="burn_kcal" label="소모 kcal" width="90" />
      <el-table-column prop="note" label="메모" min-width="80" show-overflow-tooltip />
      <el-table-column width="100" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openEdit(row)">편집</el-button>
          <el-button link type="danger" :icon="Delete" @click="remove(row)" />
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogOpen" :title="editingId ? '인바디 편집' : '인바디 추가'" width="92%" style="max-width: 420px">
      <el-form label-position="top">
        <el-form-item label="측정일">
          <el-date-picker v-model="form.measured_at" type="date" value-format="YYYY-MM-DD" class="full" />
        </el-form-item>
        <el-form-item label="체중(kg)">
          <el-input-number v-model="form.weight_kg" :min="0" :precision="1" controls-position="right" class="full" />
        </el-form-item>
        <el-form-item label="골격근량(kg)">
          <el-input-number v-model="form.muscle_kg" :min="0" :precision="1" controls-position="right" class="full" />
        </el-form-item>
        <el-form-item label="체지방률(%)">
          <el-input-number v-model="form.body_fat_pct" :min="0" :precision="1" controls-position="right" class="full" />
        </el-form-item>
        <el-form-item label="하루 소모 칼로리(kcal)" required>
          <el-input-number v-model="form.burn_kcal" :min="0" :step="10" controls-position="right" class="full" />
        </el-form-item>
        <el-form-item label="메모">
          <el-input v-model="form.note" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogOpen = false">취소</el-button>
        <el-button type="primary" @click="saveForm">저장</el-button>
      </template>
    </el-dialog>
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
.mb {
  margin-bottom: 12px;
}
.full {
  width: 100%;
}
</style>
