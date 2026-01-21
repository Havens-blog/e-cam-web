<template>
  <el-drawer
    :model-value="visible"
    :title="group?.name || '用户组详情'"
    size="560px"
    :close-on-click-modal="true"
    class="group-detail-drawer"
    @update:model-value="$emit('update:visible', $event)"
  >
    <template #header>
      <div class="drawer-header">
        <div class="group-profile">
          <div class="group-avatar">
            <el-icon :size="24"><Folder /></el-icon>
          </div>
          <div class="group-basic">
            <h3 class="group-name">{{ group?.name || '-' }}</h3>
            <p class="group-desc">{{ group?.description || '暂无描述' }}</p>
          </div>
        </div>
        <div class="header-actions">
          <el-button size="small" @click="group && $emit('edit', group)">
            <el-icon><Edit /></el-icon>
            编辑
          </el-button>
          <el-button size="small" type="danger" @click="group && $emit('delete', group)">
            <el-icon><Delete /></el-icon>
            删除
          </el-button>
        </div>
      </div>
    </template>

    <div class="drawer-content">
      <!-- 统计卡片 -->
      <div class="stats-row">
        <div class="mini-stat">
          <span class="stat-value">{{ group?.policies?.length || 0 }}</span>
          <span class="stat-label">策略</span>
        </div>
        <div class="mini-stat">
          <span class="stat-value">{{ group?.user_count || group?.member_count || 0 }}</span>
          <span class="stat-label">成员</span>
        </div>
        <div class="mini-stat">
          <span class="stat-value">{{ (group?.cloud_platforms || []).length }}</span>
          <span class="stat-label">云平台</span>
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
              <div class="info-item full">
                <span class="info-label">用户组名称</span>
                <span class="info-value">{{ group?.name || '-' }}</span>
              </div>
              <div class="info-item full">
                <span class="info-label">描述</span>
                <span class="info-value">{{ group?.description || '-' }}</span>
              </div>
              <div class="info-item full">
                <span class="info-label">云平台</span>
                <div class="platforms-row">
                  <CloudPlatformTag
                    v-for="provider in (group?.cloud_platforms || [])"
                    :key="provider"
                    :provider="provider"
                    size="small"
                  />
                  <span v-if="!(group?.cloud_platforms?.length)" class="info-value">-</span>
                </div>
              </div>
              <div class="info-item">
                <span class="info-label">租户ID</span>
                <span class="info-value mono">{{ group?.tenant_id || '-' }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">创建时间</span>
                <span class="info-value">{{ formatDateTime(group?.create_time || '') }}</span>
              </div>
              <div class="info-item full">
                <span class="info-label">更新时间</span>
                <span class="info-value">{{ formatDateTime(group?.update_time || '') }}</span>
              </div>
            </div>
          </div>

          <!-- 权限策略 -->
          <div v-show="activeTab === 'policies'" class="tab-panel">
            <div v-if="group?.policies && group.policies.length > 0" class="policies-list">
              <div
                v-for="(policy, index) in group.policies"
                :key="index"
                class="policy-card"
              >
                <div class="policy-header">
                  <div class="policy-icon">
                    <el-icon><Document /></el-icon>
                  </div>
                  <div class="policy-info">
                    <div class="policy-name">{{ policy.policy_name }}</div>
                    <div class="policy-meta">
                      <span class="policy-type" :class="policy.policy_type">
                        {{ policy.policy_type === 'system' ? '系统策略' : '自定义策略' }}
                      </span>
                      <CloudPlatformTag :provider="policy.provider" size="small" />
                    </div>
                  </div>
                </div>
                <div v-if="policy.policy_document" class="policy-doc">
                  <pre>{{ formatPolicyDoc(policy.policy_document) }}</pre>
                </div>
              </div>
            </div>
            <div v-else class="empty-tab">
              <el-icon :size="40"><Document /></el-icon>
              <p>暂无权限策略</p>
            </div>
          </div>

          <!-- 成员列表 -->
          <div v-show="activeTab === 'members'" class="tab-panel">
            <div v-loading="membersLoading">
              <div v-if="groupMembers.length > 0" class="members-list">
                <div
                  v-for="member in groupMembers"
                  :key="member.id"
                  class="member-item"
                >
                  <div class="member-avatar">
                    {{ getMemberAvatar(member) }}
                  </div>
                  <div class="member-info">
                    <div class="member-name">{{ member.username }}</div>
                    <div class="member-email">{{ member.email || member.display_name || '-' }}</div>
                  </div>
                  <div class="member-status">
                    <span class="status-dot" :class="member.status"></span>
                    <span class="status-text">{{ getStatusLabel(member.status) }}</span>
                  </div>
                </div>
              </div>
              <div v-else-if="!membersLoading" class="empty-tab">
                <el-icon :size="40"><User /></el-icon>
                <p>该用户组暂无成员</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import { getGroupMembersApi } from '@/api'
import type { CloudUser, PermissionGroup } from '@/api/types/iam'
import CloudPlatformTag from '@/components/CloudPlatformTag.vue'
import { formatDateTime } from '@/utils/format'
import { Delete, Document, Edit, Folder, User } from '@element-plus/icons-vue'
import { ref, watch } from 'vue'

const props = defineProps<{
  visible: boolean
  group: PermissionGroup | null
  tenantId?: string
}>()

defineEmits<{
  'update:visible': [value: boolean]
  'edit': [group: PermissionGroup]
  'delete': [group: PermissionGroup]
}>()

const activeTab = ref('basic')
const membersLoading = ref(false)
const groupMembers = ref<CloudUser[]>([])

const tabs = [
  { key: 'basic', label: '基本信息' },
  { key: 'policies', label: '权限策略' },
  { key: 'members', label: '成员列表' }
]

const getMemberAvatar = (member: CloudUser) => {
  if (member.display_name) return member.display_name.charAt(0).toUpperCase()
  if (member.username) return member.username.charAt(0).toUpperCase()
  return 'U'
}

const getStatusLabel = (status: string) => {
  const map: Record<string, string> = {
    'active': '活跃',
    'inactive': '未激活',
    'disabled': '已禁用',
    'deleted': '已删除'
  }
  return map[status] || status
}

const formatPolicyDoc = (doc: string) => {
  try {
    return JSON.stringify(JSON.parse(doc), null, 2)
  } catch {
    return doc
  }
}

const fetchMembers = async () => {
  if (!props.group?.id) return
  
  membersLoading.value = true
  try {
    const response = await getGroupMembersApi(props.group.id, props.tenantId)
    groupMembers.value = Array.isArray(response.data) ? response.data : []
  } catch {
    groupMembers.value = []
  } finally {
    membersLoading.value = false
  }
}

watch(() => props.visible, (val) => {
  if (val) {
    activeTab.value = 'basic'
    groupMembers.value = []
  }
})

watch(activeTab, (tab) => {
  if (tab === 'members' && props.group) {
    fetchMembers()
  }
})
</script>

<style scoped lang="scss">
.group-detail-drawer {
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

  .group-profile {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .group-avatar {
    width: 52px;
    height: 52px;
    border-radius: 14px;
    background: rgba(139, 92, 246, 0.15);
    color: var(--accent-purple);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .group-basic {
    .group-name {
      font-size: 18px;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0 0 4px 0;
    }

    .group-desc {
      font-size: 13px;
      color: var(--text-tertiary);
      margin: 0;
      max-width: 240px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
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

.stats-row {
  display: flex;
  gap: 16px;
  padding: 16px;
  background: var(--bg-hover);
  border-radius: 10px;
  margin-bottom: 24px;

  .mini-stat {
    flex: 1;
    text-align: center;

    .stat-value {
      display: block;
      font-size: 24px;
      font-weight: 700;
      color: var(--text-primary);
      margin-bottom: 4px;
    }

    .stat-label {
      font-size: 12px;
      color: var(--text-tertiary);
    }
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

    &:hover { color: var(--text-secondary); }

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

    &.full { grid-column: span 2; }

    .info-label {
      font-size: 12px;
      color: var(--text-tertiary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .info-value {
      font-size: 14px;
      color: var(--text-primary);

      &.mono {
        font-family: var(--font-mono);
        font-size: 13px;
      }
    }
  }

  .platforms-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
}

.policies-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.policy-card {
  padding: 16px;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 10px;
  transition: all 200ms ease;

  &:hover { background: var(--glass-bg-hover); }

  .policy-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
  }

  .policy-icon {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: rgba(59, 130, 246, 0.15);
    color: var(--accent-blue);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .policy-info {
    .policy-name {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 4px;
    }

    .policy-meta {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .policy-type {
      font-size: 11px;
      padding: 2px 6px;
      border-radius: 4px;
      background: var(--bg-hover);
      color: var(--text-tertiary);

      &.system {
        background: rgba(16, 185, 129, 0.15);
        color: var(--accent-green);
      }
    }
  }

  .policy-doc {
    background: var(--bg-elevated);
    border-radius: 6px;
    padding: 12px;
    overflow-x: auto;

    pre {
      margin: 0;
      font-family: var(--font-mono);
      font-size: 11px;
      color: var(--text-secondary);
      white-space: pre-wrap;
      word-break: break-all;
    }
  }
}

.members-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.member-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 10px;
  transition: all 200ms ease;

  &:hover { background: var(--glass-bg-hover); }

  .member-avatar {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple));
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 600;
    color: white;
    flex-shrink: 0;
  }

  .member-info {
    flex: 1;
    min-width: 0;

    .member-name {
      font-size: 14px;
      font-weight: 500;
      color: var(--text-primary);
    }

    .member-email {
      font-size: 12px;
      color: var(--text-tertiary);
    }
  }

  .member-status {
    display: flex;
    align-items: center;
    gap: 6px;

    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--text-muted);

      &.active { background: var(--accent-green); }
      &.inactive { background: var(--text-tertiary); }
      &.disabled { background: var(--accent-red); }
    }

    .status-text {
      font-size: 12px;
      color: var(--text-tertiary);
    }
  }
}

.empty-tab {
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
