<template>
  <div class="search-bar">
    <div class="search-row">
      <div class="search-input-wrap">
        <el-popover
          v-model:visible="searchFilterVisible"
          placement="bottom-start"
          :width="currentSearchField && searchFieldOptions[currentSearchField] ? 280 : 200"
          popper-class="search-filter-popover"
        >
          <template #reference>
            <div class="search-box">
              <el-icon class="search-icon"><Search /></el-icon>
              <input
                v-model="searchKeyword"
                type="text"
                class="search-input"
                placeholder="输入搜索内容，回车添加条件"
                @focus="handleSearchFocus"
                @keyup.enter="handleSearchEnter"
              />
            </div>
          </template>
          <!-- 属性选择面板 -->
          <div v-if="!currentSearchField" class="search-filter-panel">
            <div class="search-filter-title">选择搜索属性</div>
            <div class="search-filter-list">
              <div
                v-for="field in searchFields"
                :key="field.key"
                class="search-filter-item"
                @click="selectSearchFilter(field.key)"
              >
                <span>{{ field.label }}</span>
                <el-icon v-if="field.hasOptions"><ArrowRight /></el-icon>
              </div>
            </div>
          </div>
          <!-- 属性值选择面板 -->
          <div v-else class="search-value-panel">
            <div class="search-value-header">
              <el-icon class="back-icon" @click="currentSearchField = ''"><ArrowLeft /></el-icon>
              <span>{{ searchFieldLabels[currentSearchField] }}</span>
            </div>
            <!-- 有固定选项的属性 -->
            <template v-if="searchFieldOptions[currentSearchField]">
              <div class="search-value-list">
                <div
                  v-for="opt in searchFieldOptions[currentSearchField]"
                  :key="opt.value"
                  class="search-value-item"
                  @click="selectSearchValue(opt)"
                >
                  {{ opt.label }}
                </div>
              </div>
            </template>
            <!-- 需要输入的属性 -->
            <template v-else>
              <div class="search-value-input">
                <el-input
                  v-model="searchKeyword"
                  :placeholder="`输入${searchFieldLabels[currentSearchField]}`"
                  size="small"
                  @keyup.enter="handleSearchEnter"
                />
                <el-button size="small" type="primary" @click="handleSearchEnter">确定</el-button>
              </div>
            </template>
          </div>
        </el-popover>
      </div>

      <!-- 已添加的搜索条件标签 -->
      <div class="search-tags" v-if="conditions.length > 0">
        <el-tag
          v-for="(cond, idx) in conditions"
          :key="idx"
          closable
          size="small"
          @close="removeSearchCondition(idx)"
        >
          {{ searchFieldLabels[cond.field] }}: {{ cond.displayValue }}
        </el-tag>
        <span class="clear-search-btn" @click="clearAllSearchConditions">清除</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * ECS 搜索栏（关键词输入 + 属性/属性值二级面板 + 已生效条件标签）。
 *
 * 【拆分来源 / 边界】
 *   模板来自原 `views/compute/ecs/index.vue` 第 143-230 行的 `.search-bar` 区块，
 *   样式来自同文件 `<style scoped>` 第 1353-1529 行（`// 搜索栏` 注释起，
 *   到 `.search-value-panel` 结束），均为**逐字搬迁**，结构与文案零改动。
 *
 * 【状态边界：为什么 conditions 用 v-model 而不是全搬进来】
 *   面板自身的 UI 状态（面板是否展开 searchFilterVisible、当前选中字段
 *   currentSearchField、输入内容 searchKeyword、以及 searchFields/Labels/Options
 *   三张静态配置表）都是「只有本组件关心」的，已随本次拆分下沉到本组件内部。
 *
 *   唯一必须与页面层共享的是**已生效的条件数组**：页面层的统计卡片点击
 *   （handleStatBadgeClick）也会增删 status 条件。因此 conditions 走
 *   `v-model:conditions` 双向绑定，页面层仍持有 `searchConditions` 这个 ref。
 *
 * 【为什么条件变更后只 emit('apply')】
 *   拆分前每个条件变更处理函数末尾都调用 applySearchConditions()，由页面层负责
 *   「把条件落到 filters 查询参数 + 重置页码 + 发起请求」。本组件不复制这套逻辑，
 *   只负责改完条件后通知页面层执行（emit 同步触发，页面层读到的必是改后的数组）。
 */
