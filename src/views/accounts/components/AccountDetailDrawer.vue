<template>
  <el-drawer
    :model-value="visible"
    :title="account?.name || '云账号详情'"
    size="560px"
    :close-on-click-modal="true"
    class="account-detail-drawer"
    @update:model-value="$emit('update:visible', $event)"
  >
    <template #header>
      <div class="drawer-header">
        <div class="account-profile">
          <div class="account-avatar" :class="getProviderClass(account?.provider || '')">
            <ProviderIcon v-if="account?.provider" :provider="account.provider" size="small" />
          </div>
          <div class="account-basic">
            <h2 class="account-name">{{ account?.name || '-' }}</h2>
            <p class="account-provider">{{ getProviderName(account?.provider || '') }}</p>
          </div>
        </div>
        <div class="header-actions">
          <el-button size="small" @click="account && $emit('edit', account)">
            <el-icon><Edit /></el-icon>
            编辑
          </el-button>
          <el-button
            size="small"
            type="danger"
            :loading="deleting"
            :disabled="actionPending"
            @click="account && $emit('delete', account)"
          >
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
          <span class="status-dot" :class="getStatusClass(account?.status || '')"></span>
          <span class="status-label">{{ getStatusLabel(account?.status || '') }}</span>
        </div>
        <div class="status-divider"></div>
        <div class="status-item">
          <span class="env-badge" :class="getEnvClass(account?.environment || '')">
            {{ getEnvironmentLabel(account?.environment || '') }}
          </span>
        </div>
        <div class="status-divider"></div>
        <div class="status-item">
          <span class="asset-label">{{ account?.asset_count || 0 }} 个资产</span>
        </div>
      </div>

      <!-- 快捷操作 -->
      <div class="quick-actions">
        <button class="quick-btn" :disabled="actionPending" @click="account && $emit('test', account)">
          <el-icon><Connection /></el-icon>
          <span>测试连接</span>
        </button>
        <button class="quick-btn" @click="account && $emit('sync', account)">
          <el-icon><Refresh /></el-icon>
          <span>同步资产</span>
        </button>
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
                <span class="info-label">账号名称</span>
                <span class="info-value">{{ account?.name || '-' }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">云平台</span>
                <span class="info-value platform">
                  <ProviderIcon v-if="account?.provider" :provider="account.provider" size="small" />
                  {{ getProviderName(account?.provider || '') }}
                </span>
              </div>
              <div class="info-item">
                <span class="info-label">环境</span>
                <span class="info-value">{{ getEnvironmentLabel(account?.environment || '') }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">区域</span>
                <span class="info-value">{{ account?.region || '-' }}</span>
              </div>
              <div class="info-item full">
                <span class="info-label">Access Key ID</span>
                <span class="info-value mono">{{ account?.access_key_id || '-' }}</span>
              </div>
              <div class="info-item full">
                <span class="info-label">描述</span>
                <span class="info-value">{{ account?.description || '-' }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">创建时间</span>
                <span class="info-value">{{ formatDateTime(account?.create_time) }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">更新时间</span>
                <span class="info-value">{{ formatDateTime(account?.update_time) }}</span>
              </div>
            </div>

            <!-- 权限体检 -->
            <section class="permission-check">
              <div class="pc-header">
                <div class="pc-heading">
                  <span class="pc-title">权限体检</span>
                  <span v-if="permissionCheck" class="pc-time">
                    体检时间：{{ formatDateTime(permissionCheck.checked_at) }}
                  </span>
                </div>
                <el-button
                  type="primary"
                  size="small"
                  :loading="checking"
                  :disabled="checking || !account"
                  @click="handlePermissionCheck"
                >
                  {{ checking ? '体检中...' : '开始体检' }}
                </el-button>
              </div>

              <el-alert
                v-if="permissionCheck?.is_primary_account"
                type="error"
                :closable="false"
                show-icon
                class="pc-alert"
                title="当前为主账号 AK，存在越权风险，请改用 RAM 子账号"
              />

              <template v-if="permissionCheck">
                <div class="pc-summary">
                  <span class="pc-summary-item is-ok">通过 {{ permissionCheck.summary.ok }} 项</span>
                  <span class="pc-summary-item is-denied">权限不足 {{ permissionCheck.summary.denied }} 项</span>
                  <span class="pc-summary-item is-error">异常 {{ permissionCheck.summary.error }} 项</span>
                  <span v-if="permissionCheck.summary.unsupported > 0" class="pc-summary-item is-unsupported">
                    未支持 {{ permissionCheck.summary.unsupported }} 项
                  </span>
                </div>

                <el-table
                  :data="permissionCheck.items"
                  size="small"
                  border
                  max-height="320"
                  class="pc-table"
                >
                  <el-table-column prop="asset_name" label="资源类型" min-width="130" show-overflow-tooltip />
                  <el-table-column label="状态" width="96">
                    <template #default="{ row }">
                      <el-tag :type="getPermissionStatusTagType(row.status)" size="small">
                        {{ getPermissionStatusLabel(row.status) }}
                      </el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column label="说明" min-width="150" show-overflow-tooltip>
                    <template #default="{ row }">{{ row.message || '-' }}</template>
                  </el-table-column>
                </el-table>
              </template>

              <p v-else class="pc-empty">
                尚未进行体检。点击「开始体检」探测该账号对各资源类型的列举权限。
              </p>
            </section>
          </div>

          <!-- 配置信息 -->
          <div v-show="activeTab === 'config'" class="tab-panel">
            <div class="config-list">
              <div class="config-item">
                <div class="config-info">
                  <span class="config-name">自动同步</span>
                  <span class="config-desc">定期自动同步云资产</span>
                </div>
                <span class="config-status" :class="{ enabled: account?.config?.enable_auto_sync }">
                  {{ account?.config?.enable_auto_sync ? '已启用' : '未启用' }}
                </span>
              </div>
              <div class="config-item">
                <div class="config-info">
                  <span class="config-name">同步间隔</span>
                  <span class="config-desc">自动同步的时间间隔</span>
                </div>
                <span class="config-value">{{ account?.config?.sync_interval || '-' }} 分钟</span>
              </div>
              <div class="config-item">
                <div class="config-info">
                  <span class="config-name">只读模式</span>
                  <span class="config-desc">仅允许查看，禁止修改操作</span>
                </div>
                <span class="config-status" :class="{ enabled: account?.config?.read_only }">
                  {{ account?.config?.read_only ? '是' : '否' }}
                </span>
              </div>
              <div class="config-item">
                <div class="config-info">
                  <span class="config-name">成本监控</span>
                  <span class="config-desc">启用费用监控和分析</span>
                </div>
                <span class="config-status" :class="{ enabled: account?.config?.enable_cost_monitoring }">
                  {{ account?.config?.enable_cost_monitoring ? '已启用' : '未启用' }}
                </span>
              </div>
            </div>
          </div>

          <!-- 关联资产 -->
          <div v-show="activeTab === 'assets'" class="tab-panel">
            <div class="coming-soon">
              <el-icon :size="40"><Box /></el-icon>
              <p>关联资产功能开发中</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import { checkAccountPermissions } from '@/api'
import type { CloudAccount, PermissionCheck, PermissionCheckStatus } from '@/api/types/account'
import { showApiError } from '@/api/request'
import { ProviderIcon } from '@haven/ui/ProviderIcon'
import { getProviderLabel } from '@/utils/constants'
import { Box, Connection, Delete, Edit, Refresh } from '@element-plus/icons-vue'
import { computed, ref, watch } from 'vue'
import { formatTime as formatDateTime } from '@/utils/formatters'

const props = defineProps<{
  visible: boolean
  account: CloudAccount | null
  /** 宿主侧删除操作进行中（防重复提交守卫） */
  deleting?: boolean
  /** 宿主侧测试连接操作进行中 */
  testing?: boolean
  /** 宿主侧禁用/启用操作进行中 */
  toggling?: boolean
}>()

defineEmits<{
  'update:visible': [value: boolean]
  'edit': [account: CloudAccount]
  'delete': [account: CloudAccount]
  'test': [account: CloudAccount]
  'sync': [account: CloudAccount]
}>()

const activeTab = ref('basic')

// 任一异步操作进行中：禁用删除/测试连接入口，防止并发第二个请求
const actionPending = computed(
  () => !!(props.deleting || props.testing || props.toggling)
)

// ==================== 权限体检 ====================
const checking = ref(false)
const permissionCheck = ref<PermissionCheck | null>(null)

/** 打开抽屉 / 切换账号时，详情接口已返回的体检结果直接渲染，无需再点按钮 */
watch(
  () => [props.visible, props.account?.id] as const,
  ([visible]) => {
    if (!visible) return
    permissionCheck.value = props.account?.permission_check ?? null
  },
  { immediate: true }
)

/** 详情接口在抽屉打开后异步返回时补渲染；本地已有结果则不覆盖，避免冲掉刚完成的体检 */
watch(
  () => props.account?.permission_check,
  (check) => {
    if (props.visible && permissionCheck.value === null && check) {
      permissionCheck.value = check
    }
  }
)

const handlePermissionCheck = async () => {
  if (!props.account || checking.value) return
  const accountId = props.account.id
  checking.value = true
  try {
    const result = await checkAccountPermissions(accountId)
    // 体检期间切换了账号/关闭了抽屉：丢弃过期结果，避免渲染到别的账号上
    if (props.account?.id === accountId) permissionCheck.value = result
  } catch (error) {
    // 请求层已弹过业务错误提示，showApiError 只在未提示时补一条，避免重复 toast
    showApiError(error, '权限体检失败')
  } finally {
    checking.value = false
  }
}

const PERMISSION_STATUS_META: Record<PermissionCheckStatus, {
  label: string
  type: 'success' | 'warning' | 'danger' | 'info'
}> = {
  ok: { label: '通过', type: 'success' },
  denied: { label: '权限不足', type: 'warning' },
  error: { label: '异常', type: 'danger' },
  unsupported: { label: '未支持', type: 'info' }
}

const getPermissionStatusLabel = (status: PermissionCheckStatus) => PERMISSION_STATUS_META[status]?.label || status || '-'
const getPermissionStatusTagType = (status: PermissionCheckStatus) => PERMISSION_STATUS_META[status]?.type || 'info'

const tabs = [
  { key: 'basic', label: '基本信息' },
  { key: 'config', label: '配置信息' },
  { key: 'assets', label: '关联资产' }
]

/** 云厂商展示名统一走 utils/constants 单源。原实现返回 config.name(小写 id),
 *  详情抽屉里显示的是 'aliyun' 而非「阿里云」,收敛后与其他页面一致 */
const getProviderName = (provider: string) => (provider ? getProviderLabel(provider) : '-')

const getProviderClass = (provider: string) => {
  return provider ? `provider-${provider}` : ''
}

const getStatusClass = (status: string) => {
  const map: Record<string, string> = {
    'active': 'status-active',
    'inactive': 'status-inactive',
    'disabled': 'status-disabled',
    'error': 'status-error'
  }
  return map[status] || ''
}

const getStatusLabel = (status: string) => {
  const map: Record<string, string> = {
    'active': '正常',
    'inactive': '未激活',
    'disabled': '已禁用',
    'error': '异常'
  }
  return map[status] || status || '-'
}

const getEnvClass = (env: string) => {
  const map: Record<string, string> = {
    'production': 'env-prod',
    'staging': 'env-staging',
    'development': 'env-dev',
    'testing': 'env-test'
  }
  return map[env] || ''
}

const getEnvironmentLabel = (env: string) => {
  const map: Record<string, string> = {
    'production': '生产环境',
    'staging': '预发环境',
    'development': '开发环境',
    'testing': '测试环境'
  }
  return map[env] || env || '-'
}

</script>

<style scoped lang="scss">
.account-detail-drawer {
  // 窄屏（≤768px）下 560px 固定宽度会超出视口，这里兜底限制占满可用宽度
  max-width: 100vw;

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

  .account-profile {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .account-avatar {
    width: 52px;
    height: 52px;
    border-radius: 14px;
    background: rgba(113, 112, 255, 0.15);
    display: flex;
    align-items: center;
    justify-content: center;

    &.provider-aliyun { background: rgba(255, 106, 0, 0.15); }
    &.provider-tencent { background: rgba(0, 82, 217, 0.15); }
    &.provider-aws { background: rgba(255, 153, 0, 0.15); }
    &.provider-huawei { background: rgba(207, 9, 32, 0.15); }
  }

  .account-basic {
    .account-name {
      font-size: 18px;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0 0 4px 0;
    }

    .account-provider {
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
  margin-bottom: 16px;

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
    &.status-error { background: var(--accent-yellow); }
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

  .env-badge {
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    background: var(--bg-surface);
    color: var(--text-secondary);

    &.env-prod {
      background: rgba(239, 68, 68, 0.15);
      color: var(--accent-red);
    }

    &.env-staging {
      background: rgba(245, 158, 11, 0.15);
      color: var(--accent-yellow);
    }

    &.env-dev {
      background: rgba(113, 112, 255, 0.15);
      color: var(--accent-blue);
    }

    &.env-test {
      background: rgba(16, 185, 129, 0.15);
      color: var(--accent-green);
    }
  }

  .asset-label {
    font-size: 14px;
    color: var(--text-secondary);
  }
}

.quick-actions {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;

  .quick-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 16px;
    background: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    border-radius: 10px;
    cursor: pointer;
    transition: all 200ms ease;
    color: var(--text-secondary);
    font-size: 14px;

    &:hover {
      background: var(--bg-hover);
      border-color: var(--border-strong);
      color: var(--text-primary);
    }

    // 操作进行中被禁用时给出可见反馈
    &:disabled {
      cursor: not-allowed;
      opacity: 0.6;
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

.permission-check {
  margin-top: 22px;
  padding-top: 18px;
  border-top: 1px solid var(--border-subtle);

  .pc-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 12px;
  }

  .pc-heading {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .pc-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .pc-time {
    font-size: 12px;
    color: var(--text-tertiary);
  }

  .pc-alert {
    margin-bottom: 12px;
  }

  .pc-summary {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 16px;
    margin-bottom: 12px;
    font-size: 13px;

    .is-ok { color: var(--accent-green); }
    .is-denied { color: var(--accent-yellow); }
    .is-error { color: var(--accent-red); }
    .is-unsupported { color: var(--text-tertiary); }
  }

  .pc-table {
    width: 100%;
  }

  .pc-empty {
    margin: 0;
    padding: 14px 16px;
    background: var(--bg-hover);
    border-radius: 8px;
    font-size: 13px;
    line-height: 1.6;
    color: var(--text-tertiary);
  }
}

@media (max-width: 768px) {
  .permission-check {
    .pc-header {
      flex-direction: column;
      align-items: stretch;

      .el-button { width: 100%; }
    }
  }
}

.config-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.config-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: 10px;

  .config-info {
    .config-name {
      display: block;
      font-size: 14px;
      font-weight: 500;
      color: var(--text-primary);
      margin-bottom: 2px;
    }

    .config-desc {
      font-size: 12px;
      color: var(--text-tertiary);
    }
  }

  .config-status {
    font-size: 13px;
    color: var(--text-muted);

    &.enabled {
      color: var(--accent-green);
    }
  }

  .config-value {
    font-size: 14px;
    color: var(--text-secondary);
  }
}

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
