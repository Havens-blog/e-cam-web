<template>
  <div v-loading="loading" :element-loading-text="loadingMessage">
    <div v-if="accounts.length > 0" class="accounts-grid">
      <div
        v-for="account in accounts"
        :key="account.id"
        class="account-card"
        @click="emit('view-detail', account)"
      >
        <div class="card-accent" :class="getProviderAccentClass(account.provider)" />
        <div class="card-body">
          <div class="card-top">
            <div class="card-top-left">
              <div class="card-avatar" :class="getProviderClass(account.provider)">
                <ProviderIcon :provider="account.provider || ''" size="small" />
              </div>
              <div>
                <div class="card-name">{{ account.name }}</div>
                <div class="card-provider-label">{{ getProviderName(account.provider || '') }}</div>
              </div>
            </div>
            <span class="card-status" :class="getStatusClass(account.status)">
              <span class="dot" />
              {{ getStatusLabel(account.status) }}
            </span>
          </div>

          <div class="card-desc">{{ account.description || getProviderName(account.provider || '') + ' · ' + getEnvironmentLabel(account.environment) }}</div>

          <div class="card-meta">
            <div class="meta-item">
              <span class="meta-label">Access Key</span>
              <span class="meta-value mono">{{ maskAccessKey(account.access_key_id) }}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">环境</span>
              <span class="meta-value">
                <span class="env-badge" :class="getEnvClass(account.environment)">
                  {{ getEnvironmentLabel(account.environment) }}
                </span>
              </span>
            </div>
            <div class="meta-item">
              <span class="meta-label">月费用</span>
              <span class="meta-value" style="color: var(--accent-yellow)">-</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">最近同步</span>
              <span class="meta-value">{{ formatSyncTime(account.last_sync_time) }}</span>
            </div>
          </div>

          <div v-if="account.regions && account.regions.length > 0" class="card-regions">
            <span
              v-for="region in account.regions.slice(0, 3)"
              :key="region"
              class="region-chip"
            >{{ region }}</span>
            <span v-if="account.regions.length > 3" class="region-chip more">+{{ account.regions.length - 3 }}</span>
          </div>

          <div class="card-footer">
            <div class="card-footer-left">
              <span class="card-asset-tag">资产 <strong>{{ account.asset_count || 0 }}</strong></span>
            </div>
            <div class="card-footer-right" @click.stop>
              <el-dropdown trigger="click" :disabled="accountActionPending" @command="(cmd: string) => emit('action', cmd, account)">
                <button class="card-action-btn">
                  <el-icon><MoreFilled /></el-icon>
                </button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="view"><el-icon><View /></el-icon>查看详情</el-dropdown-item>
                    <el-dropdown-item command="edit"><el-icon><Edit /></el-icon>编辑</el-dropdown-item>
                    <el-dropdown-item command="test" divided><el-icon><Connection /></el-icon>测试连接</el-dropdown-item>
                    <el-dropdown-item command="sync"><el-icon><Refresh /></el-icon>同步资产</el-dropdown-item>
                    <el-dropdown-item command="toggle" divided><el-icon><Switch /></el-icon>{{ account.status === 'active' ? '禁用' : '启用' }}</el-dropdown-item>
                    <el-dropdown-item command="delete"><el-icon><Delete /></el-icon><span style="color: var(--accent-red)">删除</span></el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="!loading && accounts.length === 0" class="empty-state-card">
      <el-icon :size="48" color="var(--text-muted)"><Cloudy /></el-icon>
      <div class="empty-title">{{ hasFilters ? '没有符合条件的账号' : '暂无云账号' }}</div>
      <div class="empty-desc">{{ hasFilters ? '尝试调整筛选条件' : '点击上方按钮添加第一个云账号' }}</div>
      <el-button v-if="hasFilters" @click="emit('clear-filters')">清除筛选</el-button>
      <el-button v-else type="primary" @click="emit('add')"><el-icon><Plus /></el-icon>添加账号</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CloudAccount } from '@/api/types/account'
import { ProviderIcon } from '@haven/ui/ProviderIcon'
import {
  Cloudy,
  Connection,
  Delete,
  Edit,
  MoreFilled,
  Plus,
  Refresh,
  Switch,
  View
} from '@element-plus/icons-vue'
import {
  formatSyncTime,
  getEnvClass,
  getEnvironmentLabel,
  getProviderAccentClass,
  getProviderClass,
  getProviderName,
  getStatusClass,
  getStatusLabel,
  maskAccessKey
} from '../utils'

