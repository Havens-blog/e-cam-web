<template>
  <div class="instance-type-selector">
    <!-- 搜索栏 -->
    <div class="selector-search-bar">
      <el-input
        v-model="searchText"
        class="search-input"
        placeholder="搜索规格名称、vCPU、内存..."
        clearable
        :prefix-icon="Search"
      />
      <el-select v-model="cpuFilter" class="filter-select" placeholder="vCPU">
        <el-option label="全部 vCPU" value="" />
        <el-option
          v-for="c in cpuOptions"
          :key="c"
          :label="`${c}核`"
          :value="c"
        />
      </el-select>
      <el-select v-model="memoryFilter" class="filter-select" placeholder="内存">
        <el-option label="全部内存" value="" />
        <el-option
          v-for="m in memoryOptions"
          :key="m"
          :label="`${m}GB`"
          :value="m"
        />
      </el-select>
    </div>

    <!-- 已选规格展示 -->
    <div v-if="selectedInstance" class="selected-instance-banner">
      <div class="selected-icon">⚡</div>
      <div class="selected-info">
        <div class="selected-name">{{ selectedInstance?.instance_type }}</div>
        <div class="selected-specs">
          <span>🔲 {{ selectedInstance?.cpu }} vCPU</span>
          <span>📦 {{ selectedInstance?.memory_gb }} GB 内存</span>
        </div>
      </div>
      <el-button size="small" type="primary" plain @click="handleChangeSpec">更换规格</el-button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="loading-placeholder">
      <el-icon class="is-loading"><Loading /></el-icon> 加载规格中...
    </div>

    <template v-else-if="safeInstanceTypes.length > 0">
      <!-- 分类标签 -->
      <div class="category-tabs">
        <div
          v-for="cat in categories.filter(item => item != null)"
          :key="cat?.key"
          class="category-tab"
          :class="{ active: activeCategory === cat?.key }"
          @click="activeCategory = cat?.key || 'all'"
        >
          {{ cat?.label }}
          <span class="tab-count">{{ cat?.count }}</span>
        </div>
      </div>

      <!-- 推荐规格 -->
      <div v-if="activeCategory === 'all' && recommendedTypes.length > 0" class="recommended-section">
        <div class="section-title">⭐ 推荐规格</div>
        <div class="recommended-grid">
          <div
            v-for="it in recommendedTypes.filter(item => item != null)"
            :key="it?.instance_type"
            class="spec-card recommended"
            :class="{ active: modelValue === it?.instance_type }"
            @click="handleSelect(it?.instance_type || '')"
          >
            <div class="card-top-row">
              <span class="card-name">{{ it?.instance_type }}</span>
              <span class="badge-hot">HOT</span>
            </div>
            <div class="card-spec-row">{{ it?.cpu }} vCPU / {{ it?.memory_gb }} GB</div>
            <div v-if="modelValue === it?.instance_type" class="card-check">
              <el-icon><Check /></el-icon>
            </div>
          </div>
        </div>
      </div>

      <!-- 分组折叠列表 -->
      <div class="group-list">
        <div
          v-for="group in filteredGroups.filter(item => item != null)"
          :key="group?.key"
          class="spec-group"
        >
          <div class="group-header" @click="toggleGroup(group?.key || '')">
            <span class="group-icon" :class="group?.key">{{ group?.icon }}</span>
            <span class="group-name">{{ group?.label }}</span>
            <span class="group-count">{{ group?.items?.length || 0 }} 个规格</span>
            <el-icon class="group-arrow" :class="{ expanded: expandedGroups.has(group?.key || '') }">
              <ArrowDown />
            </el-icon>
          </div>
          <div v-if="expandedGroups.has(group?.key || '')" class="group-items-grid">
            <div
              v-for="it in (group?.items || []).filter(item => item != null)"
              :key="it?.instance_type"
              class="spec-card"
              :class="{ active: modelValue === it?.instance_type }"
              @click="handleSelect(it?.instance_type || '')"
            >
              <div class="card-name">{{ it?.instance_type }}</div>
              <div class="card-spec-row">{{ it?.cpu }} vCPU / {{ it?.memory_gb }} GB</div>
              <div v-if="modelValue === it?.instance_type" class="card-check">
                <el-icon><Check /></el-icon>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <div v-else class="empty-placeholder">
      请先选择云账号和地域以加载实例规格
    </div>

    <!-- 自定义输入 -->
    <div class="custom-input-section">
      <div class="custom-input-divider">
        <span>或手动输入规格</span>
      </div>
      <div class="custom-input-row">
        <el-input
          v-model="customType"
          placeholder="输入实例规格 ID，如 ecs.g6.large"
          clearable
          @keyup.enter="applyCustomType"
        />
        <el-button type="primary" :disabled="!customType.trim()" @click="applyCustomType">确定</el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { InstanceTypeInfo } from '@/api/types/template'
