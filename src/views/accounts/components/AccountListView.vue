<template>
  <div class="accounts-list" v-loading="loading" :element-loading-text="loadingMessage">
    <div class="list-header">
      <div class="col-account">账号信息</div>
      <div class="col-provider">云平台</div>
      <div class="col-env">环境</div>
      <div class="col-status">状态</div>
      <div class="col-regions">区域</div>
      <div class="col-assets">资产</div>
      <div class="col-time">最近同步</div>
      <div class="col-actions">操作</div>
    </div>

    <TransitionGroup name="list">
      <div
        v-for="account in accounts"
        :key="account.id"
        class="account-item"
        @click="emit('view-detail', account)"
      >
        <div class="col-account">
          <div class="account-avatar" :class="getProviderClass(account.provider)">
            <ProviderIcon :provider="account.provider || ''" size="small" />
          </div>
          <div class="account-info">
            <div class="account-name">{{ account.name }}</div>
            <div class="account-key">{{ maskAccessKey(account.access_key_id) }}</div>
          </div>
        </div>
        <div class="col-provider">
          <span class="provider-name">{{ getProviderName(account.provider || '') }}</span>
        </div>
        <div class="col-env">
          <span class="env-badge" :class="getEnvClass(account.environment)">
            {{ getEnvironmentLabel(account.environment) }}
          </span>
        </div>
        <div class="col-status">
          <span class="status-dot" :class="getStatusClass(account.status)"></span>
          <span class="status-text">{{ getStatusLabel(account.status) }}</span>
        </div>
        <div class="col-regions">
          <template v-if="account.regions && account.regions.length > 0">
            <div class="regions-list">
              <span
                v-for="region in account.regions.slice(0, 2)"
                :key="region"
                class="region-tag"
              >
                {{ region }}
              </span>
              <span v-if="account.regions.length > 2" class="region-more">
                +{{ account.regions.length - 2 }}
              </span>
            </div>
          </template>
          <span v-else class="no-regions">{{ account.region || '-' }}</span>
        </div>
        <div class="col-assets">
          <span class="asset-count">{{ account.asset_count || 0 }}</span>
        </div>
        <div class="col-time">
          {{ formatSyncTime(account.last_sync_time) }}
        </div>
        <div class="col-actions" @click.stop>
          <el-dropdown trigger="click" :disabled="accountActionPending" @command="(cmd: string) => emit('action', cmd, account)">
            <button class="action-trigger">
              <el-icon><MoreFilled /></el-icon>
            </button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="view">
                  <el-icon><View /></el-icon>
                  查看详情
                </el-dropdown-item>
                <el-dropdown-item command="edit">
                  <el-icon><Edit /></el-icon>
                  编辑
                </el-dropdown-item>
                <el-dropdown-item command="test" divided>
                  <el-icon><Connection /></el-icon>
                  测试连接
                </el-dropdown-item>
                <el-dropdown-item command="sync">
                  <el-icon><Refresh /></el-icon>
                  同步资产
                </el-dropdown-item>
                <el-dropdown-item command="toggle" divided>
                  <el-icon><Switch /></el-icon>
                  {{ account.status === 'active' ? '禁用' : '启用' }}
                </el-dropdown-item>
                <el-dropdown-item command="delete">
                  <el-icon><Delete /></el-icon>
                  <span style="color: var(--accent-red)">删除</span>
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>
    </TransitionGroup>

    <div v-if="!loading && accounts.length === 0" class="empty-state">
      <div class="empty-icon">
        <el-icon :size="48"><Cloudy /></el-icon>
      </div>
      <div class="empty-title">{{ hasFilters ? '没有符合条件的账号' : '暂无云账号' }}</div>
      <div class="empty-desc">{{ hasFilters ? '尝试调整筛选条件' : '点击上方按钮添加第一个云账号' }}</div>
      <div class="empty-actions">
        <el-button v-if="hasFilters" @click="emit('clear-filters')">清除筛选</el-button>
        <el-button v-else type="primary" @click="emit('add')">
          <el-icon><Plus /></el-icon>
          添加账号
        </el-button>
      </div>
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
// 账号列表
.accounts-list {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 16px;
}

