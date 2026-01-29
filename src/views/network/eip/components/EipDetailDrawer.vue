<template>
  <el-drawer v-model="visible" size="55%" :destroy-on-close="false" class="eip-detail-drawer">
    <template #header>
      <div class="drawer-header">
        <div class="header-left">
          <el-tag size="small" type="info">EIP</el-tag>
          <span class="instance-name">{{ instance?.asset_name || '-' }}</span>
          <el-button link type="primary" size="small"><el-icon><Refresh /></el-icon></el-button>
        </div>
        <div class="header-actions">
          <el-dropdown trigger="click">
            <el-button type="primary" link>同步状态<el-icon class="el-icon--right"><ArrowDown /></el-icon></el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item>同步状态</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>
    </template>

    <el-tabs v-model="activeTab" class="detail-tabs">
      <el-tab-pane label="详情" name="detail">
        <div class="detail-content">
          <div class="info-section">
            <div class="section-title">基本信息</div>
            <div class="info-grid">
              <div class="info-item">
                <span class="label">云上ID</span>
                <span class="value">{{ instance?.asset_id || '-' }}</span>
              </div>
              <div class="info-item">
                <span class="label">ID</span>
                <span class="value">{{ instance?.id || '-' }}</span>
              </div>
              <div class="info-item">
                <span class="label">名称</span>
                <span class="value">{{ instance?.asset_name || '-' }}</span>
              </div>
              <div class="info-item">
                <span class="label">状态</span>
                <span class="value"><EipStatusBadge :status="instance?.status || ''" /></span>
              </div>
              <div class="info-item">
                <span class="label">IP地址</span>
                <span class="value mono">{{ instance?.attributes?.ip_address || '-' }}</span>
              </div>
              <div class="info-item">
                <span class="label">带宽</span>
                <span class="value">{{ instance?.attributes?.bandwidth ? instance.attributes.bandwidth + ' Mbps' : '-' }}</span>
              </div>
              <div class="info-item">
                <span class="label">平台</span>
                <span class="value"><ProviderIcon :provider="instance?.provider || ''" size="small" /></span>
              </div>
              <div class="info-item">
                <span class="label">计费方式</span>
                <span class="value">
                  <el-tag :type="instance?.attributes?.charge_type === 'Prepaid' ? 'warning' : 'info'" size="small">
                    {{ instance?.attributes?.charge_type === 'Prepaid' ? '包年包月' : '按量付费' }}
                  </el-tag>
                </span>
              </div>
              <div class="info-item">
                <span class="label">区域</span>
                <span class="value">{{ getRegionLabel }}</span>
              </div>
              <div class="info-item">
                <span class="label">云账号</span>
                <span class="value link">{{ instance?.attributes?.account_name || '-' }}</span>
              </div>
              <div class="info-item">
                <span class="label">创建时间</span>
                <span class="value">{{ formatTime(instance?.create_time) }}</span>
              </div>
              <div class="info-item">
                <span class="label">更新时间</span>
                <span class="value">{{ formatTime(instance?.update_time) }}</span>
              </div>
            </div>
          </div>

          <div class="info-section">
            <div class="section-title">绑定信息</div>
            <div class="info-grid">
              <div class="info-item">
                <span class="label">绑定实例ID</span>
                <span class="value link">{{ instance?.attributes?.instance_id || '-' }}</span>
              </div>
              <div class="info-item">
                <span class="label">实例类型</span>
                <span class="value">{{ getInstanceTypeLabel(instance?.attributes?.instance_type) }}</span>
              </div>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane label="标签" name="tags">
        <div class="tags-section">
          <div v-if="tagList.length > 0" class="tags-container">
            <el-tag v-for="tag in tagList" :key="tag.key" class="tag-item" size="default">{{ tag.key }}: {{ tag.value }}</el-tag>
          </div>
          <el-empty v-else description="暂无标签" />
        </div>
      </el-tab-pane>

      <el-tab-pane label="操作日志" name="logs">
        <el-empty description="操作日志功能开发中" />
      </el-tab-pane>
    </el-tabs>
  </el-drawer>
