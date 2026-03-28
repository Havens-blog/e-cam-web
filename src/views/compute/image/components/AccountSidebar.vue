<template>
  <div class="account-sidebar">
    <!-- 当前选中账号卡片 -->
    <div class="selected-account-card" @click="showDropdown = !showDropdown">
      <div class="selected-vendor-icon">
        <ProviderIcon v-if="selectedAccount" :provider="selectedAccount.provider" size="small" />
        <el-icon v-else :size="18"><UserFilled /></el-icon>
      </div>
      <div class="selected-account-info">
        <div class="selected-account-name">{{ selectedAccount?.name || '全部账号' }}</div>
        <div class="selected-account-meta">{{ selectedAccount ? getProviderLabel(selectedAccount.provider) : '查看所有云账号资源' }}</div>
      </div>
      <span class="switch-btn">切换账号</span>
    </div>

    <!-- 账号下拉面板 -->
    <div v-if="showDropdown" class="account-dropdown">
      <div class="dropdown-search">
        <el-input v-model="accountSearch" placeholder="搜索账号..." clearable size="small">
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
      </div>
      <div
        class="account-option"
        :class="{ active: selectedAccountId === 0 }"
        @click="handleAccountChange(0)"
      >
        <span class="option-status normal"></span>
        <div class="option-info">
          <span class="option-name">全部账号</span>
        </div>
      </div>
      <template v-for="group in filteredAccountGroups" :key="group.provider">
        <div class="account-group-header">
          <ProviderIcon :provider="group.provider" size="small" />
          <span class="group-name">{{ group.label }}</span>
          <span class="group-count">{{ group.accounts.length }}</span>
        </div>
        <div
          v-for="acc in group.accounts"
          :key="acc.id"
          class="account-option"
          :class="{ active: selectedAccountId === acc.id }"
          @click="handleAccountChange(acc.id)"
        >
          <span class="option-status" :class="acc.status || 'normal'"></span>
          <div class="option-info">
            <span class="option-name">{{ acc.name }}</span>
          </div>
          <div class="option-tags">
            <span v-if="acc.is_default" class="account-tag primary">主账号</span>
          </div>
        </div>
      </template>
      <div v-if="filteredAccountGroups.length === 0" class="empty-accounts">暂无账号</div>
    </div>

    <!-- 镜像类型筛选 -->
    <div class="sidebar-section">
      <div class="section-title">镜像类型</div>
      <div class="type-list">
        <div
          v-for="item in imageTypes"
          :key="item.value"
          class="type-item"
          :class="{ active: selectedType === item.value }"
          @click="handleTypeChange(item.value)"
        >
          <span v-if="item.dot" class="type-dot" :class="item.dot"></span>
          <span class="type-label">{{ item.label }}</span>
        </div>
      </div>
    </div>

    <!-- 快捷操作 -->
    <div class="sidebar-section">
      <div class="section-title">快捷操作</div>
      <div class="quick-actions">
        <div class="quick-action-item" @click="$emit('quickAction', 'copy')">
          <el-icon :size="14"><CopyDocument /></el-icon>
          <span>镜像复制</span>
        </div>
        <div class="quick-action-item" @click="$emit('quickAction', 'sync')">
          <el-icon :size="14"><Refresh /></el-icon>
          <span>同步镜像</span>
        </div>
        <div class="quick-action-item" @click="$emit('quickAction', 'clean')">
          <el-icon :size="14"><Delete /></el-icon>
          <span>清理过期镜像</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { listCloudAccountsApi } from '@/api'
import type { CloudAccount } from '@/api/types/account'
import ProviderIcon from '@/components/ProviderIcon.vue'
import { CLOUD_PROVIDERS } from '@/utils/constants'
import { CopyDocument, Delete, Refresh, Search, UserFilled } from '@element-plus/icons-vue'
import { computed, onMounted, ref } from 'vue'

const emit = defineEmits<{
  (e: 'update:accountId', value: number): void
  (e: 'update:imageType', value: string): void
  (e: 'quickAction', action: string): void
}>()

const imageTypes = [
  { value: '', label: '全部类型', dot: '' },
  { value: 'system', label: '公共镜像', dot: 'public' },
  { value: 'self', label: '自定义镜像', dot: 'custom' },
  { value: 'others', label: '共享镜像', dot: 'shared' },
  { value: 'marketplace', label: '市场镜像', dot: 'market' },
]

const selectedType = ref('')
const selectedAccountId = ref(0)
const accountSearch = ref('')
const accounts = ref<CloudAccount[]>([])
const showDropdown = ref(false)

const selectedAccount = computed(() => {
  if (selectedAccountId.value === 0) return null
  return accounts.value.find(a => a?.id === selectedAccountId.value) || null
})

const getProviderLabel = (provider: string): string => {
  const found = CLOUD_PROVIDERS.find(p => p.value === provider)
  return found?.label || provider || ''
}

interface AccountGroup {
  provider: string
  label: string
  accounts: CloudAccount[]
}