import { ArrowLeft, ArrowRight, Search } from '@element-plus/icons-vue'
import { ref } from 'vue'
import type { SearchCondition } from '../utils'

const conditions = defineModel<SearchCondition[]>('conditions', { required: true })

const emit = defineEmits<{
  /** 条件数组发生变化，请页面层把条件应用到查询参数并重新拉取 */
  apply: []
}>()

// 搜索面板可见性 / 当前选中字段 / 输入内容：纯 UI 状态，不参与跨组件通信
const searchFilterVisible = ref(false)
const currentSearchField = ref('')
const searchKeyword = ref('')

// 搜索字段配置
const searchFields = [
  { key: 'asset_name', label: '名称', hasOptions: false },
  { key: 'asset_id', label: '云上ID', hasOptions: false },
  { key: 'private_ip', label: 'IP', hasOptions: false },
  { key: 'host_name', label: '主机名', hasOptions: false },
  { key: 'status', label: '状态', hasOptions: true },
  { key: 'provider', label: '平台', hasOptions: true },
  { key: 'region', label: '区域', hasOptions: false },
  { key: 'instance_type', label: '规格', hasOptions: false },
  { key: 'charge_type', label: '计费方式', hasOptions: true },
  { key: 'vpc_id', label: 'VPC', hasOptions: false },
  { key: 'os_type', label: '系统', hasOptions: true },
]

const searchFieldLabels: Record<string, string> = {
  asset_name: '名称',
  asset_id: '云上ID',
  private_ip: 'IP',
  host_name: '主机名',
  status: '状态',
  provider: '平台',
  region: '区域',
  instance_type: '规格',
  charge_type: '计费方式',
  vpc_id: 'VPC',
  os_type: '系统',
}

// 有固定选项的字段
const searchFieldOptions: Record<string, { label: string; value: string }[]> = {
  status: [
    { label: '运行中', value: 'running' },
    { label: '已关机', value: 'stopped' },
    { label: '创建中', value: 'pending' },
    { label: '启动中', value: 'starting' },
    { label: '停止中', value: 'stopping' },
    { label: '重启中', value: 'rebooting' },
    { label: '已销毁', value: 'terminated' },
    { label: '异常', value: 'error' },
  ],
  provider: [
    { label: '阿里云', value: 'aliyun' },
    { label: '腾讯云', value: 'tencent' },
    { label: '华为云', value: 'huawei' },
    { label: 'AWS', value: 'aws' },
    { label: '火山引擎', value: 'volcano' },
  ],
  charge_type: [
    { label: '包年包月', value: 'PrePaid' },
    { label: '按量付费', value: 'PostPaid' },
  ],
  os_type: [
    { label: 'Linux', value: 'Linux' },
    { label: 'Windows', value: 'Windows' },
  ],
}

const handleSearchFocus = () => {
  searchFilterVisible.value = true
}

const selectSearchFilter = (field: string) => {
  currentSearchField.value = field
  searchKeyword.value = ''
  // 如果没有固定选项，聚焦到输入框
  if (!searchFieldOptions[field]) {
    setTimeout(() => {
      const input = document.querySelector('.search-value-input input') as HTMLInputElement
      if (input) input.focus()
    }, 100)
  }
}