import { ArrowDown, Check, Loading, Search } from '@element-plus/icons-vue'
import { computed, ref } from 'vue'

interface Props {
  modelValue: string
  instanceTypes: InstanceTypeInfo[]
  loading: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  instanceTypes: () => [],
  loading: false
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

// ==================== 状态 ====================

const searchText = ref('')
const cpuFilter = ref<number | string>('')
const memoryFilter = ref<number | string>('')
const activeCategory = ref('all')
const expandedGroups = ref(new Set<string>())
const customType = ref('')

const cpuOptions = [1, 2, 4, 8, 16, 32, 64]
const memoryOptions = [1, 2, 4, 8, 16, 32, 64, 128]

// ==================== 安全计算属性 ====================

const safeInstanceTypes = computed(() =>
  (props.instanceTypes || []).filter(item => item != null)
)

const selectedInstance = computed(() =>
  props.modelValue
    ? safeInstanceTypes.value.find(it => it?.instance_type === props.modelValue) || null
    : null
)

// ==================== 分类逻辑 ====================

type CategoryKey = 'all' | 'general' | 'compute' | 'memory' | 'storage' | 'gpu' | 'burstable'

interface CategoryDef {
  key: CategoryKey
  label: string
  icon: string
  match: (name: string) => boolean
}

const categoryDefs: CategoryDef[] = [
  { key: 'gpu', label: 'GPU型', icon: '🟡', match: (n) => {
    // 阿里云: ecs.gn6.*, 火山: ecs.gni.*, AWS: p3.*, g4dn.*, 腾讯: GN*
    return /\.gn/i.test(n) || /\.gpu/i.test(n) || /^p\d/i.test(n) || /^g\d[a-z]*dn/i.test(n) || /^GN/i.test(n)
  }},
  { key: 'burstable', label: '突发型', icon: '🔵', match: (n) => {
    // 阿里云: ecs.t6.*, 火山: ecs.t3i.*, AWS: t3.*, 腾讯: T*
    return /\.t\d/i.test(n) || /^t\d/i.test(n) || /^T\d/.test(n)
  }},
  { key: 'compute', label: '计算型', icon: '🔴', match: (n) => {
    // 阿里云: ecs.c6.*, 火山: ecs.c3i.*, 华为: c6.*, AWS: c5.*, 腾讯: C3.*
    return /\.c\d/i.test(n) || /^c\d/i.test(n) || /^C\d/.test(n)
  }},
  { key: 'memory', label: '内存型', icon: '🟣', match: (n) => {
    // 阿里云: ecs.r6.*, 火山: ecs.r3i.*, AWS: r5.*, x1.*, 腾讯: M5.*
    return /\.r\d/i.test(n) || /^r\d/i.test(n) || /^R\d/.test(n) || /^x\d/i.test(n) || /^M\d/.test(n)
  }},
  { key: 'storage', label: '存储型', icon: '🟢', match: (n) => {
    // 阿里云: ecs.i2.*, ecs.d1.*, AWS: i3.*, d2.*, 华为: ir3.*
    return /\.[id]\d/i.test(n) || /^i\d/i.test(n) || /^d\d/i.test(n) || /^I\d/.test(n) || /^D\d/.test(n)
  }},
  { key: 'general', label: '通用型', icon: '🔷', match: (n) => {
    // 阿里云: ecs.g6.* (非gn), 火山: ecs.g3i.*, 华为: s6.*, AWS: m5.*, 腾讯: S5.*
    if (/\.gn/i.test(n)) return false // 排除 GPU
    return /\.g\d/i.test(n) || /^s\d/i.test(n) || /^m\d/i.test(n) || /^S\d/.test(n) || /\.s\d/i.test(n)
  }},
]

function getCategory(name: string): CategoryKey {
  for (const def of categoryDefs) {
    if (def.match(name)) return def.key
  }
  return 'general'
}

// ==================== 筛选 ====================

const filteredBySearch = computed(() => {
  let list = safeInstanceTypes.value

  if (searchText.value) {
    const q = searchText.value.toLowerCase()
    list = list.filter(it => {
      const name = (it?.instance_type || '').toLowerCase()
      const cpu = String(it?.cpu || '')
      const mem = String(it?.memory_gb || '')
      return name.includes(q) || cpu.includes(q) || mem.includes(q)
    })
  }

  if (cpuFilter.value !== '' && cpuFilter.value !== undefined) {
    list = list.filter(it => it?.cpu === Number(cpuFilter.value))
  }

  if (memoryFilter.value !== '' && memoryFilter.value !== undefined) {
    list = list.filter(it => it?.memory_gb === Number(memoryFilter.value))
  }

  return list
})

const filteredByCategory = computed(() => {
  if (activeCategory.value === 'all') return filteredBySearch.value
  return filteredBySearch.value.filter(it =>
    getCategory(it?.instance_type || '') === activeCategory.value
  )
})

// ==================== 分类标签（含数量） ====================

const categories = computed(() => {
  const list = filteredBySearch.value
  const counts: Record<string, number> = { all: list.length }
  for (const def of categoryDefs) {
    counts[def.key] = list.filter(it => def.match(it?.instance_type || '')).length
  }
  return [
    { key: 'all', label: '全部', count: counts.all },
    ...categoryDefs.map(d => ({ key: d.key, label: d.label, count: counts[d.key] || 0 }))
  ].filter(c => (c.count ?? 0) > 0 || c.key === 'all')
})

// ==================== 推荐规格 ====================

const recommendedSpecs = [
  { cpu: 4, memory: 8 },
  { cpu: 8, memory: 16 },
  { cpu: 2, memory: 4 },
]

const recommendedTypes = computed(() => {
  const result: InstanceTypeInfo[] = []
  for (const spec of recommendedSpecs) {
    const found = safeInstanceTypes.value.find(
      it => it?.cpu === spec.cpu && it?.memory_gb === spec.memory
    )
    if (found) result.push(found)
  }
  return result
})

// ==================== 分组折叠列表 ====================

interface SpecGroup {
  key: string
  label: string
  icon: string
  items: InstanceTypeInfo[]
}

const filteredGroups = computed<SpecGroup[]>(() => {
  const items = filteredByCategory.value
  const groupMap = new Map<string, InstanceTypeInfo[]>()

  for (const it of items) {
    const cat = getCategory(it?.instance_type || '')
    if (!groupMap.has(cat)) groupMap.set(cat, [])
    groupMap.get(cat)!.push(it)
  }

  return categoryDefs
    .filter(d => groupMap.has(d.key))
    .map(d => ({
      key: d.key,
      label: d.label,
      icon: d.icon,
      items: groupMap.get(d.key) || []
    }))
})

// ==================== 操作 ====================

function handleSelect(instanceType: string) {
  emit('update:modelValue', instanceType)
}

function handleChangeSpec() {
  emit('update:modelValue', '')
}

function applyCustomType() {
  const val = customType.value.trim()
  if (val) {
    emit('update:modelValue', val)
    customType.value = ''
  }
}

function toggleGroup(key: string) {
  if (expandedGroups.value.has(key)) {
    expandedGroups.value.delete(key)
  } else {
    expandedGroups.value.add(key)
  }
}
</script>

<style scoped>
.instance-type-selector {
  width: 100%;
}

/* ==================== 搜索栏 ==================== */
.selector-search-bar {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
}

.selector-search-bar .search-input {
  flex: 1;
}

.selector-search-bar .filter-select {
  width: 130px;
  flex-shrink: 0;
}

/* ==================== 已选规格 ==================== */
.selected-instance-banner {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 18px;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(64, 158, 255, 0.08), rgba(124, 58, 237, 0.08));
  border: 1px solid rgba(64, 158, 255, 0.25);
  margin-bottom: 16px;
  transition: all 0.3s ease;
}