defineProps<{
  accounts: CloudAccount[]
  loading: boolean
  loadingMessage: string
  hasFilters: boolean
  accountActionPending: boolean
}>()

const emit = defineEmits<{
  'view-detail': [account: CloudAccount]
  'action': [command: string, account: CloudAccount]
  'add': []
  'clear-filters': []
}>()
</script>

<style scoped lang="scss">
.accounts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

.account-card {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: all 200ms ease;

  &:hover {
    border-color: var(--border-strong);
    transform: translateY(-2px);
    box-shadow: var(--shadow-lg);
  }
}

.card-accent {
  height: 3px;
  width: 100%;

  &.accent-aliyun { background: linear-gradient(90deg, #ff6a00, #ff9500); }
  &.accent-aws { background: linear-gradient(90deg, #ff9900, #ffb84d); }
  &.accent-tencent { background: linear-gradient(90deg, #0052d9, #4d8fff); }
  &.accent-huawei { background: linear-gradient(90deg, #cf000f, #ff4d4d); }
  &.accent-azure { background: linear-gradient(90deg, #0078d4, #50a0e6); }
}

.card-body {
  padding: 18px 20px 16px;
}

.card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 10px;
}

.card-top-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.card-avatar {
  width: 42px;
  height: 42px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: var(--bg-hover);

  &.provider-aliyun { background: rgba(255, 106, 0, 0.12); }
  &.provider-aws { background: rgba(255, 153, 0, 0.12); }
  &.provider-tencent { background: rgba(0, 82, 217, 0.12); }
  &.provider-huawei { background: rgba(207, 0, 15, 0.12); }
  &.provider-azure { background: rgba(0, 120, 212, 0.12); }
}

.card-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 2px;
}

.card-provider-label {
  font-size: 11px;
  color: var(--text-tertiary);
}

.card-status {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 20px;
  flex-shrink: 0;

  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  &.status-active { background: rgba(16, 185, 129, 0.1); color: var(--accent-green); .dot { background: var(--accent-green); } }
  &.status-error { background: rgba(239, 68, 68, 0.1); color: var(--accent-red); .dot { background: var(--accent-red); } }
  &.status-disabled { background: rgba(255, 255, 255, 0.05); color: var(--text-tertiary); .dot { background: var(--text-tertiary); } }
  &.status-testing { background: rgba(113, 112, 255, 0.1); color: var(--accent-blue); .dot { background: var(--accent-blue); } }
  &.status-inactive { background: rgba(255, 255, 255, 0.05); color: var(--text-muted); .dot { background: var(--text-muted); } }
}

.card-desc {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-bottom: 14px;
  line-height: 1.5;
  min-height: 18px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-meta {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 14px;
}

.meta-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
  background: var(--bg-hover);
  border-radius: 6px;
  border: 1px solid var(--border-subtle);

  .meta-label {
    font-size: 10px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .meta-value {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary);

    &.mono {
      font-family: var(--font-mono);
      font-size: 11.5px;
    }
  }
}

.card-regions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}

.region-chip {
  font-size: 10px;
  padding: 2px 7px;
  border-radius: 4px;
  background: var(--bg-hover);
  color: var(--text-tertiary);
  border: 1px solid var(--border-subtle);

  &.more {
    color: var(--text-muted);
  }
}

.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 12px;
  border-top: 1px solid var(--border-subtle);
}

.card-footer-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.card-asset-tag {
  font-size: 12px;
  color: var(--text-tertiary);

  strong {
    color: var(--accent-blue);
    font-weight: 600;
    font-size: 14px;
  }
}

.card-footer-right {
  display: flex;
  gap: 4px;
}

.card-action-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-tertiary);
  background: transparent;
  border: none;
  transition: all 150ms ease;
  padding: 0;

  &:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }
}

.empty-state-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  gap: 12px;

  .empty-title { font-size: 16px; font-weight: 600; color: var(--text-primary); }
  .empty-desc { font-size: 14px; color: var(--text-tertiary); margin-bottom: 8px; }
}
</style>