</template>

<script setup lang="ts">
import type { Asset } from '@/api/types/asset'
import ProviderIcon from '@/components/ProviderIcon.vue'
import { PROVIDER_CONFIGS } from '@/utils/constants'
import { ArrowDown, Refresh } from '@element-plus/icons-vue'
import { computed, ref } from 'vue'
import EipStatusBadge from './EipStatusBadge.vue'

const props = defineProps<{ visible: boolean; instance: Asset | null }>()
const emit = defineEmits<{ (e: 'update:visible', value: boolean): void }>()

const visible = computed({
  get: () => props.visible,
  set: (val) => emit('update:visible', val)
})

const activeTab = ref('detail')

const getRegionLabel = computed(() => {
  if (!props.instance) return '-'
  const config = PROVIDER_CONFIGS[props.instance.provider as keyof typeof PROVIDER_CONFIGS]
  const regionItem = config?.regions?.find((r: any) => r.value === props.instance?.region)
  return regionItem?.label || props.instance.region || '-'
})

const getInstanceTypeLabel = (type: string | undefined) => {
  const map: Record<string, string> = {
    EcsInstance: 'ECS实例', SlbInstance: '负载均衡', NatGateway: 'NAT网关',
    HaVip: '高可用VIP', NetworkInterface: '弹性网卡',
  }
  return map[type || ''] || type || '-'
}

const tagList = computed(() => {
  if (!props.instance?.attributes?.tags) return []
  const tags = props.instance.attributes.tags
  if (Array.isArray(tags)) return tags.map((tag: any) => ({ key: tag.key || tag.Key, value: tag.value || tag.Value }))
  if (typeof tags === 'object') return Object.entries(tags).map(([key, value]) => ({ key, value }))
  return []
})

const formatTime = (time: number | string | undefined) => {
  if (!time) return '-'
  return new Date(typeof time === 'number' ? time : parseInt(time)).toLocaleString('zh-CN')
}
</script>

<style scoped lang="scss">
.eip-detail-drawer {
  :deep(.el-drawer__header) { margin-bottom: 0; padding: 16px 20px; border-bottom: 1px solid var(--border-subtle); }
  :deep(.el-drawer__body) { padding: 0; }
}

.drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  
  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;
    .instance-name { font-size: 16px; font-weight: 600; color: var(--text-primary); }
  }
}

.detail-tabs {
  height: 100%;
  :deep(.el-tabs__header) { margin: 0; padding: 0 20px; background: var(--bg-elevated); border-bottom: 1px solid var(--border-subtle); }
  :deep(.el-tabs__content) { padding: 20px; height: calc(100% - 40px); overflow-y: auto; }
}

.detail-content { display: flex; flex-direction: column; gap: 24px; }

.info-section {
  .section-title {
    font-size: 15px; font-weight: 600; color: var(--text-primary);
    margin-bottom: 16px; padding-left: 12px; border-left: 3px solid var(--el-color-primary);
  }
  
  .info-grid {
    display: grid; grid-template-columns: repeat(2, 1fr);
    background: var(--bg-elevated); border: 1px solid var(--border-subtle); border-radius: 8px; overflow: hidden;
    
    .info-item {
      display: flex; padding: 12px 16px;
      border-bottom: 1px solid var(--border-subtle); border-right: 1px solid var(--border-subtle);
      &:nth-child(2n) { border-right: none; }
      &:nth-last-child(-n+2) { border-bottom: none; }
      
      .label { flex: 0 0 100px; font-size: 13px; color: var(--text-secondary); }
      .value {
        flex: 1; font-size: 13px; color: var(--text-primary);
        &.link { color: var(--el-color-primary); cursor: pointer; &:hover { text-decoration: underline; } }
        &.mono { font-family: 'JetBrains Mono', monospace; font-size: 12px; }
      }
    }
  }
}

.tags-section .tags-container { display: flex; flex-wrap: wrap; gap: 12px; }
</style>