.list-header {
  display: flex;
  align-items: center;
  padding: 14px 20px;
  background: var(--bg-hover);
  border-bottom: 1px solid var(--border-subtle);
  font-size: 12px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;

  @media (max-width: 1200px) { display: none; }

  .col-account { flex: 2; min-width: 180px; }
  .col-provider { width: 140px; flex-shrink: 0; }
  .col-env { width: 80px; flex-shrink: 0; text-align: center; }
  .col-status { width: 80px; flex-shrink: 0; }
  .col-regions { width: 100px; flex-shrink: 0; }
  .col-assets { width: 60px; flex-shrink: 0; text-align: center; }
  .col-time { width: 100px; flex-shrink: 0; }
  .col-actions { width: 50px; flex-shrink: 0; text-align: center; }
}

.account-item {
  display: flex;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-subtle);
  cursor: pointer;
  transition: all 200ms ease;

  &:last-child { border-bottom: none; }
  &:hover { background: var(--bg-hover); }

  @media (max-width: 1200px) {
    flex-wrap: wrap;

    .col-account { flex: 1; min-width: 0; }
    .col-actions { flex-shrink: 0; }
    .col-provider, .col-env, .col-status, .col-regions, .col-assets, .col-time { display: none; }
  }
}

.col-account {
  flex: 2;
  min-width: 180px;
  display: flex;
  align-items: center;
  gap: 12px;

  .account-avatar {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    background: var(--bg-hover);

    &.provider-aliyun { background: rgba(255, 106, 0, 0.15); }
    &.provider-tencent { background: rgba(0, 122, 255, 0.15); }
    &.provider-aws { background: rgba(255, 153, 0, 0.15); }
    &.provider-huawei { background: rgba(207, 9, 32, 0.15); }
  }

  .account-info {
    min-width: 0;

    .account-name {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .account-key {
      font-size: 12px;
      color: var(--text-tertiary);
      font-family: var(--font-mono);
    }
  }
}

.col-provider {
  width: 140px;
  flex-shrink: 0;
  display: flex;
  align-items: center;

  .provider-name {
    font-size: 13px;
    color: var(--text-secondary);
  }
}

.col-env {
  width: 80px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;

  .env-badge {
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    background: var(--bg-hover);
    color: var(--text-secondary);

    &.env-prod { background: rgba(239, 68, 68, 0.15); color: var(--accent-red); }
    &.env-staging { background: rgba(245, 158, 11, 0.15); color: var(--accent-yellow); }
    &.env-dev { background: rgba(113, 112, 255, 0.15); color: var(--accent-blue); }
    &.env-test { background: rgba(139, 92, 246, 0.15); color: var(--accent-purple); }
  }
}

.col-status {
  width: 80px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--text-muted);

    &.status-active { background: var(--accent-green); }
    &.status-disabled { background: var(--text-tertiary); }
    &.status-error { background: var(--accent-red); }
    &.status-testing { background: var(--accent-blue); animation: pulse 1.5s infinite; }
    &.status-inactive { background: var(--text-muted); }
  }

  .status-text {
    font-size: 13px;
    color: var(--text-secondary);
  }
}

.col-regions {
  width: 100px;
  flex-shrink: 0;
  display: flex;
  align-items: center;

  .regions-list {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .region-tag {
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 11px;
    background: var(--bg-hover);
    color: var(--text-tertiary);
  }

  .region-more {
    font-size: 11px;
    color: var(--text-muted);
  }

  .no-regions {
    font-size: 13px;
    color: var(--text-muted);
  }
}

.col-assets {
  width: 60px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;

  .asset-count {
    font-size: 14px;
    font-weight: 600;
    color: var(--accent-blue);
  }
}

.col-time {
  width: 100px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  font-size: 13px;
  color: var(--text-tertiary);
}

.col-actions {
  width: 50px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;

  .action-trigger {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: transparent;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-tertiary);
    transition: all 200ms ease;

    &:hover {
      background: var(--bg-hover);
      color: var(--text-primary);
    }
  }
}

// 空状态
.empty-state {
  padding: 60px 20px;
  text-align: center;

  .empty-icon { color: var(--text-muted); margin-bottom: 16px; }
  .empty-title { font-size: 16px; font-weight: 600; color: var(--text-primary); margin-bottom: 8px; }
  .empty-desc { font-size: 14px; color: var(--text-tertiary); margin-bottom: 20px; }
  .empty-actions { display: flex; justify-content: center; gap: 12px; }
}

// 动画
.list-enter-active, .list-leave-active {
  transition: all 200ms ease;
}

.list-enter-from, .list-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
</style>
