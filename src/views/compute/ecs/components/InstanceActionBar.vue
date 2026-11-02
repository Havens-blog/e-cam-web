<template>
  <div class="action-bar">
    <div class="action-left">
      <el-button type="primary" size="small" @click="emit('add')">
        <el-icon><Plus /></el-icon>
        新建
      </el-button>
      <!-- F-C2/F-C3：批量开机/关机/重启均未实现（点击零反馈），按主题 B 决策统一禁用 + tooltip -->
      <el-tooltip content="功能开发中" placement="top">
        <el-button size="small" disabled>开机</el-button>
      </el-tooltip>
      <el-tooltip content="功能开发中" placement="top">
        <el-button size="small" disabled>关机</el-button>
      </el-tooltip>
      <el-tooltip content="功能开发中" placement="top">
        <el-button size="small" disabled>重启</el-button>
      </el-tooltip>
      <el-popover
        v-model:visible="tagFilterVisible"
        placement="bottom-start"
        :width="280"
        popper-class="tag-filter-popover"
      >
        <template #reference>
          <el-button size="small" :class="{ 'is-active': hasTagFilter }">
            <el-icon><PriceTag /></el-icon>
            标签
            <span v-if="hasTagFilter" class="filter-count">1</span>
            <el-icon><ArrowDown /></el-icon>
          </el-button>
        </template>
        <div class="tag-filter-panel">
          <div class="tag-filter-options">
            <div
              class="tag-option"
              :class="{ active: hasTags === 'false' }"
              @click="applyTagFilter('no-tags')"
            >
              无标签资源
            </div>
            <div
              class="tag-option"
              :class="{ active: hasTags === 'true' && !tagKey }"
              @click="applyTagFilter('has-tags')"
            >
              有标签资源
              <el-icon v-if="hasTags === 'true' && !tagKey"><Check /></el-icon>
            </div>
          </div>
          <div class="tag-filter-search">
            <el-input
              v-model="tagKeySearch"
              placeholder="输入标签键搜索或自定义"
              size="small"
              clearable
              :prefix-icon="Search"
              @keyup.enter="applyCustomTagKey"
            />
            <div v-if="tagKeySearch && !filteredTagKeys.includes(tagKeySearch)" class="custom-tag-hint">
              按回车使用 "{{ tagKeySearch }}" 筛选
            </div>
          </div>
          <div class="tag-key-list">
            <div
              v-for="key in filteredTagKeys"
              :key="key"
              class="tag-key-item"
              :class="{ active: tagKey === key }"
              @click="selectTagKey(key)"
            >
              {{ key }}
              <el-icon v-if="tagKey === key"><Check /></el-icon>
            </div>
            <div v-if="filteredTagKeys.length === 0" class="tag-key-empty">
              暂无标签
            </div>
          </div>
          <div v-if="tagKey" class="tag-value-input">
            <el-input
              v-model="tagValue"
              :placeholder="`输入 ${tagKey} 的值`"
              size="small"
              clearable
              @change="emit('filter-change')"
            />
          </div>
          <div class="tag-filter-footer">
            <el-button size="small" text @click="clearTagFilter">清除</el-button>
            <el-button size="small" type="primary" @click="tagFilterVisible = false">确定</el-button>
          </div>
        </div>
      </el-popover>
    </div>
    <div class="action-right">
      <span class="page-info">本页{{ pageCount }}条 / 共{{ total }}条</span>
      <el-button size="small" circle :loading="loading" @click="emit('refresh')" title="刷新">
        <el-icon><Refresh /></el-icon>
      </el-button>
      <el-button size="small" circle @click="emit('open-export')" title="导出">
        <el-icon><Download /></el-icon>
      </el-button>
      <el-button size="small" circle @click="emit('open-columns')" title="自定义列">
        <el-icon><Setting /></el-icon>
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * ECS 操作栏（新建 / 批量开机·关机·重启占位 / 标签筛选面板 / 刷新·导出·自定义列）。
 *
 * 【拆分来源 / 边界】
 *   模板来自原 `views/compute/ecs/index.vue` 第 36-141 行的 `.action-bar` 区块，
 *   样式来自同文件 `<style scoped>` 的两段：
 *     第 1326-1351 行（`// 操作栏`：`.action-bar` / `.action-left` / `.action-right`）
 *     第 1566-1686 行（`// 标签筛选面板`：`.tag-filter-panel` … `.el-button.is-active`）
 *   两段均**逐字搬迁**，结构与文案零改动。
 *
 * 【标签筛选的取值边界：为什么改成 v-model 而不是直接改父组件的 filters】
 *   迁移前面板直接 `v-model="filters.has_tags / tag_key / tag_value"`，
 *   那是同一文件内的写法。拆成子组件后若继续直接写父组件的 `filters` 对象，
 *   就是「子组件改父组件数据」，会触发 vue/no-mutating-props（本仓 lint 基线为 0/0，
 *   不允许新增告警）。因此这三个字段改为
 *   `v-model:has-tags / v-model:tag-key / v-model:tag-value` 双向绑定，
 *   页面层依旧把对端绑在 `filters.*` 上——读写语义与拆分前完全等价。
 *
 * 【筛选落地仍归页面层】
 *   原 applyTagFilter / selectTagKey / applyCustomTagKey / clearTagFilter 末尾都是
 *   「pagination.page = 1 + fetchInstances()」，与页面层 handleFilterChange 一致。
 *   本组件不复制该逻辑，统一 emit('filter-change') 交由页面层处理。
 *
 * 【tagKeySearch 为什么留在本组件内部】
 *   它只用于在面板内过滤标签键下拉（filteredTagKeys），从不进入请求参数，
 *   属于纯 UI 状态，故随拆分下沉，不再占用页面层的状态空间。
 */