const selectSearchValue = (opt: { label: string; value: string }) => {
  // 添加搜索条件
  const existingIdx = conditions.value.findIndex(c => c.field === currentSearchField.value)
  if (existingIdx > -1) {
    conditions.value[existingIdx] = { field: currentSearchField.value, value: opt.value, displayValue: opt.label }
  } else {
    conditions.value.push({ field: currentSearchField.value, value: opt.value, displayValue: opt.label })
  }

  // 重置并关闭
  currentSearchField.value = ''
  searchFilterVisible.value = false
  emit('apply')
}

const handleSearchEnter = () => {
  const value = searchKeyword.value.trim()
  if (!value) return

  // 如果没有选择字段，默认用名称搜索
  const field = currentSearchField.value || 'asset_name'

  // 检查是否已存在相同字段的条件，如果存在则替换
  const existingIdx = conditions.value.findIndex(c => c.field === field)
  if (existingIdx > -1) {
    conditions.value[existingIdx] = { field, value, displayValue: value }
  } else {
    conditions.value.push({ field, value, displayValue: value })
  }

  // 清空输入并重置字段
  searchKeyword.value = ''
  currentSearchField.value = ''
  searchFilterVisible.value = false

  // 应用搜索
  emit('apply')
}

const removeSearchCondition = (idx: number) => {
  conditions.value.splice(idx, 1)
  emit('apply')
}

const clearAllSearchConditions = () => {
  conditions.value = []
  emit('apply')
}
</script>

<style scoped lang="scss">
// 搜索栏
.search-bar {
  padding: 12px 20px;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.search-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.search-input-wrap {
  position: relative;
  width: 320px;
  flex-shrink: 0;
}

.search-box {
  position: relative;
  display: flex;
  align-items: center;

  .search-icon {
    position: absolute;
    left: 12px;
    color: var(--text-muted);
    z-index: 1;
  }

  .search-input {
    width: 100%;
    height: 32px;
    padding: 0 12px 0 36px;
    background: var(--bg-base);
    border: 1px solid var(--border-subtle);
    border-radius: 4px;
    font-size: 13px;
    color: var(--text-primary);
    outline: none;
    transition: all 200ms ease;

    &::placeholder {
      color: var(--text-muted);
    }

    &:focus {
      border-color: var(--accent-blue);
    }
  }
}

.search-tags {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  flex: 1;
  min-width: 0;
}

.clear-search-btn {
  color: var(--accent-blue);
  font-size: 12px;
  cursor: pointer;
  flex-shrink: 0;
  white-space: nowrap;

  &:hover {
    text-decoration: underline;
  }
}

.search-filter-panel {
  margin: -12px;

  .search-filter-title {
    padding: 12px 14px 8px;
    font-size: 11px;
    font-weight: 500;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .search-filter-list {
    max-height: 320px;
    overflow-y: auto;
    padding: 4px 6px 8px;
  }

  .search-filter-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 10px;
    font-size: 13px;
    color: var(--text-secondary);
    cursor: pointer;
    border-radius: 6px;
    transition: all 150ms ease;

    &:hover {
      background: var(--bg-hover);
      color: var(--text-primary);
    }

    .el-icon {
      font-size: 12px;
      color: var(--text-muted);
    }
  }
}

.search-value-panel {
  margin: -12px;

  .search-value-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 14px;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary);
    border-bottom: 1px solid var(--border-subtle);

    .back-icon {
      cursor: pointer;
      color: var(--text-muted);
      padding: 2px;
      border-radius: 4px;
      transition: all 150ms ease;

      &:hover {
        color: var(--text-primary);
        background: var(--bg-hover);
      }
    }
  }

  .search-value-list {
    max-height: 280px;
    overflow-y: auto;
    padding: 6px;
  }

  .search-value-item {
    padding: 10px 12px;
    font-size: 13px;
    color: var(--text-secondary);
    cursor: pointer;
    border-radius: 6px;
    transition: all 150ms ease;
    margin-bottom: 2px;

    &:hover {
      background: rgba(113, 112, 255, 0.08);
      color: var(--accent-blue);
    }

    &:last-child {
      margin-bottom: 0;
    }
  }

  .search-value-input {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
  }
}
</style>
