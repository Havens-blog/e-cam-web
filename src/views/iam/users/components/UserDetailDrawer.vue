<template>
  <el-drawer
    :model-value="visible"
    :title="user?.username || '用户详情'"
    size="560px"
    :close-on-click-modal="true"
    class="user-detail-drawer"
    @update:model-value="$emit('update:visible', $event)"
  >
    <template #header>
      <div class="drawer-header">
        <div class="user-profile">
          <div class="user-avatar">
            {{ getAvatarText(user) }}
          </div>
          <div class="user-basic">
            <h3 class="user-name">{{ user?.username || '-' }}</h3>
            <p class="user-email">{{ user?.email || user?.display_name || '-' }}</p>
          </div>
        </div>
        <div class="header-actions">
          <el-button size="small" @click="user && $emit('edit', user)">
            <el-icon><Edit /></el-icon>
            编辑
          </el-button>
          <el-button size="small" type="danger" @click="user && $emit('delete', user)">
            <el-icon><Delete /></el-icon>
            删除
          </el-button>
        </div>
      </div>
    </template>

    <div class="drawer-content">
      <!-- 状态卡片 -->
      <div class="status-card">
        <div class="status-item">
          <span class="status-dot" :class="getStatusClass(user?.status || '')"></span>
          <span class="status-label">{{ getSafeUserStatus(user?.status || '').label }}</span>
        </div>
        <div class="status-divider"></div>
        <div class="status-item">
          <span class="type-badge">{{ getUserTypeLabel(user?.user_type || '') }}</span>
        </div>
      </div>

      <!-- 标签页 -->
      <div class="tabs-container">
        <div class="tabs-header">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            class="tab-btn"
            :class="{ active: activeTab === tab.key }"
            @click="activeTab = tab.key"
          >
            {{ tab.label }}
          </button>
        </div>

        <div class="tabs-content">
          <!-- 基本信息 -->
          <div v-show="activeTab === 'basic'" class="tab-panel">
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">用户名</span>
                <span class="info-value">{{ user?.username || '-' }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">显示名称</span>
                <span class="info-value">{{ user?.display_name || '-' }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">邮箱</span>
                <span class="info-value">{{ user?.email || '-' }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">用户类型</span>
                <span class="info-value">{{ getUserTypeLabel(user?.user_type || '') }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">云平台</span>
                <span class="info-value platform">
                  <ProviderIcon v-if="user?.provider" :provider="user.provider" size="small" />
                  {{ getProviderLabel(user?.provider || '') || '-' }}
                </span>
              </div>
              <div class="info-item">
                <span class="info-label">云账号</span>
                <span class="info-value">{{ user?.cloud_account_name || '-' }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">租户ID</span>
                <span class="info-value mono">{{ user?.tenant_id || '-' }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">创建时间</span>
                <span class="info-value">{{ formatDateTime(user?.create_time) }}</span>
              </div>
              <div class="info-item full">
                <span class="info-label">更新时间</span>
                <span class="info-value">{{ formatDateTime(user?.update_time) }}</span>
              </div>
            </div>
          </div>

          <!-- 用户组 -->
          <div v-show="activeTab === 'groups'" class="tab-panel">
            <div v-if="user?.permission_groups && user.permission_groups.length > 0" class="groups-list">
              <div
                v-for="group in user.permission_groups"
                :key="group.id"
                class="group-card"
              >
                <div class="group-header">
                  <div class="group-icon">
                    <el-icon><Folder /></el-icon>
                  </div>
                  <div class="group-info">
                    <div class="group-name">{{ group.name }}</div>
                    <div class="group-meta">
                      {{ group.policies?.length || 0 }} 个策略
                    </div>
                  </div>
                </div>
                <div v-if="group.description" class="group-desc">
                  {{ group.description }}
                </div>
                <div v-if="group.policies && group.policies.length > 0" class="policies-row">
                  <span
                    v-for="policy in group.policies.slice(0, 3)"
                    :key="policy.policy_id"
                    class="policy-tag"
                  >
                    {{ policy.policy_name }}
                  </span>
                  <span v-if="group.policies.length > 3" class="policy-more">
                    +{{ group.policies.length - 3 }}
                  </span>
                </div>
              </div>
            </div>
            <div v-else class="empty-groups">
              <el-icon :size="40"><FolderRemove /></el-icon>
              <p>暂无用户组</p>
            </div>
          </div>

          <!-- 操作日志 -->
          <div v-show="activeTab === 'logs'" class="tab-panel">
            <div class="coming-soon">
              <el-icon :size="40"><Document /></el-icon>
              <p>操作日志功能开发中</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import type { CloudUser } from '@/api/types/iam'
import ProviderIcon from '@/components/ProviderIcon.vue'
import { getProviderLabel, getUserStatus, getUserTypeLabel } from '@/utils/constants'
import { Delete, Document, Edit, Folder, FolderRemove } from '@element-plus/icons-vue'
import { ref } from 'vue'

defineProps<{
  visible: boolean
  user: CloudUser | null
}>()

defineEmits<{
  'update:visible': [value: boolean]
  'edit': [user: CloudUser]
  'delete': [user: CloudUser]
}>()

const activeTab = ref('basic')

const tabs = [
  { key: 'basic', label: '基本信息' },
  { key: 'groups', label: '用户组' },
  { key: 'logs', label: '操作日志' }
]

const getAvatarText = (user: CloudUser | null) => {
  if (!user) return 'U'
  if (user.display_name) return user.display_name.charAt(0).toUpperCase()
  if (user.username) return user.username.charAt(0).toUpperCase()
  return 'U'
}

const getSafeUserStatus = (status: string | undefined) => {
  if (!status) return { label: '-', color: 'info' }
  return getUserStatus(status) || { label: '-', color: 'info' }
}

const getStatusClass = (status: string | undefined) => {
  if (!status) return ''
  const map: Record<string, string> = {
    'active': 'status-active',
    'inactive': 'status-inactive',
    'disabled': 'status-disabled',
    'locked': 'status-locked'
  }
  return map[status] || ''
}

const formatDateTime = (time: string | undefined) => {
  if (!time) return '-'
  return new Date(time).toLocaleString('zh-CN')
}
</script>

<style scoped lang="scss">
.user-detail-drawer {
  :deep(.el-drawer__header) {
    padding: 0;
    margin-bottom: 0;
    border-bottom: 1px solid var(--border-subtle);
  }

  :deep(.el-drawer__body) {
    padding: 0;
  }
}

.drawer-header {
  padding: 20px 24px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;

  .user-profile {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .user-avatar {
    width: 52px;
    height: 52px;
    border-radius: 14px;
    background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple));
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    font-weight: 600;
    color: white;
  }

  .user-basic {
    .user-name {
      font-size: 18px;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0 0 4px 0;
    }

    .user-email {
      font-size: 13px;
      color: var(--text-tertiary);
      margin: 0;
    }
  }

  .header-actions {
    display: flex;
    gap: 8px;
  }
}

.drawer-content {
  padding: 20px 24px;
}

.status-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 18px;
  background: var(--bg-hover);
  border-radius: 10px;
  margin-bottom: 24px;

  .status-item {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--text-muted);

    &.status-active { background: var(--accent-green); }
    &.status-inactive { background: var(--text-tertiary); }
    &.status-disabled { background: var(--accent-red); }
    &.status-locked { background: var(--accent-yellow); }
  }

  .status-label {
    font-size: 14px;
    color: var(--text-secondary);
  }

  .status-divider {
    width: 1px;
    height: 20px;
    background: var(--border-base);
  }

  .type-badge {
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    background: rgba(59, 130, 246, 0.15);
    color: var(--accent-blue);
  }
}

.tabs-container {
  .tabs-header {
    display: flex;
    gap: 4px;
    padding: 4px;
    background: var(--bg-hover);
    border-radius: 10px;
    margin-bottom: 20px;
  }

  .tab-btn {
    flex: 1;
    padding: 10px 16px;
    border: none;
    background: transparent;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    color: var(--text-tertiary);
    cursor: pointer;
    transition: all 200ms ease;

    &:hover {
      color: var(--text-secondary);
    }

    &.active {
      background: var(--bg-surface);
      color: var(--text-primary);
      box-shadow: var(--shadow-sm);
    }
  }
}

.tab-panel {
  min-height: 200px;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;

  .info-item {
    display: flex;
    flex-direction: column;
    gap: 6px;

    &.full {
      grid-column: span 2;
    }

    .info-label {
      font-size: 12px;
      color: var(--text-tertiary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .info-value {
      font-size: 14px;
      color: var(--text-primary);

      &.platform {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      &.mono {
        font-family: var(--font-mono);
        font-size: 13px;
      }
    }
  }
}

.groups-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.group-card {
  padding: 16px;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 10px;
  transition: all 200ms ease;

  &:hover {
    background: var(--glass-bg-hover);
  }

  .group-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
  }

  .group-icon {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: rgba(139, 92, 246, 0.15);
    color: var(--accent-purple);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .group-info {
    .group-name {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary);
    }

    .group-meta {
      font-size: 12px;
      color: var(--text-tertiary);
    }
  }

  .group-desc {
    font-size: 13px;
    color: var(--text-secondary);
    margin-bottom: 12px;
    line-height: 1.5;
  }

  .policies-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .policy-tag {
    padding: 3px 8px;
    border-radius: 4px;
    font-size: 11px;
    background: var(--bg-hover);
    color: var(--text-secondary);
  }

  .policy-more {
    font-size: 11px;
    color: var(--text-tertiary);
    padding: 3px 0;
  }
}

.empty-groups,
.coming-soon {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 20px;
  color: var(--text-muted);

  p {
    margin: 12px 0 0 0;
    font-size: 14px;
  }
}
</style>
