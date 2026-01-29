<template>
  <el-dialog
    :model-value="visible"
    title="确认解绑"
    width="420px"
    :close-on-click-modal="false"
    @update:model-value="$emit('update:visible', $event)"
  >
    <div class="dialog-content">
      <div class="icon-wrapper">
        <el-icon class="warning-icon"><WarningFilled /></el-icon>
      </div>
      <h3 class="title">确认解绑资源</h3>
      <p class="description">
        您确定要解绑以下资源吗？解绑后该资源将不再属于当前服务树节点。
      </p>
      
      <div v-if="resource" class="resource-card">
        <div class="resource-header">
          <span class="resource-name">{{ resource.resource_name || '未命名资源' }}</span>
          <el-tag :type="resource.resource_type === 'asset' ? 'primary' : 'success'" size="small">
            {{ resource.resource_type === 'asset' ? '云资产' : 'CMDB实例' }}
          </el-tag>
        </div>
        <div class="resource-details">
          <div v-if="resource.env_name" class="detail-item">
            <span class="detail-label">环境</span>
            <span class="detail-value">
              <span class="env-dot" :style="{ background: resource.env_color }"></span>
              {{ resource.env_name }}
            </span>
          </div>
          <div v-if="resource.provider" class="detail-item">
            <span class="detail-label">云平台</span>
            <span class="detail-value">{{ providerMap[resource.provider] || resource.provider }}</span>
          </div>
          <div v-if="resource.private_ip || resource.public_ip" class="detail-item">
            <span class="detail-label">IP地址</span>
            <span class="detail-value ip">{{ resource.private_ip || resource.public_ip }}</span>
          </div>
          <div v-if="resource.asset_type" class="detail-item">
            <span class="detail-label">资产类型</span>
            <span class="detail-value">{{ assetTypeMap[resource.asset_type] || resource.asset_type }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">绑定方式</span>
            <span class="detail-value">
              <el-tag :type="resource.bind_type === 'manual' ? 'info' : 'warning'" size="small">
                {{ resource.bind_type === 'manual' ? '手动绑定' : '规则绑定' }}
              </el-tag>
            </span>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="$emit('update:visible', false)">取消</el-button>
        <el-button type="danger" :loading="loading" @click="handleConfirm">
          <el-icon><Delete /></el-icon>
          确认解绑
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import type { ResourceBinding } from '@/api/types/service-tree';
import { Delete, WarningFilled } from '@element-plus/icons-vue';
import { ref } from 'vue';

defineProps<{
  visible: boolean
  resource: ResourceBinding | null
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  confirm: []
}>()

const loading = ref(false)

const assetTypeMap: Record<string, string> = {
  ecs: '云服务器',
  rds: '云数据库',
  oss: '对象存储',
  slb: '负载均衡',
  eip: '弹性IP',
  disk: '云硬盘',
  vpc: 'VPC'
}

const providerMap: Record<string, string> = {
  aliyun: '阿里云',
  aws: 'AWS',
  tencent: '腾讯云',
  huawei: '华为云',
  azure: 'Azure'
}

const handleConfirm = () => {
  emit('confirm')
}
</script>

<style scoped lang="scss">
.dialog-content {
  text-align: center;

  .icon-wrapper {
    width: 64px;
    height: 64px;
    margin: 0 auto 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(239, 68, 68, 0.05));
    border-radius: 50%;

    .warning-icon {
      font-size: 32px;
      color: #ef4444;
    }
  }

  .title {
    margin: 0 0 8px;
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .description {
    margin: 0 0 20px;
    font-size: 14px;
    color: var(--text-tertiary);
    line-height: 1.5;
  }

  .resource-card {
    background: var(--bg-hover);
    border: 1px solid var(--border-subtle);
    border-radius: 12px;
    padding: 16px;
    text-align: left;

    .resource-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--border-subtle);

      .resource-name {
        font-size: 15px;
        font-weight: 600;
        color: var(--text-primary);
      }
    }

    .resource-details {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;

      .detail-item {
        display: flex;
        flex-direction: column;
        gap: 4px;

        .detail-label {
          font-size: 12px;
          color: var(--text-muted);
        }

        .detail-value {
          font-size: 13px;
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          gap: 6px;

          &.ip {
            font-family: monospace;
            color: var(--accent-blue);
          }

          .env-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
          }
        }
      }
    }
  }
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
