<template>
  <div class="dict-type-panel">
    <!-- 搜索区域 -->
    <div class="panel-search">
      <el-input
        v-model="keyword"
        placeholder="搜索名称或编码..."
        clearable
        @input="handleSearch"
      >
        <template #prefix><el-icon><Search /></el-icon></template>
      </el-input>
    </div>

    <!-- 类型列表 -->
    <el-scrollbar class="panel-body">
      <div v-if="loading" class="panel-loading">
        <el-icon class="is-loading" :size="20"><Loading /></el-icon>
        <span>加载中...</span>
      </div>
      <div v-else-if="types.length === 0" class="panel-empty">
        <span>暂无字典类型</span>
      </div>
      <template v-else>
        <div
          v-for="item in types"
          :key="item.id"
          class="type-card"
          :class="{
            active: selectedId === item.id,
            disabled: item.status === 'disabled'
          }"
          @click="handleSelect(item)"
        >
          <div class="card-content">
            <div class="card-icon">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
              </svg>
            </div>
            <div class="card-info">
              <span class="card-name">{{ item.name }}</span>
              <span class="card-code">{{ item.code }}</span>
            </div>
          </div>
          <div class="card-actions" @click.stop>
            <span
              class="status-dot"
              :class="item.status === 'enabled' ? 'enabled' : 'disabled-dot'"
              :title="item.status === 'enabled' ? '已启用' : '已禁用'"
            />
            <el-dropdown trigger="click" @command="(cmd: string) => handleCommand(cmd, item)">
              <button class="more-btn">
                <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
                  <circle cx="8" cy="3" r="1.5" />
                  <circle cx="8" cy="8" r="1.5" />
                  <circle cx="8" cy="13" r="1.5" />
                </svg>
              </button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="edit">
                    <el-icon><Edit /></el-icon>编辑
                  </el-dropdown-item>
                  <el-dropdown-item command="toggle">
                    <el-icon><Switch /></el-icon>{{ item.status === 'enabled' ? '禁用' : '启用' }}
                  </el-dropdown-item>
                  <el-dropdown-item command="delete" divided>
                    <span style="color: var(--accent-red)">
                      <el-icon><Delete /></el-icon>删除
                    </span>
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>
      </template>
    </el-scrollbar>
  </div>
</template>

<script setup lang="ts">
import { listDictTypesApi, updateDictTypeStatusApi } from '@/api/dictionary'
import type { DictType } from '@/api/types/dictionary'
import { Delete, Edit, Loading, Search, Switch } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { onMounted, ref } from 'vue'

const emit = defineEmits<{
  select: [type: DictType]
  add: []
  edit: [type: DictType]
  delete: [type: DictType]
  count: [count: number]
}>()

const types = ref<DictType[]>([])
const loading = ref(false)
const selectedId = ref<number | null>(null)
const keyword = ref('')
let searchTimer: number | null = null

async function loadTypes() {
  loading.value = true
  try {
    const params: Record<string, string> = {}
    if (keyword.value) params.keyword = keyword.value
    const res = await listDictTypesApi(params)
    const data = (res as unknown as { data: { items: DictType[] } }).data || res
    const raw = (data as { items?: DictType[] }).items || data || []
    types.value = Array.isArray(raw) ? raw.filter((t: DictType) => t != null && t.id != null) : []
    emit('count', types.value.length)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '加载字典类型失败'
    ElMessage.error(msg)
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = window.setTimeout(() => loadTypes(), 300)
}

function handleSelect(item: DictType) {
  selectedId.value = item.id
  emit('select', item)
}

function handleCommand(cmd: string, item: DictType) {
  if (cmd === 'edit') {
    emit('edit', item)
  } else if (cmd === 'delete') {
    emit('delete', item)
  } else if (cmd === 'toggle') {
    toggleStatus(item)
  }
}

async function toggleStatus(item: DictType) {
  const newStatus = item.status === 'enabled' ? 'disabled' : 'enabled'
  try {
    await updateDictTypeStatusApi(item.id, newStatus)
    ElMessage.success(`已${newStatus === 'enabled' ? '启用' : '禁用'}`)
    await loadTypes()
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '操作失败'
    ElMessage.error(msg)
  }
}

defineExpose({ loadTypes })

onMounted(() => loadTypes())
</script>

<style lang="scss" scoped>
.dict-type-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  overflow: hidden;
}

.panel-search {
  padding: 16px 16px 12px;
  border-bottom: 1px solid var(--border-subtle);

  :deep(.el-input__wrapper) {
    background: var(--input-bg);
    border-radius: 8px;
    box-shadow: none;
    border: 1px solid var(--border-subtle);
    transition: all 200ms ease;

    &:hover {
      border-color: var(--border-base);
    }

    &.is-focus {
      border-color: var(--accent-blue);
      box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
    }
  }
}

.panel-body {
  flex: 1;
  overflow: auto;
}

.panel-loading,
.panel-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 48px 16px;
  color: var(--text-muted);
  font-size: 13px;
}

.type-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  margin: 4px 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 150ms ease;
  border: 1px solid transparent;

  &:hover {
    background: var(--glass-bg-hover);
  }

  &.active {
    background: rgba(59, 130, 246, 0.1);
    border-color: rgba(59, 130, 246, 0.2);

    .card-icon {
      color: var(--accent-blue);
      background: rgba(59, 130, 246, 0.15);
    }

    .card-name {
      color: var(--text-primary);
    }
  }

  &.disabled {
    opacity: 0.5;
  }
}

.card-content {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  flex: 1;
}

.card-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--glass-bg-hover);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--text-tertiary);
  transition: all 150ms ease;

  svg {
    width: 16px;
    height: 16px;
  }
}

.card-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.card-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-regular);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.4;
}

.card-code {
  font-size: 11px;
  color: var(--text-muted);
  font-family: var(--font-mono);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.3;
}

.card-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;

  &.enabled {
    background: var(--accent-green);
    box-shadow: 0 0 6px rgba(16, 185, 129, 0.4);
  }

  &.disabled-dot {
    background: var(--text-muted);
  }
}

.more-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 150ms ease;

  &:hover {
    background: var(--bg-hover);
    color: var(--text-secondary);
  }
}
</style>
