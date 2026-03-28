<template>
  <PageContainer>
    <ManagerHeader
      title="数据字典"
      subtitle="管理系统字典类型与字典项数据"
      :show-add-button="false"
      :show-refresh-button="false"
    >
      <template #actions>
        <el-button type="primary" @click="showTypeForm(null)">
          <el-icon><Plus /></el-icon>
          新增类型
        </el-button>
      </template>
      <template #extra>
        <div class="stats-bar">
          <div class="stat-item">
            <span class="stat-label">类型总数</span>
            <span class="stat-value">{{ typeCount }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">当前字典项</span>
            <span class="stat-value accent">{{ itemCount }}</span>
          </div>
        </div>
      </template>
    </ManagerHeader>

    <div class="dict-layout">
      <!-- 左侧：字典类型列表 -->
      <div class="dict-sidebar">
        <DictTypeList
          ref="typeListRef"
          @select="handleTypeSelect"
          @add="showTypeForm(null)"
          @edit="showTypeForm"
          @delete="handleDeleteType"
          @count="handleTypeCount"
        />
      </div>

      <!-- 右侧：字典项表格 -->
      <div class="dict-main">
        <DictItemTable
          v-if="selectedType"
          ref="itemTableRef"
          :type-id="selectedType.id"
          :type-name="selectedType.name"
          :type-code="selectedType.code"
          @add="showItemForm(null)"
          @edit="showItemForm"
          @delete="handleDeleteItem"
          @status-change="handleItemStatusChange"
          @count="handleItemCount"
        />
        <div v-else class="empty-state">
          <div class="empty-icon">
            <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="6" y="8" width="36" height="32" rx="4" stroke="currentColor" stroke-width="2" opacity="0.3" />
              <line x1="14" y1="18" x2="34" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.2" />
              <line x1="14" y1="24" x2="28" y2="24" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.15" />
              <line x1="14" y1="30" x2="24" y2="30" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.1" />
            </svg>
          </div>
          <p class="empty-title">选择一个字典类型</p>
          <p class="empty-desc">从左侧列表中选择字典类型，查看和管理其字典项</p>
        </div>
      </div>
    </div>

    <DictTypeForm
      v-model:visible="typeFormVisible"
      :edit-data="editingType"
      @submit="handleTypeFormSubmit"
    />
    <DictItemForm
      v-model:visible="itemFormVisible"
      :edit-data="editingItem"
      @submit="handleItemFormSubmit"
    />
  </PageContainer>
</template>

<script setup lang="ts">
import ManagerHeader from '@/components/ManagerHeader/index.vue'
import PageContainer from '@/components/PageContainer/index.vue'
import { Plus } from '@element-plus/icons-vue'
import DictItemForm from './components/DictItemForm.vue'
import DictItemTable from './components/DictItemTable.vue'
import DictTypeForm from './components/DictTypeForm.vue'
import DictTypeList from './components/DictTypeList.vue'


const typeListRef = ref<InstanceType<typeof DictTypeList>>()
const itemTableRef = ref<InstanceType<typeof DictItemTable>>()

const selectedType = ref<DictType | null>(null)
const typeFormVisible = ref(false)
const editingType = ref<DictType | null>(null)
const itemFormVisible = ref(false)
const editingItem = ref<DictItem | null>(null)
const typeCount = ref(0)
const itemCount = ref(0)

function handleTypeSelect(type: DictType) {
  selectedType.value = type
}

function handleTypeCount(count: number) {
  typeCount.value = count
}

function handleItemCount(count: number) {
  itemCount.value = count
}

function showTypeForm(type: DictType | null) {
  editingType.value = type
  typeFormVisible.value = true
}

function showItemForm(item: DictItem | null) {
  editingItem.value = item
  itemFormVisible.value = true
}

async function handleTypeFormSubmit(data: CreateDictTypeReq | UpdateDictTypeReq) {
  try {
    if (editingType.value) {
      await updateDictTypeApi(editingType.value.id, data as UpdateDictTypeReq)
      ElMessage.success('更新成功')
    } else {
      await createDictTypeApi(data as CreateDictTypeReq)
      ElMessage.success('创建成功')
    }
    typeFormVisible.value = false
    typeListRef.value?.loadTypes()
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '操作失败'
    ElMessage.error(msg)
  }
}

async function handleDeleteType(type: DictType) {
  try {
    await ElMessageBox.confirm(`确定删除字典类型「${type.name}」？删除后不可恢复。`, '确认删除', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      confirmButtonClass: 'el-button--danger'
    })
    await deleteDictTypeApi(type.id)
    ElMessage.success('删除成功')
    if (selectedType.value?.id === type.id) {
      selectedType.value = null
      itemCount.value = 0
    }
    typeListRef.value?.loadTypes()
  } catch (e: unknown) {
    if (e !== 'cancel') {
      const msg = e instanceof Error ? e.message : '删除失败'
      ElMessage.error(msg)
    }
  }
}

async function handleItemFormSubmit(data: CreateDictItemReq | UpdateDictItemReq) {
  if (!selectedType.value) return
  try {
    if (editingItem.value) {
      await updateDictItemApi(editingItem.value.id, data as UpdateDictItemReq)
      ElMessage.success('更新成功')
    } else {
      await createDictItemApi(selectedType.value.id, data as CreateDictItemReq)
      ElMessage.success('创建成功')
    }
    itemFormVisible.value = false
    itemTableRef.value?.loadItems()
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '操作失败'
    ElMessage.error(msg)
  }
}

async function handleDeleteItem(item: DictItem) {
  try {
    await ElMessageBox.confirm(`确定删除字典项「${item.label}」？`, '确认删除', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      confirmButtonClass: 'el-button--danger'
    })
    await deleteDictItemApi(item.id)
    ElMessage.success('删除成功')
    itemTableRef.value?.loadItems()
  } catch (e: unknown) {
    if (e !== 'cancel') {
      const msg = e instanceof Error ? e.message : '删除失败'
      ElMessage.error(msg)
    }
  }
}

async function handleItemStatusChange(item: DictItem, status: string) {
  try {
    await updateDictItemStatusApi(item.id, status)
    ElMessage.success(`已${status === 'enabled' ? '启用' : '禁用'}`)
    itemTableRef.value?.loadItems()
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '操作失败'
    ElMessage.error(msg)
  }
}
</script>

<style lang="scss" scoped>
.stats-bar {
  display: flex;
  gap: 24px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.stat-label {
  font-size: 12px;
  color: var(--text-tertiary);
}

.stat-value {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;

  &.accent {
    color: var(--accent-blue);
  }
}

.dict-layout {
  display: flex;
  gap: 16px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.dict-sidebar {
  width: 320px;
  min-width: 280px;
  flex-shrink: 0;
}

.dict-main {
  flex: 1;
  min-width: 0;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  padding: 60px 20px;
}

.empty-icon {
  width: 80px;
  height: 80px;
  color: var(--text-muted);
  margin-bottom: 20px;

  svg {
    width: 100%;
    height: 100%;
  }
}

.empty-title {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-secondary);
  margin: 0 0 8px;
}

.empty-desc {
  font-size: 13px;
  color: var(--text-muted);
  margin: 0;
}
</style>