const filteredAccountGroups = computed<AccountGroup[]>(() => {
  const keyword = accountSearch.value.toLowerCase()
  const groups: AccountGroup[] = []
  for (const p of CLOUD_PROVIDERS) {
    const filtered = accounts.value
      .filter(a => a != null && a.provider === p.value)
      .filter(a => !keyword || a.name.toLowerCase().includes(keyword))
    if (filtered.length > 0) {
      groups.push({ provider: p.value, label: p.label, accounts: filtered })
    }
  }
  return groups
})

const handleTypeChange = (value: string) => {
  selectedType.value = value
  emit('update:imageType', value)
}

const handleAccountChange = (id: number) => {
  selectedAccountId.value = id
  showDropdown.value = false
  emit('update:accountId', id)
}

const loadAccounts = async () => {
  try {
    const res = await listCloudAccountsApi({ limit: 200 })
    const data = (res as any).data || res
    accounts.value = (data.accounts || data.data || []).filter((a: any) => a != null)
  } catch {
    accounts.value = []
  }
}

onMounted(() => { loadAccounts() })
</script>

<style scoped lang="scss">
.account-sidebar {
  width: 240px;
  flex-shrink: 0;
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  padding: 16px;
  height: fit-content;
  max-height: calc(100vh - 10rem);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* 选中账号卡片 */
.selected-account-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 10px;
  background: linear-gradient(135deg, var(--el-color-primary-light-9), rgba(64, 158, 255, 0.05));
  border: 1px solid var(--el-color-primary-light-7);
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: linear-gradient(135deg, var(--el-color-primary-light-8), rgba(64, 158, 255, 0.1));
  }

  .selected-vendor-icon {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: var(--el-color-primary);
  }

  .selected-account-info {
    flex: 1;
    min-width: 0;

    .selected-account-name {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .selected-account-meta {
      font-size: 11px;
      color: var(--text-tertiary);
      margin-top: 2px;
    }
  }

  .switch-btn {
    padding: 4px 8px;
    border-radius: 4px;
    background: var(--el-color-primary-light-8);
    color: var(--el-color-primary);
    font-size: 11px;
    font-weight: 500;
    white-space: nowrap;
    flex-shrink: 0;
  }
}

/* 账号下拉面板 */
.account-dropdown {
  padding: 10px;
  border-radius: 10px;
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  max-height: 320px;
  overflow-y: auto;

  .dropdown-search { margin-bottom: 8px; }
}

.account-group-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  font-size: 12px;
  color: var(--text-tertiary);
  font-weight: 500;
  margin-top: 6px;

  .group-name { flex: 1; }
  .group-count {
    font-size: 10px;
    color: var(--text-muted);
    padding: 1px 6px;
    background: var(--el-fill-color-light);
    border-radius: 8px;
  }
}

.account-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-secondary);
  transition: all 0.15s;
  margin-bottom: 2px;

  &:hover { background: var(--el-fill-color-light); }
  &.active {
    background: var(--el-color-primary-light-9);
    color: var(--el-color-primary);
    font-weight: 500;
  }

  .option-status {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;

    &.normal { background: var(--el-color-success); box-shadow: 0 0 4px rgba(103, 194, 58, 0.4); }
    &.warning { background: var(--el-color-warning); box-shadow: 0 0 4px rgba(230, 162, 60, 0.4); }
    &.error { background: var(--el-color-danger); box-shadow: 0 0 4px rgba(245, 108, 108, 0.4); }
    &.active { background: var(--el-color-success); box-shadow: 0 0 4px rgba(103, 194, 58, 0.4); }
    &.disabled { background: var(--text-muted); }
  }

  .option-info {
    flex: 1;
    min-width: 0;
    .option-name {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  .option-tags { display: flex; gap: 4px; }
  .account-tag {
    padding: 1px 6px;
    border-radius: 3px;
    font-size: 10px;
    font-weight: 500;
    &.primary { background: rgba(230, 162, 60, 0.15); color: var(--el-color-warning); }
    &.company { background: rgba(64, 158, 255, 0.15); color: var(--el-color-primary); }
    &.env { background: rgba(103, 194, 58, 0.15); color: var(--el-color-success); }
  }
}

.empty-accounts {
  padding: 16px;
  text-align: center;
  font-size: 12px;
  color: var(--text-tertiary);
}

/* 侧边栏分区 */
.sidebar-section {
  padding-top: 12px;
  border-top: 1px solid var(--border-subtle);
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* 镜像类型 */
.type-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.type-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-secondary);
  transition: all 0.15s;

  &:hover { background: var(--el-fill-color-light); }
  &.active {
    background: var(--el-color-primary-light-9);
    color: var(--el-color-primary);
    font-weight: 500;
  }

  .type-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;

    &.public { background: #3b82f6; }
    &.custom { background: #8b5cf6; }
    &.shared { background: #10b981; }
    &.market { background: #f59e0b; }
  }
}

/* 快捷操作 */
.quick-actions {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.quick-action-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-secondary);
  transition: all 0.15s;

  &:hover {
    background: var(--el-fill-color-light);
    color: var(--el-color-primary);
  }
}
</style>
