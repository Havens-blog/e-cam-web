<template>
  <el-drawer
    :model-value="visible"
    :with-header="false"
    size="50%"
    :close-on-click-modal="true"
    class="image-detail-drawer"
    @update:model-value="$emit('update:visible', $event)"
  >
    <div class="drawer-wrapper">
      <template v-if="instance">
        <div class="drawer-header-area">
          <div class="drawer-header">
            <div class="close-corner" @click="$emit('update:visible', false)">
              <div class="corner-bg"></div>
              <el-icon class="corner-icon" :size="12"><Close /></el-icon>
            </div>
            <div class="header-left">
              <div class="instance-icon">
                <el-icon :size="24"><Picture /></el-icon>
              </div>
              <div class="instance-info">
                <div class="instance-type">镜像</div>
                <div class="instance-name">
                  {{ instance.asset_name || instance.asset_id }}
                  <el-button text size="small" @click="handleRefresh">
                    <el-icon><Refresh /></el-icon>
                  </el-button>
                </div>
              </div>
            </div>
          </div>
          <div class="drawer-tabs">
            <el-tabs v-model="activeTab">
              <el-tab-pane label="详情" name="detail" />
              <el-tab-pane label="磁盘映射" name="disks" />
              <el-tab-pane label="标签" name="tags" />
            </el-tabs>
          </div>
        </div>

        <div class="drawer-content">
          <!-- 详情 Tab -->
          <template v-if="activeTab === 'detail'">
            <div class="detail-columns">
              <div class="detail-column">
                <div class="column-title"><span class="title-bar"></span>基本信息</div>
                <div class="info-list">
                  <div class="info-row">
                    <span class="info-label">镜像ID</span>
                    <span class="info-value mono">{{ instance.asset_id }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">镜像名称</span>
                    <span class="info-value">{{ instance.asset_name || '-' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">状态</span>
                    <span class="info-value">
                      <ImageStatusBadge :status="instance.status" />
                    </span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">云平台</span>
                    <span class="info-value">
                      <ProviderIcon :provider="instance.provider" size="small" />
                      {{ getProviderName(instance.provider) }}
                    </span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">区域</span>
                    <span class="info-value">{{ getRegionLabel }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">镜像类型</span>
                    <span class="info-value">{{ getImageTypeLabel(instance.attributes?.image_owner_alias) }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">创建时间</span>
                    <span class="info-value">{{ instance.attributes?.creation_time || formatTime(instance.create_time) }}</span>
                  </div>
                </div>
              </div>
              <div class="detail-column">
                <div class="column-title"><span class="title-bar"></span>配置信息</div>
                <div class="info-list">
                  <div class="info-row">
                    <span class="info-label">操作系统</span>
                    <span class="info-value">{{ instance.attributes?.os_name || instance.attributes?.os_type || '-' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">平台</span>
                    <span class="info-value">{{ instance.attributes?.platform || '-' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">架构</span>
                    <span class="info-value">{{ instance.attributes?.architecture || '-' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">大小</span>
                    <span class="info-value">{{ instance.attributes?.size ? instance.attributes.size + ' GB' : '-' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">启动模式</span>
                    <span class="info-value">{{ instance.attributes?.boot_mode || '-' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">描述</span>
                    <span class="info-value">{{ instance.attributes?.description || '-' }}</span>
                  </div>
                </div>
              </div>
            </div>
            <div class="usage-section">
              <div class="column-title"><span class="title-bar"></span>使用信息</div>
              <div class="info-list horizontal">
                <div class="info-row">
                  <span class="info-label">关联实例数</span>
                  <span class="info-value">{{ instance.attributes?.instance_count ?? '-' }}</span>
                </div>
              </div>
            </div>
          </template>

          <!-- 磁盘映射 Tab -->
          <template v-else-if="activeTab === 'disks'">
            <div v-if="diskMappings.length > 0">
              <el-table :data="diskMappings" stripe style="width: 100%">
                <el-table-column label="设备名称" prop="device" min-width="120">
                  <template #default="{ row }">{{ row?.device || '-' }}</template>
                </el-table-column>
                <el-table-column label="磁盘类型" prop="type" width="100">
                  <template #default="{ row }">{{ row?.type || '-' }}</template>
                </el-table-column>
                <el-table-column label="大小(GB)" prop="size" width="100">
                  <template #default="{ row }">{{ row?.size ?? '-' }}</template>
                </el-table-column>
                <el-table-column label="快照ID" prop="snapshot_id" min-width="180" show-overflow-tooltip>
                  <template #default="{ row }">{{ row?.snapshot_id || '-' }}</template>
                </el-table-column>
                <el-table-column label="格式" prop="format" width="80">
                  <template #default="{ row }">{{ row?.format || '-' }}</template>
                </el-table-column>
              </el-table>
            </div>
            <div v-else class="empty-tab">
              <el-icon :size="48"><Coin /></el-icon>
              <p>暂无磁盘映射信息</p>
            </div>
          </template>

          <!-- 标签 Tab -->
          <template v-else-if="activeTab === 'tags'">
            <div v-if="tagList.length > 0" class="tags-container">
              <el-tag v-for="tag in tagList" :key="tag.key" class="tag-item-large" size="default">
                {{ tag.key }}: {{ tag.value }}
              </el-tag>
            </div>
            <div v-else class="empty-tab">
              <el-icon :size="48"><PriceTag /></el-icon>
              <p>暂无标签</p>
            </div>
          </template>
        </div>
      </template>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import type { Asset } from '@/api/types/asset'
import ProviderIcon from '@/components/ProviderIcon.vue'
import { PROVIDER_CONFIGS } from '@/utils/constants'
import { Close, Coin, Picture, PriceTag, Refresh } from '@element-plus/icons-vue'
import { computed, ref } from 'vue'
import ImageStatusBadge from './ImageStatusBadge.vue'

const props = defineProps<{
  visible: boolean
  instance: Asset | null
}>()

defineEmits<{ 'update:visible': [value: boolean] }>()

const activeTab = ref('detail')

const handleRefresh = () => {}

const getProviderName = (provider: string | undefined): string => {
  if (!provider) return '-'
  const p = provider.toLowerCase()
  if (p.includes('aliyun') || p.includes('alibaba')) return '阿里云'
  if (p.includes('tencent') || p.includes('qcloud')) return '腾讯云'
  if (p.includes('huawei')) return '华为云'
  if (p.includes('aws') || p.includes('amazon')) return 'AWS'
  if (p.includes('volcengine') || p.includes('volc')) return '火山引擎'
  return provider
}

const getImageTypeLabel = (alias: string | undefined): string => {
  const map: Record<string, string> = {
    system: '公共镜像',
    self: '自定义镜像',
    others: '共享镜像',
    marketplace: '市场镜像',
  }
  return map[alias || ''] || alias || '-'
}

const getRegionLabel = computed(() => {
  if (!props.instance) return '-'
  const config = PROVIDER_CONFIGS[props.instance.provider as keyof typeof PROVIDER_CONFIGS]
  const regionItem = config?.regions?.find((r: any) => r.value === props.instance?.region)
  return regionItem?.label || props.instance.region || '-'
})

const diskMappings = computed(() => {
  const mappings = props.instance?.attributes?.disk_device_mappings
  if (Array.isArray(mappings)) return mappings.filter((m: any) => m != null)
  return []
})

const tagList = computed(() => {
  if (!props.instance?.attributes?.tags) return []
  const tags = props.instance.attributes.tags
  if (typeof tags === 'object' && !Array.isArray(tags)) {
    return Object.entries(tags).map(([key, value]) => ({ key, value }))
  }
  return []
})

const formatTime = (time: number | string | undefined) => {
  if (!time) return '-'
  if (typeof time === 'string' && time.includes('-')) return time
  const ts = typeof time === 'number' ? time : parseInt(time)
  if (isNaN(ts)) return time as string
  return new Date(ts).toLocaleString('zh-CN')
}
</script>

<style scoped lang="scss">
.drawer-wrapper { height: 100%; display: flex; flex-direction: column; }
.drawer-header-area { background: var(--el-bg-color-page); flex-shrink: 0; }
.drawer-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 20px; position: relative;
}
.close-corner {
  position: absolute; top: 0; left: 0; width: 36px; height: 36px; cursor: pointer; z-index: 10;
  .corner-bg {
    position: absolute; top: 0; left: 0; width: 0; height: 0;
    border-style: solid; border-width: 36px 36px 0 0;
    border-color: var(--el-color-primary) transparent transparent transparent; transition: border-color 0.2s;
  }
  .corner-icon { position: absolute; top: 6px; left: 6px; color: #fff; }
  &:hover .corner-bg { border-color: var(--el-color-primary-light-3) transparent transparent transparent; }
}
.header-left {
  display: flex; align-items: center; gap: 12px; margin-left: 36px;
  .instance-icon {
    width: 44px; height: 44px; background: var(--el-color-primary-light-9); border-radius: 10px;
    display: flex; align-items: center; justify-content: center; color: var(--el-color-primary);
  }
  .instance-info {
    .instance-type { font-size: 11px; color: var(--text-tertiary); margin-bottom: 2px; }
    .instance-name {
      font-size: 15px; font-weight: 600; color: var(--text-primary);
      display: flex; align-items: center; gap: 4px;
    }
  }
}
.drawer-tabs {
  padding: 0 20px; border-bottom: 1px solid var(--border-subtle);
  :deep(.el-tabs) {
    .el-tabs__header { margin: 0; }
    .el-tabs__nav-wrap::after { display: none; }
    .el-tabs__item { height: 38px; line-height: 38px; font-size: 13px; }
    .el-tabs__active-bar { height: 2px; }
  }
}
.drawer-content { padding: 24px 28px; flex: 1; overflow: auto; }
.detail-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }

.column-title {
  font-size: 14px; font-weight: 600; color: var(--text-primary);
  margin-bottom: 16px; padding-bottom: 10px; border-bottom: 1px solid var(--border-subtle);
  display: flex; align-items: center; gap: 8px;

  .title-bar {
    width: 3px; height: 16px; border-radius: 2px;
    background: linear-gradient(180deg, var(--el-color-primary), var(--el-color-primary-light-5));
  }
}
.usage-section {
  margin-top: 32px;
}
.info-list { display: flex; flex-direction: column;
  &.horizontal { flex-direction: row; gap: 48px; }
}
.info-row {
  display: flex; align-items: flex-start; padding: 8px 0; font-size: 13px; min-height: 34px;
  border-bottom: 1px solid var(--el-border-color-extra-light);
  &:last-child { border-bottom: none; }
  .info-label { width: 80px; flex-shrink: 0; color: var(--text-tertiary); line-height: 1.6; }
  .info-value {
    flex: 1; color: var(--text-primary); word-break: break-all;
    display: flex; align-items: center; gap: 6px; line-height: 1.6;
    &.mono { font-family: 'SF Mono', 'Fira Code', monospace; font-size: 12px; color: var(--text-secondary); }
  }
}
.tags-container { display: flex; flex-wrap: wrap; gap: 12px; .tag-item-large { font-size: 13px; } }
.empty-tab {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  height: 300px; color: var(--text-tertiary); p { margin-top: 16px; }
}
</style>

<style lang="scss">
.image-detail-drawer {
  .el-drawer__body { padding: 0; height: 100%; overflow: hidden; }
}
</style>
