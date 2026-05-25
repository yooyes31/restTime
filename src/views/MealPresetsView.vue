<script setup lang="ts">
/** 식단 프리셋 관리 — 아침/점심/저녁 (Issue #3) */
import type { MealPresetType } from '@/services/mealPresetService'

import { Delete, Plus } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { onMounted, ref, watch } from 'vue'

import { useDatabase } from '@/composables/useDatabase'
import { MealPresetService, type MealPreset } from '@/services/mealPresetService'

defineOptions({ name: 'MealPresetsView' })

const MEAL_LABEL: Record<MealPresetType, string> = {
  breakfast: '아침',
  lunch: '점심',
  dinner: '저녁',
}

const PRESET_TYPES: MealPresetType[] = ['breakfast', 'lunch', 'dinner']

const db = useDatabase()
const svc = new MealPresetService(db)

const activeTab = ref<MealPresetType>('breakfast')
const list = ref<MealPreset[]>([])
const loading = ref(false)
const dialogOpen = ref(false)
const editingId = ref<number | null>(null)
const form = ref({
  name: '',
  memo: '',
  kcal: 0,
  protein_g: 0,
})

async function reload(): Promise<void> {
  loading.value = true
  try {
    list.value = await svc.listByMealType(activeTab.value)
  } finally {
    loading.value = false
  }
}

onMounted(() => void reload())
watch(activeTab, () => void reload())

function openCreate(): void {
  editingId.value = null
  form.value = { name: '', memo: '', kcal: 0, protein_g: 0 }
  dialogOpen.value = true
}

function openEdit(row: MealPreset): void {
  editingId.value = row.id
  form.value = {
    name: row.name,
    memo: row.memo,
    kcal: row.kcal,
    protein_g: row.protein_g,
  }
  dialogOpen.value = true
}

async function saveForm(): Promise<void> {
  const name = form.value.name.trim()
  if (!name) {
    ElMessage.warning('이름을 입력해 주세요.')
    return
  }
  try {
    if (editingId.value === null) {
      await svc.create({
        meal_type: activeTab.value,
        name,
        memo: form.value.memo,
        kcal: form.value.kcal,
        protein_g: form.value.protein_g,
      })
      ElMessage.success('프리셋을 추가했습니다.')
    } else {
      await svc.update(editingId.value, {
        name,
        memo: form.value.memo,
        kcal: form.value.kcal,
        protein_g: form.value.protein_g,
      })
      ElMessage.success('저장했습니다.')
    }
    dialogOpen.value = false
    await reload()
  } catch (e: unknown) {
    console.error(e)
    ElMessage.error('저장에 실패했습니다.')
  }
}

async function remove(row: MealPreset): Promise<void> {
  try {
    await ElMessageBox.confirm(`「${row.name}」 프리셋을 삭제할까요?`, '삭제', { type: 'warning' })
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
    <h1 class="title">식단 프리셋</h1>
    <p class="hint">아침·점심·저녁만 저장합니다. 간식은 수동 입력만 가능합니다.</p>

    <el-tabs v-model="activeTab" class="tabs">
      <el-tab-pane v-for="t in PRESET_TYPES" :key="t" :label="MEAL_LABEL[t]" :name="t">
        <div class="toolbar">
          <el-button type="primary" :icon="Plus" @click="openCreate">프리셋 추가</el-button>
        </div>
        <el-skeleton v-if="loading" animated :rows="3" />
        <el-empty v-else-if="list.length === 0" description="등록된 프리셋이 없습니다." />
        <el-table v-else :data="list" stripe size="small">
          <el-table-column prop="name" label="이름" min-width="100" />
          <el-table-column prop="memo" label="메모" min-width="120" show-overflow-tooltip />
          <el-table-column prop="kcal" label="kcal" width="80" />
          <el-table-column prop="protein_g" label="단백(g)" width="90" />
          <el-table-column label="" width="120" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="openEdit(row)">편집</el-button>
              <el-button link type="danger" :icon="Delete" @click="remove(row)" />
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="dialogOpen" :title="editingId ? '프리셋 편집' : '프리셋 추가'" width="92%" style="max-width: 420px">
      <el-form label-position="top">
        <el-form-item label="이름" required>
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="메모">
          <el-input v-model="form.memo" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="kcal">
          <el-input-number v-model="form.kcal" :min="0" controls-position="right" class="full" />
        </el-form-item>
        <el-form-item label="단백질(g)">
          <el-input-number v-model="form.protein_g" :min="0" :precision="1" controls-position="right" class="full" />
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
.toolbar {
  margin-bottom: 12px;
}
.full {
  width: 100%;
}
</style>
