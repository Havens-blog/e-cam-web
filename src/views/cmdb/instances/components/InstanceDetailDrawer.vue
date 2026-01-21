<template>
  <el-drawer
    :model-value="visible"
    title="实例详情"
    size="480px"
    :close-on-click-modal="true"
    class="detail-drawer"
    @update:model-value="$emit('update:visible', $event)"
  >
    <template v-if="instance">
      <div class="detail-content">
        <!-- 基本信息 -->
        <div class="detail-section">
          <div class="section-header">
            <div class="instance-avatar" :class="getStatusColorClass(instance.attributes?.status)">
              <el-icon :size="24"><Box /></el-icon>
            </div>
            <div class="instance-title">
              <h3>{{ instance.asset_name || instance.asset_id }}</h3>
              <span class="instance-id">{{ instance.asset_id }}</span>
            </div>
          </div>
        </div>

        <!-- 状态信息 -->
        <div class="detail-section">
          <h4 class="section-title">状态信息</h4>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">状态</span>
              <span class="info-value">
                <span class="status-dot" :class="getStatusClass(instance.attributes?.status)"></span>
                {{ instance.attributes?.status || '-' }}
              </span>
            </div>
            <div class="info-item">
              <span class="info-label">模型</span>
              <code class="info-code">{{ instance.uid }}</code>
            </div>
            <div class="info-item">
              <span class="info-label">租户</span>
              <span class="info-value">{{ instance.tenant_id }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">云账号ID</span>
              <span class="info-value">{{ instance.account_id || '-' }}</span>
            </div>
          </div>
        </div>

        <!-- 位置信息 -->
        <div class="detail-section" v-if="instance.attributes?.region || instance.attributes?.zone">
          <h4 class="section-title">位置信息</h4>
          <div class="info-grid">
            <div class="info-item" v-if="instance.attributes?.region">
              <span class="info-label">地域</span>
              <span class="info-value">{{ instance.attributes.region }}</span>
            </div>
            <div class="info-item" v-if="instance.attributes?.zone">
              <span class="info-label">可用区</span>
              <span class="info-value">{{ instance.attributes.zone }}</span>
            </div>
          </div>
        </div>

        <!-- 资源配置 -->
        <div class="detail-section" v-if="hasResourceConfig">
          <h4 class="section-title">资源配置</h4>
          <div class="info-grid">
            <div class="info-item" v-if="instance.attributes?.instance_type">
              <span class="info-label">实例类型</span>
              <span class="info-value">{{ instance.attributes.instance_type }}</span>
            </div>
            <div class="info-item" v-if="instance.attributes?.cpu">
              <span class="info-label">CPU</span>
              <span class="info-value">{{ instance.attributes.cpu }} 核</span>
            </div>
            <div class="info-item" v-if="instance.attributes?.memory">
              <span class="info-label">内存</span>
              <span class="info-value">{{ formatMemory(instance.attributes.memory) }}</span>
            </div>
          </div>
        </div>

        <!-- 网络信息 -->
        <div class="detail-section" v-if="hasNetworkInfo">
          <h4 class="section-title">网络信息</h4>
          <div class="info-grid">
            <div class="info-item" v-if="instance.attributes?.private_ip">
              <span class="info-label">内网IP</span>
              <code class="info-code">{{ instance.attributes.private_ip }}</code>
            </div>
            <div class="info-item" v-if="instance.attributes?.public_ip">
              <span class="info-label">公网IP</span>
              <code class="info-code">{{ instance.attributes.public_ip }}</code>
            </div>
          </div>
        </div>

        <!-- 其他属性 -->
        <div class="detail-section" v-if="otherAttributes.length > 0">
          <h4 class="section-title">其他属性</h4>
          <div class="attributes-list">
            <div class="attr-item" v-for="attr in otherAttributes" :key="attr.key">
              <span class="attr-key">{{ attr.key }}</span>
              <span class="attr-value">{{ formatAttrValue(attr.value) }}</span>
            </div>
          </div>
        </div>

        <!-- 时间信息 -->
        <div class="detail-section">
          <h4 class="section-title">时间信息</h4>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">创建时间</span>
              <span class="info-value">{{ formatTime(instance.create_time) }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">更新时间</span>
              <span class="info-value">{{ formatTime(instance.update_time) }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="drawer-footer">
        <el-button @click="$emit('update:visible', false)">关闭</el-button>
        <el-button type="primary" :disabled="!instance" @click="instance && $emit('edit', instance)">
          <el-icon><Edit /></el-icon>
          编辑
        </el-button>
        <el-button type="danger" plain :disabled="!instance" @click="instance && $emit('delete', instance)">
          <el-icon><Delete /></el-icon>
          删除
        </el-button>
      </div>
    </template>
  </el-drawer>
</template>

<script setup lang="ts">
import type { InstanceVO } from '@/api/types/cmdb';
import { Box, Delete, Edit } from '@element-plus/icons-vue';
import { computed } from 'vue';

const props = defineProps<{
  visible: boolean
  instance: InstanceVO | null
}>()

defineEmits<{
  'update:visible': [value: boolean]
  edit: [instance: InstanceVO]
  delete: [instance: InstanceVO]
}>()

// 已知属性键
const knownKeys = ['status', 'region', 'zone', 'instance_type', 'cpu', 'memory', 'private_ip', 'public_ip']

// 计算属性
const hasResourceConfig = computed(() => {
  const attrs = props.instance?.attributes
  return attrs?.instance_type || attrs?.cpu || attrs?.memory
})

const hasNetworkInfo = computed(() => {
  const attrs = props.instance?.attributes
  return attrs?.private_ip || attrs?.public_ip
})

const otherAttributes = computed(() => {
  if (!props.instance?.attributes) return []
  return Object.entries(props.instance.attributes)
    .filter(([key]) => !knownKeys.includes(key))
    .map(([key, value]) => ({ key, value }))
})

// 辅助函数
const getStatusClass = (status: string | undefined) => {
  if (!status) return ''
  const map: Record<string, string> = {
    Running: 'active',
    Stopped: 'inactive',
    Deleted: 'error',
  }
  return map[status] || ''
}

const getStatusColorClass = (status: string | undefined) => {
  if (!status) return 'blue'
  const map: Record<string, string> = {
    Running: 'green',
    Stopped: 'orange',
    Deleted: 'red',
  }
  return map[status] || 'blue'
}

const formatTime = (time: number | undefined) => {
  if (!time) return '-'
  return new Date(time).toLocaleString('zh-CN')
}

const formatMemory = (memory: number) => {
  if (memory >= 1024) {
    return `${(memory / 1024).toFixed(1)} GB`
  }
  return `${memory} MB`
}

const formatAttrValue = (value: any) => {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
</script>

<style scoped lang="scss">
.detail-content {
  padding: 0 4px;
}

.detail-section {
  margin-bottom: 24px;

  &:last-child {
    margin-bottom: 0;
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 20px;

    .instance-avatar {
      width: 56px;
      height: 56px;
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;

      &.blue { background: rgba(59, 130, 246, 0.15); color: var(--accent-blue); }
      &.green { background: rgba(16, 185, 129, 0.15); color: var(--accent-green); }
      &.orange { background: rgba(245, 158, 11, 0.15); color: var(--accent-yellow); }
      &.red { background: rgba(239, 68, 68, 0.15); color: var(--accent-red); }
    }

    .instance-title {
      h3 {
        font-size: 18px;
        font-weight: 600;
        color: var(--text-primary);
        margin: 0 0 4px 0;
      }

      .instance-id {
        font-size: 13px;
        color: var(--text-tertiary);
        font-family: var(--font-mono);
      }
    }
  }

  .section-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-tertiary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0 0 12px 0;
  }
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;

  .info-label {
    font-size: 12px;
    color: var(--text-muted);
  }

  .info-value {
    font-size: 14px;
    color: var(--text-primary);
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .info-code {
    font-size: 13px;
    font-family: var(--font-mono);
    color: var(--text-secondary);
    background: var(--bg-hover);
    padding: 4px 8px;
    border-radius: 6px;
  }
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-muted);

  &.active { background: var(--accent-green); }
  &.inactive { background: var(--accent-yellow); }
  &.error { background: var(--accent-red); }
}

.attributes-list {
  display: flex;
  flex-direction: column;
  gap: 8px;

  .attr-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 12px;
    background: var(--bg-hover);
    border-radius: 8px;

    .attr-key {
      font-size: 13px;
      color: var(--text-tertiary);
    }

    .attr-value {
      font-size: 13px;
      color: var(--text-primary);
      font-family: var(--font-mono);
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
}

.drawer-footer {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}
</style>