.selected-instance-banner:hover {
  border-color: rgba(64, 158, 255, 0.4);
}

.selected-icon {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: linear-gradient(135deg, #409eff, #7c3aed);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
}

.selected-info {
  flex: 1;
  min-width: 0;
}

.selected-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-bottom: 4px;
}

.selected-specs {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

/* ==================== Loading / Empty ==================== */
.loading-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 32px 0;
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

.empty-placeholder {
  text-align: center;
  padding: 32px 0;
  color: var(--el-text-color-placeholder);
  font-size: 14px;
}

/* ==================== 分类标签 ==================== */
.category-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  overflow-x: auto;
  scrollbar-width: thin;
}

.category-tabs::-webkit-scrollbar {
  height: 4px;
}

.category-tabs::-webkit-scrollbar-thumb {
  background: var(--el-border-color);
  border-radius: 2px;
}

.category-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.25s ease;
  user-select: none;
}

.category-tab:hover {
  color: var(--el-text-color-primary);
  background: var(--el-fill-color);
}

.category-tab.active {
  color: #fff;
  background: var(--el-color-primary);
}

.tab-count {
  padding: 1px 6px;
  border-radius: 8px;
  font-size: 11px;
  background: rgba(0, 0, 0, 0.06);
}

.category-tab.active .tab-count {
  background: rgba(255, 255, 255, 0.25);
}