import { ArrowDown, Check, Download, Plus, PriceTag, Refresh, Search, Setting } from '@element-plus/icons-vue'
import { computed, ref } from 'vue'

const emit = defineEmits<{
  /** 新建实例（页面层对应 handleAdd） */
  add: []
  /** 刷新列表（页面层对应 handleRefresh） */
  refresh: []
  /** 打开导出对话框 */
  'open-export': []
  /** 打开自定义列对话框 */
  'open-columns': []
  /** 标签筛选条件发生变化，请页面层重置页码并重新拉取 */
  'filter-change': []
}>()

// 以下 4 个 v-model 对应页面层 filters.has_tags / filters.tag_key / filters.tag_value
// 以及页面层的 tagFilterVisible（面板显隐由页面层持有，保持与拆分前一致）
const hasTags = defineModel<'' | 'true' | 'false'>('hasTags', { required: true })
const tagKey = defineModel<string>('tagKey', { required: true })
const tagValue = defineModel<string>('tagValue', { required: true })
const tagFilterVisible = defineModel<boolean>('tagFilterVisible', { required: true })

const props = defineProps<{
  /** 全量 ECS 标签键（页面层经 listTagsApi 拉取，失败时回退当前页数据） */
  availableTagKeys: string[]
  /** 当前页条数（文案「本页 N 条」） */
  pageCount: number
  /** 总数（文案「共 N 条」） */
  total: number
  /** 列表加载中：用于禁用刷新按钮，避免连点产生重复请求 */
  loading?: boolean
}>()

// 标签键搜索：纯 UI 过滤状态，不参与请求参数
const tagKeySearch = ref('')

const hasTagFilter = computed(() => hasTags.value !== '' || tagKey.value !== '')

const filteredTagKeys = computed(() => {
  if (!tagKeySearch.value) return props.availableTagKeys
  const search = tagKeySearch.value.toLowerCase()
  return props.availableTagKeys.filter(key => key.toLowerCase().includes(search))
})

const applyTagFilter = (type: 'no-tags' | 'has-tags') => {
  if (type === 'no-tags') {
    hasTags.value = 'false'
    tagKey.value = ''
    tagValue.value = ''
  } else {
    hasTags.value = 'true'
    tagKey.value = ''
    tagValue.value = ''
  }
  emit('filter-change')
}

const selectTagKey = (key: string) => {
  if (tagKey.value === key) {
    tagKey.value = ''
    tagValue.value = ''
  } else {
    tagKey.value = key
    hasTags.value = ''
  }
  emit('filter-change')
}

const applyCustomTagKey = () => {
  if (tagKeySearch.value) {
    tagKey.value = tagKeySearch.value
    hasTags.value = ''
    tagKeySearch.value = ''
    emit('filter-change')
  }
}

const clearTagFilter = () => {
  hasTags.value = ''
  tagKey.value = ''
  tagValue.value = ''
  tagFilterVisible.value = false
  emit('filter-change')
}
</script>

<style scoped lang="scss">
// 操作栏
.action-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border-subtle);
}

.action-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.action-right {
  display: flex;
  align-items: center;
  gap: 12px;

  .page-info {
    font-size: 13px;
    color: var(--text-tertiary);
  }
}

/* 窄屏隐藏条数摘要：与下方分页栏「共 N 条」重复，且此处会被挤成一字一行（iter117） */
@media (max-width: 560px) {
  .page-info {
    display: none;
  }
}

// 标签筛选面板
.tag-filter-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: -12px;
}

.tag-filter-options {
  display: flex;
  flex-direction: column;
  border-bottom: 1px solid var(--border-subtle);
  padding-bottom: 8px;

  .tag-option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    font-size: 13px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 150ms ease;

    &:hover {
      background: var(--bg-hover);
      color: var(--text-primary);
    }

    &.active {
      color: color-mix(in srgb, var(--accent-blue) 72%, #fff);
      background: rgba(113, 112, 255, 0.08);
    }
  }
}

.tag-filter-search {
  padding: 0 12px;

  .custom-tag-hint {
    margin-top: 4px;
    padding: 4px 8px;
    font-size: 12px;
    color: var(--accent-blue);
    background: rgba(113, 112, 255, 0.08);
    border-radius: 4px;
    cursor: pointer;

    &:hover {
      background: rgba(113, 112, 255, 0.12);
    }
  }
}

.tag-key-list {
  max-height: 200px;
  overflow-y: auto;
  padding: 0 4px;

  .tag-key-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 8px;
    margin: 2px 0;
    font-size: 13px;
    color: var(--text-secondary);
    cursor: pointer;
    border-radius: 4px;
    transition: all 150ms ease;

    &:hover {
      background: var(--bg-hover);
      color: var(--text-primary);
    }

    &.active {
      color: color-mix(in srgb, var(--accent-blue) 72%, #fff);
      background: rgba(113, 112, 255, 0.08);
    }
  }

  .tag-key-empty {
    padding: 20px;
    text-align: center;
    font-size: 13px;
    color: var(--text-muted);
  }
}

.tag-value-input {
  padding: 0 12px;
  border-top: 1px solid var(--border-subtle);
  padding-top: 8px;
}

.tag-filter-footer {
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  border-top: 1px solid var(--border-subtle);
}

.filter-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  margin-left: 4px;
  font-size: 11px;
  /* 白字压原 #7170ff 仅 3.84:1（AA 需 4.5）→ 压暗 18% 至约 5.4:1，色相不变 */
  background: color-mix(in srgb, var(--accent-blue) 82%, #000);
  color: white;
  border-radius: 8px;
}

.el-button.is-active {
  color: var(--accent-blue);
  border-color: var(--accent-blue);
}
</style>
