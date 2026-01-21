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
            <h3 class="account-name">{{ account?.name || '-' }}</h3>
            <p class="account-provider">{{ getProviderName(account?.provider || '') }}</p>
          </div>
        </div>
        <div class="header-actions">
          <el-button size="small" @click="account && $emit('edit', account)">
            <el-icon><Edit /></el-icon>
            编辑
          </el-button>
          <el-button size="small" type="danger" @click="account && $emit('delete', account)">
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
        <button class="quick-btn" @click="account && $emit('test', account)">
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
import type { CloudAccount } from '@/api/types/account'
import ProviderIcon from '@/components/ProviderIcon.vue'
import { PROVIDER_CONFIGS } from '@/utils/constants'
import { Box, Connection, Delete, Edit, Refresh } from '@element-plus/icons-vue'
import { ref } from 'vue'

defineProps<{
  visible: boolean
  account: CloudAccount | null
}>()

defineEmits<{
  'update:visible': [value: boolean]
  'edit': [account: CloudAccount]
  'delete': [account: CloudAccount]
  'test': [account: CloudAccount]
  'sync': [account: CloudAccount]
}>()

const activeTab = ref('basic')

const tabs = [
  { key: 'basic', label: '基本信息' },
  { key: 'config', label: '配置信息' },
  { key: 'assets', label: '关联资产' }
]

const getProviderName = (provider: string) => {
  const config = PROVIDER_CONFIGS[provider as keyof typeof PROVIDER_CONFIGS]
  return config?.name || provider || '-'
}

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

const formatDateTime = (time: string | undefined) => {
  if (!time) return '-'
  return new Date(time).toLocaleString('zh-CN')
}
</script>

<style scoped lang="scss">
.account-detail-drawer {
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
    background: rgba(59, 130, 246, 0.15);
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
      background: rgba(59, 130, 246, 0.15);
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
    background: var(--glass-bg);
    border: 1px solid var(--glass-border);
    border-radius: 10px;
    cursor: pointer;
    transition: all 200ms ease;
    color: var(--text-secondary);
    font-size: 14px;

    &:hover {
      background: var(--glass-bg-hover);
      border-color: var(--border-strong);
      color: var(--text-primary);
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
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
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