/* ==================== 推荐规格 ==================== */
.recommended-section {
  margin-bottom: 20px;
}

.section-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-secondary);
  margin-bottom: 10px;
}

.recommended-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

/* ==================== 规格卡片 ==================== */
.spec-card {
  position: relative;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid var(--el-border-color-lighter);
  background: var(--el-bg-color);
  cursor: pointer;
  transition: all 0.25s ease;
  user-select: none;
}

.spec-card:hover {
  border-color: var(--el-color-primary-light-3);
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.1);
}

.spec-card.active {
  border-color: var(--el-color-primary);
  background: rgba(64, 158, 255, 0.04);
  box-shadow: 0 2px 12px rgba(64, 158, 255, 0.15);
}

.spec-card.recommended {
  background: var(--el-fill-color-blank);
}

.card-top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.card-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-spec-row {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}

.badge-hot {
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 700;
  background: rgba(245, 108, 108, 0.15);
  color: #f56c6c;
  letter-spacing: 0.5px;
  flex-shrink: 0;
}

.card-check {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--el-color-primary);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}

/* ==================== 分组折叠列表 ==================== */
.group-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.group-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 10px;
  background: var(--el-fill-color-light);
  cursor: pointer;
  transition: all 0.25s ease;
  user-select: none;
}

.group-header:hover {
  background: var(--el-fill-color);
}

.group-icon {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
}

.group-icon.general { background: rgba(64, 158, 255, 0.15); }
.group-icon.compute { background: rgba(245, 108, 108, 0.15); }
.group-icon.memory { background: rgba(168, 85, 247, 0.15); }
.group-icon.storage { background: rgba(103, 194, 58, 0.15); }
.group-icon.gpu { background: rgba(230, 162, 60, 0.15); }
.group-icon.burstable { background: rgba(64, 158, 255, 0.15); }

.group-name {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.group-count {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.group-arrow {
  color: var(--el-text-color-secondary);
  transition: transform 0.3s ease;
  font-size: 14px;
}

.group-arrow.expanded {
  transform: rotate(180deg);
}

.group-items-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  padding: 10px 0 0 0;
}

/* ==================== 自定义输入 ==================== */
.custom-input-section {
  margin-top: 16px;
}
.custom-input-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
  color: var(--el-text-color-placeholder);
  font-size: 12px;
}
.custom-input-divider::before,
.custom-input-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--el-border-color-lighter);
}
.custom-input-row {
  display: flex;
  gap: 8px;
}
.custom-input-row .el-input {
  flex: 1;
}

/* ==================== 深色模式 ==================== */
html.dark .selected-instance-banner {
  background: linear-gradient(135deg, rgba(64, 158, 255, 0.12), rgba(124, 58, 237, 0.12));
  border-color: rgba(64, 158, 255, 0.3);
}

html.dark .spec-card {
  background: rgba(30, 41, 59, 0.5);
  border-color: rgba(148, 163, 184, 0.12);
}

html.dark .spec-card:hover {
  border-color: rgba(64, 158, 255, 0.4);
  background: rgba(59, 130, 246, 0.06);
}

html.dark .spec-card.active {
  border-color: var(--el-color-primary);
  background: rgba(59, 130, 246, 0.1);
}

html.dark .group-header {
  background: rgba(15, 23, 42, 0.5);
}

html.dark .group-header:hover {
  background: rgba(59, 130, 246, 0.06);
}

html.dark .category-tab {
  background: rgba(148, 163, 184, 0.08);
  color: var(--el-text-color-secondary);
}

html.dark .category-tab:hover {
  background: rgba(148, 163, 184, 0.15);
}

html.dark .badge-hot {
  background: rgba(245, 108, 108, 0.2);
}

/* ==================== 响应式 ==================== */
@media (max-width: 768px) {
  .recommended-grid,
  .group-items-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .selector-search-bar {
    flex-wrap: wrap;
  }

  .selector-search-bar .filter-select {
    width: calc(50% - 5px);
  }
}
</style>
