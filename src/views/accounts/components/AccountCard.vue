<template>
  <el-card class="account-card" shadow="hover">
    <div class="card-header">
      <div class="account-info">
        <div class="account-name">{{ account.name }}</div>
        <el-tag :type="getProviderType(account.provider) as any" size="small">
          {{ getProviderLabel(account.provider) }}
        </el-tag>
        <el-tag :type="getEnvironmentType(account.environment) as any" size="small">
          {{ getEnvironmentLabel(account.environment) }}
        </el-tag>
      </div>
      <div class="account-actions">
        <el-button link size="small" @click="$emit('view', account)">
          详情
        </el-button>
        <el-button link size="small" @click="$emit('edit', account)">
          编辑
        </el-button>
        <el-button link type="danger" size="small" @click="$emit('delete', account)">
          删除
        </el-button>
      </div>
    </div>
    
    <div class="card-content">
      <div class="info-item">
        <span class="label">Access Key ID:</span>
        <span class="value">{{ account.access_key_id }}</span>
      </div>
      <div class="info-item">
        <span class="label">区域:</span>
        <span class="value">{{ account.region || '-' }}</span>
      </div>
      <div v-if="account.description" class="info-item">
        <span class="label">描述:</span>
        <span class="value">{{ account.description }}</span>
      </div>
      
      <!-- IAM 统计信息 -->
      <div class="iam-stats">
        <div class="stat-item">
          <el-icon><User /></el-icon>
          <span class="stat-label">用户:</span>
          <span class="stat-value">{{ account.user_count || 0 }}</span>
        </div>
        <div class="stat-item">
          <el-icon><UserFilled /></el-icon>
          <span class="stat-label">权限组:</span>
          <span class="stat-value">{{ account.group_count || 0 }}</span>
        </div>
        <el-button
          link
          type="primary"
          size="small"
          @click.stop="handleManageUsers"
        >
          <el-icon><Setting /></el-icon>
          管理用户
        </el-button>
      </div>
    </div>
    
    <div class="card-footer">
      <span class="create-time">创建于 {{ account.create_time }}</span>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import type { CloudAccount } from '@/api/types/account'
import { getEnvironmentLabel, getProviderLabel } from '@/utils/constants'
import { Setting, User, UserFilled } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'

interface Props {
  account: CloudAccount
}

interface Emits {
  (e: 'view', account: CloudAccount): void
  (e: 'edit', account: CloudAccount): void
  (e: 'delete', account: CloudAccount): void
}

const props = defineProps<Props>()
defineEmits<Emits>()

const router = useRouter()

// 管理用户
const handleManageUsers = () => {
  router.push({
    path: '/iam/users',
    query: { cloud_account_id: props.account.id }
  })
}

const getProviderType = (provider: string) => {
  const typeMap: Record<string, string> = {
    aliyun: 'warning',
    aws: 'danger',
    azure: 'primary',
    tencent: 'success',
    huawei: 'info'
  }
  return typeMap[provider] || 'info'
}

const getEnvironmentType = (environment: string) => {
  const typeMap: Record<string, string> = {
    production: 'danger',
    staging: 'warning',
    development: 'info',
    test: 'info'
  }
  return typeMap[environment] || 'info'
}
</script>

<style scoped lang="scss">
.account-card {
  margin-bottom: 16px;
  
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    
    .account-info {
      display: flex;
      align-items: center;
      gap: 8px;
      
      .account-name {
        font-size: 16px;
        font-weight: 600;
        color: #303133;
      }
    }
    
    .account-actions {
      display: flex;
      gap: 4px;
    }
  }
  
  .card-content {
    .info-item {
      display: flex;
      margin-bottom: 8px;
      font-size: 14px;
      
      .label {
        color: #909399;
        margin-right: 8px;
        min-width: 120px;
      }
      
      .value {
        color: #606266;
        flex: 1;
      }
    }
    
    .iam-stats {
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px solid #ebeef5;
      display: flex;
      align-items: center;
      gap: 16px;
      
      .stat-item {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 14px;
        
        .el-icon {
          color: #409eff;
        }
        
        .stat-label {
          color: #909399;
        }
        
        .stat-value {
          color: #303133;
          font-weight: 500;
        }
      }
    }
  }
  
  .card-footer {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid #ebeef5;
    
    .create-time {
      font-size: 12px;
      color: #909399;
    }
  }
}
</style>
