<template>
  <!--
    筛选与搜索区（关键字 + 云厂商 / 类型 / 状态三个下拉 + 重置）。
    拆分来源：src/views/iam/users/index.vue 原模板 75-149 行，
    以及原 style 中的 `.filter-section` / `.filter-row` / `.search-box` /
    `.filter-controls` / `.filter-item` / `.reset-btn` 块（逐字搬迁）。

    边界：原模板最外层的 `v-if="!errorInfo"` 保留在父组件（由父组件决定是否渲染本组件），
    因此本组件根节点直接是 `.filter-section`。

    数据流：四个筛选项通过 defineModel 双向绑定回父组件的 `filters` 对象
    （`v-model:keyword` / `v-model:provider` / `v-model:user-type` / `v-model:status`）。
    不直接接收 filters 对象再就地修改，是为了避免触发 vue/no-mutating-props
    （本仓 lint 基线为 0 error / 0 warning）。父组件仍是 filters 的唯一数据源。

    事件与拆分前父组件模板上的处理器一一对应：
      - 关键字 v-model 内置更新 + @input → search-input（500ms 防抖仍在父组件）
      - 三个下拉 @change → change（父组件重置页码并重新拉取）
      - 清空图标 → keyword 置空 + change
      - 重置按钮 → reset
  -->
  <div class="filter-section">
    <div class="filter-row">
      <div class="search-box">
        <el-icon class="search-icon"><Search /></el-icon>
        <input
          v-model="keyword"
          type="text"
          class="search-input"
          placeholder="搜索用户名、显示名称、邮箱..."
          @input="emit('search-input')"
        />
        <el-icon v-if="keyword" class="clear-icon" @click="onClearKeyword">
          <Close />
        </el-icon>
      </div>
      <div class="filter-controls">
        <div class="filter-item">
          <span class="filter-label">云厂商</span>
          <el-select
            v-model="provider"
            placeholder="全部"
            clearable
            class="filter-select"
            @change="emit('change')"
          >
            <el-option
              v-for="p in CLOUD_PROVIDERS"
              :key="p.value"
              :label="p.label"
              :value="p.value"
            />
          </el-select>
        </div>
        <div class="filter-item">
          <span class="filter-label">类型</span>
          <el-select
            v-model="userType"
            placeholder="全部"
            clearable
            class="filter-select"
            @change="emit('change')"
          >
            <el-option
              v-for="t in USER_TYPES"
              :key="t.value"
              :label="t.label"
              :value="t.value"
            />
          </el-select>
        </div>
        <div class="filter-item">
          <span class="filter-label">状态</span>
          <el-select
            v-model="status"
            placeholder="全部"
            clearable
            class="filter-select"
            @change="emit('change')"
          >
            <el-option
              v-for="s in USER_STATUS"
              :key="s.value"
              :label="s.label"
              :value="s.value"
            />
          </el-select>
        </div>
        <el-button v-if="hasFilters" text class="reset-btn" @click="emit('reset')">
          <el-icon><RefreshLeft /></el-icon>
          重置
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { CLOUD_PROVIDERS, USER_STATUS, USER_TYPES } from '@/utils/constants'
import { Close, RefreshLeft, Search } from '@element-plus/icons-vue'

// 四个筛选项：以 defineModel 双向绑定回父组件 filters 对象的对应字段
const keyword = defineModel<string>('keyword', { required: true })
const provider = defineModel<string>('provider', { required: true })
const userType = defineModel<string>('userType', { required: true })
const status = defineModel<string>('status', { required: true })

defineProps<{
  /** 父组件的 hasFilters 计算结果，仅用于控制「重置」按钮显隐 */
  hasFilters: boolean
}>()

const emit = defineEmits<{
  /** 筛选条件变更（下拉 change / 清空关键字）：父组件据此重置页码并重新拉取 */
  (e: 'change'): void
  /** 关键字输入：每次输入都触发，防抖由父组件负责（与拆分前一致） */
  (e: 'search-input'): void
  /** 点击重置按钮 */
  (e: 'reset'): void
}>()

/** 清空搜索关键字并触发筛选变更，等价于拆分前的 `filters.keyword = ''; handleFilterChange()` */
const onClearKeyword = () => {
  keyword.value = ''
  emit('change')
}
</script>

<style scoped lang="scss">
// 筛选区域（CSS 逐字搬迁自 index.vue 原 style 的筛选相关块）
.filter-section {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  padding: 16px 20px;
  margin-bottom: 16px;
}

.filter-row {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;

  @media (max-width: 1024px) {
    flex-direction: column;
    align-items: stretch;
  }
}

.search-box {
  position: relative;
  flex: 1;
  min-width: 280px;
  max-width: 400px;

  @media (max-width: 1024px) {
    max-width: none;
  }

  .search-icon {
    position: absolute;
    left: 14px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-tertiary);
    font-size: 16px;
  }

  .search-input {
    width: 100%;
    height: 40px;
    padding: 0 36px 0 42px;
    background: var(--bg-hover);
    border: 1px solid transparent;
    border-radius: 10px;
    font-size: 14px;
    color: var(--text-primary);
    transition: all 200ms ease;

    &::placeholder {
      color: var(--text-muted);
    }

    &:focus {
      outline: none;
      border-color: var(--accent-blue);
      background: var(--bg-surface);
    }
  }

  .clear-icon {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-tertiary);
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    transition: all 200ms ease;

    &:hover {
      color: var(--text-primary);
      background: var(--bg-hover);
    }
  }
}

.filter-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.filter-item {
  display: flex;
  align-items: center;
  gap: 8px;

  .filter-label {
    font-size: 13px;
    color: var(--text-tertiary);
    white-space: nowrap;
  }

  .filter-select {
    width: 120px;

    :deep(.el-select__wrapper) {
      background: var(--bg-hover);
      border: none;
      box-shadow: none;
      border-radius: 8px;
      height: 36px;
    }
  }
}

.reset-btn {
  color: var(--text-secondary);
  font-size: 13px;

  &:hover {
    color: var(--accent-blue);
  }
}
</style>
