<template>
  <el-drawer
    :model-value="visible"
    :with-header="false"
    size="50%"
    :close-on-click-modal="true"
    class="lb-detail-drawer"
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
                <el-icon :size="24"><SetUp /></el-icon>
              </div>
              <div class="instance-info">
                <div class="instance-type">{{ getLBTypeLabel(instance.attributes?.load_balancer_type) }}</div>
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
              <el-tab-pane label="监听器" name="listeners" />
              <el-tab-pane label="后端服务器" name="backends" />
              <el-tab-pane label="标签" name="tags" />
            </el-tabs>
          </div>
        </div>

        <div class="drawer-content">
          <template v-if="activeTab === 'detail'">
            <div class="detail-columns">
              <div class="detail-column">
                <div class="column-title">基本信息</div>
                <div class="info-list">
                  <div class="info-row">
                    <span class="info-label">实例ID</span>
                    <span class="info-value">{{ instance.asset_id }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">名称</span>
                    <span class="info-value">{{ instance.asset_name || '-' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">状态</span>
                    <span class="info-value">
                      <LbStatusBadge :status="instance.status" />
                    </span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">类型</span>
                    <span class="info-value">{{ getLBTypeLabel(instance.attributes?.load_balancer_type) }}</span>
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
                    <span class="info-label">可用区</span>
                    <span class="info-value">{{ instance.attributes?.zone || '-' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">规格</span>
                    <span class="info-value">{{ instance.attributes?.load_balancer_spec || '-' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">创建时间</span>
                    <span class="info-value">{{ instance.attributes?.creation_time || formatTime(instance.create_time) }}</span>
                  </div>
                </div>
              </div>

              <div class="detail-column">
                <div class="column-title">网络信息</div>
                <div class="info-list">
                  <div class="info-row">
                    <span class="info-label">VIP地址</span>
                    <span class="info-value mono">{{ instance.attributes?.address || '-' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">网络类型</span>
                    <span class="info-value">{{ instance.attributes?.address_type === 'internet' ? '公网' : '内网' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">IP版本</span>
                    <span class="info-value">{{ instance.attributes?.address_ip_version || 'ipv4' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">VPC</span>
                    <span class="info-value link">{{ instance.attributes?.vpc_id || '-' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">带宽</span>
                    <span class="info-value">{{ instance.attributes?.bandwidth ? instance.attributes.bandwidth + ' Mbps' : '-' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">计费方式</span>
                    <span class="info-value">{{ getChargeTypeLabel(instance.attributes?.internet_charge_type) }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">监听器数</span>
                    <span class="info-value">{{ instance.attributes?.listener_count || 0 }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">后端服务器</span>
                    <span class="info-value">{{ instance.attributes?.backend_server_count || 0 }}</span>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <template v-else-if="activeTab === 'tags'">
            <div v-if="tagList.length > 0" class="tags-container">
              <el-tag v-for="tag in tagList" :key="tag.key" size="default">
                {{ tag.key }}: {{ tag.value }}
              </el-tag>
            </div>
            <div v-else class="empty-tab">
              <el-icon :size="48"><PriceTag /></el-icon>
              <p>暂无标签</p>
            </div>
          </template>

          <template v-else>
            <div class="empty-tab">
              <el-icon :size="48"><Document /></el-icon>
              <p>{{ activeTab === 'listeners' ? '监听器' : '后端服务器' }} 功能开发中...</p>
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
import { Close, Document, PriceTag, Refresh, SetUp } from '@element-plus/icons-vue'
import { computed, ref } from 'vue'
import LbStatusBadge from './LbStatusBadge.vue'

const props = defineProps<{
  visible: boolean
  instance: Asset | null
}>()

defineEmits<{
  'update:visible': [value: boolean]
}>()

const activeTab = ref('detail')

const handleRefresh = () => {}

const getLBTypeLabel = (type: string | undefined) => {
  const map: Record<string, string> = { slb: 'SLB 传统负载均衡', alb: 'ALB 应用负载均衡', nlb: 'NLB 网络负载均衡' }
  return map[type || ''] || '负载均衡'
}

const getProviderName = (provider: string | undefined): string => {
  if (!provider) return '-'
  const p = provider.toLowerCase()
  if (p.includes('aliyun')) return '阿里云'
  if (p.includes('tencent')) return '腾讯云'
  if (p.includes('huawei')) return '华为云'
  if (p.includes('aws')) return 'AWS'
  if (p.includes('volc')) return '火山引擎'
  return provider
}

const getChargeTypeLabel = (type: string | undefined) => {
  const map: Record<string, string> = { PayByBandwidth: '按带宽', PayByTraffic: '按流量' }
  return map[type || ''] || type || '-'
}

const getRegionLabel = computed(() => {
  if (!props.instance) return '-'
  const config = PROVIDER_CONFIGS[props.instance.provider as keyof typeof PROVIDER_CONFIGS]
  const regionItem = config?.regions?.find((r: any) => r.value === props.instance?.region)
  return regionItem?.label || props.instance.region || '-'
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
  const ts = typeof time === 'number' ? time : parseInt(time)
  return new Date(ts).toLocaleString('zh-CN')
}
</script>

<style scoped lang="scss">
.drawer-wrapper { height: 100%; display: flex; flex-direction: column; }
.drawer-header-area { background: #f5f7fa; flex-shrink: 0; }
.drawer-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 20px; position: relative; }
.close-corner { position: absolute; top: 0; left: 0; width: 36px; height: 36px; cursor: pointer; z-index: 10;
  .corner-bg { position: absolute; top: 0; left: 0; width: 0; height: 0; border-style: solid; border-width: 36px 36px 0 0; border-color: #409eff transparent transparent transparent; transition: border-color 0.2s; }
  .corner-icon { position: absolute; top: 6px; left: 6px; color: #fff; }
  &:hover .corner-bg { border-color: #66b1ff transparent transparent transparent; }
}
.header-left { display: flex; align-items: center; gap: 12px; margin-left: 36px;
  .instance-icon { width: 40px; height: 40px; background: #fff; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #409eff; }
  .instance-info { .instance-type { font-size: 11px; color: #909399; margin-bottom: 2px; } .instance-name { font-size: 15px; font-weight: 600; color: #303133; display: flex; align-items: center; gap: 4px; } }
}
.drawer-tabs { padding: 0 20px; border-bottom: 1px solid #e4e7ed;
  :deep(.el-tabs) { .el-tabs__header { margin: 0; } .el-tabs__nav-wrap::after { display: none; } .el-tabs__item { height: 36px; line-height: 36px; font-size: 13px; } .el-tabs__active-bar { background-color: #409eff; height: 2px; } }
}
.drawer-content { padding: 24px 28px; flex: 1; overflow: auto; background: #fff; }
.detail-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; }
.detail-column { .column-title { font-size: 14px; font-weight: 600; color: #303133; margin-bottom: 16px; padding-bottom: 10px; border-bottom: 1px solid #ebeef5; } }
.info-list { display: flex; flex-direction: column; }
.info-row { display: flex; align-items: flex-start; padding: 8px 0; font-size: 13px; min-height: 34px;
  .info-label { width: 80px; flex-shrink: 0; color: #909399; line-height: 1.6; }
  .info-value { flex: 1; color: #303133; word-break: break-all; line-height: 1.6; &.link { color: #409eff; cursor: pointer; } &.mono { font-family: 'JetBrains Mono', monospace; font-size: 12px; } }
}
.tags-container { display: flex; flex-wrap: wrap; gap: 12px; }
.empty-tab { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 300px; color: #909399; p { margin-top: 16px; } }
</style>

<style lang="scss">
.lb-detail-drawer { .el-drawer__body { padding: 0; height: 100%; overflow: hidden; } }
</style>
