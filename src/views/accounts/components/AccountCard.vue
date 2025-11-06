<template>
  <el-card class="account-card" :class="`status-${account.status}`">
    <div class="card-header">
      <div class="provider-info">
        <div class="provider-icon">
          <ProviderIcon :provider="account.provider" size="large" />
        </div>
        <div class="account-info">
          <h3 class="account-name">{{ account.name }}</h3>
          <p class="account-meta">
            {{ getProviderLabel(account.provider) }} - {{ account.region }}
          </p>
        </div>
      </div>
      <el-tag :type="(getAccountStatus(account.status).color as any)" size="small">
        {{ getAccountStatus(account.status).label }}
      </el-tag>
    </div>

    <div class="card-body">
      <div class="info-row">
        <span class="label">环境:</span>
        <EnvironmentTag :environment="account.environment" size="small" />
      </div>
      <div class="info-row">
        <span class="label">Access Key:</span>
        <span class="value">{{ maskAccessKey(account.access_key_id) }}</span>
      </div>
      <div class="info-row">
        <span class="label">资产数量:</span>
        <span class="value">{{ account.asset_count }}</span>
      </div>
      <div class="info-row">
        <span class="label">最后同步:</span>
        <span class="value">{{ formatRelativeTime(account.last_sync_time) }}</span>
      </div>
      <div v-if="account.description" class="info-row">
        <span class="label">描述:</span>
        <span class="value">{{ account.description }}</span>
      </div>
    </div>

    <div class="card-footer">
      <el-button size="small" @click="handleTest">
        <el-icon><Connection /></el-icon>
        测试连接
      </el-button>
      <el-button size="small" type="primary" @click="handleSync">
        <el-icon><Refresh /></el-icon>
        同步资产
      </el-button>
      <el-dropdown @command="handleCommand">
        <el-button size="small">
          更多
          <el-icon class="el-icon--right"><ArrowDown /></el-icon>
        </el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="edit">
              <el-icon><Edit /></el-icon>
              编辑
            </el-dropdown-item>
            <el-dropdown-item command="toggle">
              <el-icon v-if="account.status === 'active'"><Lock /></el-icon>
              <el-icon v-else><Unlock /></el-icon>
              {{ account.status === 'active' ? '禁用' : '启用' }}
            </el-dropdown-item>
            <el-dropdown-item command="delete" divided>
              <el-icon><Delete /></el-icon>
              删除
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import type { CloudAccount } from '@/api/types/account'
import EnvironmentTag from '@/components/EnvironmentTag.vue'
import ProviderIcon from '@/components/ProviderIcon.vue'
import { getAccountStatus, getProviderLabel } from '@/utils/constants'
import { formatRelativeTime, maskAccessKey } from '@/utils/formatters'
import {
    ArrowDown,
    Connection,
    Delete,
    Edit,
    Lock,
    Refresh,
    Unlock,
} from '@element-plus/icons-vue'

interface Props {
  account: CloudAccount
}

interface Emits {
  (e: 'edit', account: CloudAccount): void
  (e: 'delete', account: CloudAccount): void
  (e: 'test', account: CloudAccount): void
  (e: 'sync', account: CloudAccount): void
  (e: 'toggle-status', account: CloudAccount): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const handleTest = () => {
  emit('test', props.account)
}

const handleSync = () => {
  emit('sync', props.account)
}

const handleCommand = (command: string) => {
  switch (command) {
    case 'edit':
      emit('edit', props.account)
      break
    case 'toggle':
      emit('toggle-status', props.account)
      break
    case 'delete':
      emit('delete', props.account)
      break
  }
}
</script>

<style scoped lang="scss">
.account-card {
  height: 100%;
  transition: all 0.3s ease;

  &:hover {
    box-shadow:
      0 10px 15px -3px rgba(0, 0, 0, 0.1),
      0 4px 6px -2px rgba(0, 0, 0, 0.05);
    transform: translateY(-2px);
  }

  &.status-error {
    border-left: 4px solid #ef4444;
  }

  &.status-disabled {
    opacity: 0.7;
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: calc(1rem + 0.2vw);

    .provider-info {
      display: flex;
      gap: calc(0.8rem + 0.2vw);
      align-items: center;
      flex: 1;

      .provider-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: calc(2.5rem + 0.5vw);
        height: calc(2.5rem + 0.5vw);
        border-radius: calc(0.4rem + 0.1vw);
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
      }

      .account-info {
        flex: 1;
        min-width: 0;

        .account-name {
          margin: 0;
          font-size: calc(0.9rem + 0.2vw);
          font-weight: 600;
          color: #1f2937;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .account-meta {
          margin: calc(0.2rem + 0.05vw) 0 0;
          font-size: calc(0.7rem + 0.1vw);
          color: #6b7280;
        }
      }
    }
  }

  .card-body {
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: calc(0.4rem + 0.1vw) 0;
      border-bottom: 1px solid #f3f4f6;
      font-size: calc(0.7rem + 0.1vw);

      &:last-child {
        border-bottom: none;
      }

      .label {
        color: #6b7280;
        font-weight: 500;
      }

      .value {
        color: #1f2937;
        font-weight: 400;
        text-align: right;
        max-width: 60%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
  }

  .card-footer {
    display: flex;
    gap: calc(0.5rem + 0.1vw);
    margin-top: calc(1rem + 0.2vw);
    padding-top: calc(1rem + 0.2vw);
    border-top: 1px solid #f3f4f6;

    .el-button {
      flex: 1;
    }

    .el-dropdown {
      .el-button {
        flex: initial;
      }
    }
  }
}
</style>
