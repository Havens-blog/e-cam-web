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
                <div class="instance-type">{{ getLBTypeLabel(attr.load_balancer_type) }}</div>
                <div class="instance-name">{{ instance.asset_name || instance.asset_id }}</div>
              </div>
            </div>
          </div>

          <div class="drawer-tabs">
            <el-tabs v-model="activeTab">
              <el-tab-pane label="详情" name="detail" />
              <el-tab-pane name="listeners">
                <template #label>
                  监听器
                  <span v-if="listeners.length" class="tab-badge">{{ listeners.length }}</span>
                </template>
              </el-tab-pane>
              <el-tab-pane name="backends">
                <template #label>
                  后端服务器
                  <span v-if="backendServers.length" class="tab-badge">{{ backendServers.length }}</span>
                </template>
              </el-tab-pane>
              <el-tab-pane label="标签" name="tags" />
            </el-tabs>
          </div>
        </div>

        <div class="drawer-content">
          <!-- 详情 Tab -->
          <template v-if="activeTab === 'detail'">
            <div class="detail-columns">
              <div class="detail-column">
                <div class="column-title">基本信息</div>
                <div class="info-list">
                  <div class="info-row">
                    <span class="info-label">实例ID</span>
                    <span class="info-value mono">{{ instance.asset_id }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">名称</span>
                    <span class="info-value">{{ instance.asset_name || '-' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">状态</span>
                    <span class="info-value"><LbStatusBadge :status="instance.status" /></span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">类型</span>
                    <span class="info-value">{{ getLBTypeLabel(attr.load_balancer_type) }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">规格</span>
                    <span class="info-value">{{ attr.load_balancer_edition || attr.load_balancer_spec || '-' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">云平台</span>
                    <span class="info-value">
                      <div class="provider-inline">
                        <ProviderIcon :provider="instance.provider" size="small" />
                        <span>{{ getProviderName(instance.provider) }}</span>
                      </div>
                    </span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">云账号</span>
                    <span class="info-value">{{ attr.cloud_account_name || '-' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">区域</span>
                    <span class="info-value">{{ regionLabel }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">可用区</span>
                    <span class="info-value">{{ attr.zone || '-' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">备注</span>
                    <span class="info-value">{{ attr.description || '-' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">创建时间</span>
                    <span class="info-value">{{ formatTime(attr.creation_time) }}</span>
                  </div>
                </div>
              </div>

              <div class="detail-column">
                <div class="column-title">网络信息</div>
                <div class="info-list">
                  <div class="info-row">
                    <span class="info-label">VIP地址</span>
                    <span class="info-value mono">{{ attr.address || attr.vip || '-' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">网络类型</span>
                    <span class="info-value">
                      <el-tag size="small" :type="isPublicNetwork ? 'danger' : 'info'" effect="plain">
                        {{ isPublicNetwork ? '公网' : '内网' }}
                      </el-tag>
                    </span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">IP版本</span>
                    <span class="info-value">{{ attr.address_ip_version || 'IPv4' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">VPC</span>
                    <span class="info-value mono">{{ attr.vpc_id || '-' }}</span>
                  </div>
                  <div class="info-row" v-if="attr.vpc_name">
                    <span class="info-label">VPC名称</span>
                    <span class="info-value">{{ attr.vpc_name }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">交换机</span>
                    <span class="info-value mono">{{ attr.vswitch_id || '-' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">带宽</span>
                    <span class="info-value">{{ attr.bandwidth ? attr.bandwidth + ' Mbps' : '-' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">计费方式</span>
                    <span class="info-value">{{ getChargeTypeLabel(attr.internet_charge_type || attr.charge_type) }}</span>
                  </div>
                </div>

                <div class="column-title" style="margin-top: 24px">关联资源</div>
                <div class="info-list">
                  <div class="info-row">
                    <span class="info-label">监听器</span>
                    <span class="info-value">
                      <span class="highlight-num">{{ attr.listener_count || listeners.length }}</span> 个
                    </span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">后端服务器</span>
                    <span class="info-value">
                      <span class="highlight-num">{{ attr.backend_server_count || backendServers.length }}</span> 台
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <!-- 监听器 Tab -->
          <template v-else-if="activeTab === 'listeners'">
            <div v-if="listeners.length > 0" class="tab-section">
              <div class="section-summary">
                <span class="summary-text">
                  共 <strong>{{ listeners.length }}</strong> 个监听器
                </span>
              </div>
              <el-table :data="listeners" style="width: 100%" border>
                <el-table-column label="监听器ID" min-width="220" show-overflow-tooltip>
                  <template #default="{ row }">
                    <span class="mono">{{ row.listenerid || row.listener_id || '-' }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="协议" width="90" align="center">
                  <template #default="{ row }">
                    <el-tag
                      size="small"
                      :type="getProtocolTagType(row.listenerprotocol || row.protocol)"
                      effect="plain"
                    >
                      {{ row.listenerprotocol || row.protocol || '-' }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="前端端口" width="90" align="center">
                  <template #default="{ row }">
                    <span class="port-text">{{ row.listenerport || row.listener_port || '-' }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="后端端口" width="90" align="center">
                  <template #default="{ row }">
                    <span class="port-text">{{ row.backendport || row.backend_port || '-' }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="带宽" width="90" align="center">
                  <template #default="{ row }">
                    {{ row.bandwidth ? row.bandwidth + ' Mbps' : '-' }}
                  </template>
                </el-table-column>
                <el-table-column label="状态" width="90" align="center">
                  <template #default="{ row }">
                    <LbStatusBadge :status="row.status || 'Active'" />
                  </template>
                </el-table-column>
                <el-table-column label="描述" min-width="120" show-overflow-tooltip>
                  <template #default="{ row }">
                    {{ row.description || '-' }}
                  </template>
                </el-table-column>
              </el-table>
            </div>
            <div v-else class="empty-tab">
              <el-icon :size="48"><Headset /></el-icon>
              <p>暂无监听器信息</p>
              <p class="empty-hint">同步数据后将在此展示监听器列表</p>
            </div>
          </template>

          <!-- 后端服务器 Tab -->
          <template v-else-if="activeTab === 'backends'">
            <div v-if="backendServers.length > 0" class="tab-section">
              <div class="section-summary">
                <span class="summary-text">
                  共 <strong>{{ backendServers.length }}</strong> 台后端服务器
                </span>
              </div>
              <el-table :data="backendServers" style="width: 100%" border>
                <el-table-column label="服务器ID" min-width="220" show-overflow-tooltip>
                  <template #default="{ row }">
                    <span class="mono">{{ row.serverid || row.server_id || row.ServerId || '-' }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="服务器名称" min-width="160" show-overflow-tooltip>
                  <template #default="{ row }">
                    {{ row.servername || row.server_name || row.ServerName || '-' }}
                  </template>
                </el-table-column>
                <el-table-column label="IP地址" min-width="140" show-overflow-tooltip>
                  <template #default="{ row }">
                    <span class="mono">{{ row.serverip || row.server_ip || row.ServerIp || row.ip || row.private_ip || row.private_ip_address || '-' }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="类型" width="80" align="center">
                  <template #default="{ row }">
                    <el-tag size="small" effect="plain">
                      {{ getServerTypeLabel(row.type || row.Type) }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="端口" width="80" align="center">
                  <template #default="{ row }">
                    <span class="port-text">{{ row.port || row.Port || '-' }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="权重" width="80" align="center">
                  <template #default="{ row }">
                    {{ row.weight ?? row.Weight ?? '-' }}
                  </template>
                </el-table-column>
                <el-table-column label="状态" width="90" align="center">
                  <template #default="{ row }">
                    <template v-if="row.status || row.Status">
                      <LbStatusBadge :status="row.status || row.Status" />
                    </template>
                    <template v-else>
                      <span style="color: #909399">-</span>
                    </template>
                  </template>
                </el-table-column>
                <el-table-column label="描述" min-width="120" show-overflow-tooltip>
                  <template #default="{ row }">
                    {{ row.description || row.Description || '-' }}
                  </template>
                </el-table-column>
              </el-table>
            </div>
            <div v-else class="empty-tab">
              <el-icon :size="48"><Monitor /></el-icon>
              <p>暂无后端服务器信息</p>
              <p class="empty-hint">同步数据后将在此展示后端服务器列表</p>
            </div>
          </template>

          <!-- 标签 Tab -->
          <template v-else-if="activeTab === 'tags'">
            <div v-if="tagList.length > 0" class="tags-container">
              <el-tag v-for="tag in tagList" :key="tag.key" size="default" class="tag-item">
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
import { Close, Headset, Monitor, PriceTag, SetUp } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { computed, ref, watch } from 'vue'
import LbStatusBadge from './LbStatusBadge.vue'

interface ListenerItem {
  listenerid?: string
  listener_id?: string
  listenerprotocol?: string
  protocol?: string
  listenerport?: number
  listener_port?: number
  backendport?: number
  backend_port?: number
  bandwidth?: number
  status?: string
  description?: string
}

interface BackendServerItem {
  serverid?: string
  server_id?: string
  ServerId?: string
  servername?: string
  server_name?: string
  ServerName?: string
  serverip?: string
  server_ip?: string
  ServerIp?: string
  ip?: string
  private_ip?: string
  private_ip_address?: string
  type?: string
  Type?: string
  port?: number
  Port?: number
  weight?: number
  Weight?: number
  status?: string
  Status?: string
  description?: string
  Description?: string
}

const props = defineProps<{ visible: boolean; instance: Asset | null }>()
defineEmits<{ 'update:visible': [value: boolean] }>()
const activeTab = ref('detail')

watch(() => props.instance, () => { activeTab.value = 'detail' })

const attr = computed(() => props.instance?.attributes || {} as Record<string, any>)

/** 监听器列表 */
const listeners = computed<ListenerItem[]>(() => {
  const list = attr.value.listeners
  if (!list || !Array.isArray(list)) return []
  return list.filter((item: any) => item != null)
})

/** 后端服务器列表 */
const backendServers = computed<BackendServerItem[]>(() => {
  const list = attr.value.backend_servers
  if (!list || !Array.isArray(list)) return []
  return list.filter((item: any) => item != null)
})

/** 标签列表 */
const tagList = computed(() => {
  const tags = attr.value.tags
  if (!tags || typeof tags !== 'object' || Array.isArray(tags)) return []
  return Object.entries(tags).map(([key, value]) => ({ key, value: String(value) }))
})

/** 是否公网 */
const isPublicNetwork = computed(() => {
  const t = (attr.value.address_type || '').toLowerCase()
  return t === 'internet' || t === 'public'
})

/** 区域标签 */
const regionLabel = computed(() => {
  if (!props.instance) return '-'
  const config = PROVIDER_CONFIGS[props.instance.provider as keyof typeof PROVIDER_CONFIGS]
  const regionItem = config?.regions?.find((r: any) => r.value === props.instance?.region)
  return regionItem?.label || props.instance.region || '-'
})

const getLBTypeLabel = (type: string | undefined) => {
  const map: Record<string, string> = {
    slb: 'SLB 传统负载均衡', alb: 'ALB 应用负载均衡', nlb: 'NLB 网络负载均衡',
    clb: 'CLB 传统负载均衡', elb: 'ELB 弹性负载均衡',
  }
  return map[type || ''] || type || '负载均衡'
}

const getProviderName = (provider: string | undefined): string => {
  if (!provider) return '-'
  const p = provider.toLowerCase()
  if (p.includes('aliyun') || p.includes('alibaba')) return '阿里云'
  if (p.includes('tencent')) return '腾讯云'
  if (p.includes('huawei')) return '华为云'
  if (p.includes('aws') || p.includes('amazon')) return 'AWS'
  if (p.includes('volc')) return '火山引擎'
  if (p.includes('azure')) return 'Azure'
  return provider
}

const getChargeTypeLabel = (type: string | undefined) => {
  const map: Record<string, string> = {
    PayByBandwidth: '按带宽', PayByTraffic: '按流量',
    bandwidth: '按带宽', traffic: '按流量',
  }
  return map[type || ''] || type || '-'
}

const getProtocolTagType = (protocol: string | undefined): any => {
  const p = (protocol || '').toUpperCase()
  if (p === 'HTTPS') return 'success'
  if (p === 'HTTP') return 'primary'
  if (p === 'TCP') return 'warning'
  if (p === 'UDP') return 'info'
  return ''
}

const getServerTypeLabel = (type: string | undefined) => {
  const map: Record<string, string> = {
    ecs: 'ECS', eni: 'ENI', ip: 'IP', cvm: 'CVM',
  }
  return map[(type || '').toLowerCase()] || type || '-'
}

const formatTime = (time: string | number | undefined) => {
  if (!time) return '-'
  const d = dayjs(time)
  return d.isValid() ? d.format('YYYY-MM-DD HH:mm:ss') : String(time)
}
</script>

<style scoped lang="scss">
.drawer-wrapper { height: 100%; display: flex; flex-direction: column; }

.drawer-header-area { background: #f5f7fa; flex-shrink: 0; }

.drawer-header {
  display: flex; align-items: center; padding: 12px 20px; position: relative;
}

.close-corner {
  position: absolute; top: 0; left: 0; width: 36px; height: 36px; cursor: pointer; z-index: 10;
  .corner-bg { position: absolute; top: 0; left: 0; width: 0; height: 0; border-style: solid; border-width: 36px 36px 0 0; border-color: #409eff transparent transparent transparent; transition: border-color 0.2s; }
  .corner-icon { position: absolute; top: 6px; left: 6px; color: #fff; }
  &:hover .corner-bg { border-color: #66b1ff transparent transparent transparent; }
}

.header-left {
  display: flex; align-items: center; gap: 12px; margin-left: 36px;
  .instance-icon { width: 40px; height: 40px; background: #fff; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #409eff; }
  .instance-info {
    .instance-type { font-size: 11px; color: #909399; margin-bottom: 2px; }
    .instance-name { font-size: 15px; font-weight: 600; color: #303133; }
  }
}

.drawer-tabs {
  padding: 0 20px; border-bottom: 1px solid #e4e7ed;
  :deep(.el-tabs) {
    .el-tabs__header { margin: 0; }
    .el-tabs__nav-wrap::after { display: none; }
    .el-tabs__item { height: 36px; line-height: 36px; font-size: 13px; }
  }

  .tab-badge {
    margin-left: 4px;
    font-size: 10px;
    background: rgba(64, 158, 255, 0.12);
    color: #409eff;
    padding: 1px 6px;
    border-radius: 8px;
    font-weight: 600;
  }
}

.drawer-content { padding: 24px 28px; flex: 1; overflow: auto; background: #fff; }

.detail-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; }

.detail-column {
  .column-title {
    font-size: 14px; font-weight: 600; color: #303133;
    margin-bottom: 16px; padding-bottom: 10px; border-bottom: 1px solid #ebeef5;
  }
}

.info-list { display: flex; flex-direction: column; }

.info-row {
  display: flex; align-items: flex-start; padding: 8px 0; font-size: 13px;
  .info-label { width: 80px; flex-shrink: 0; color: #909399; }
  .info-value {
    flex: 1; color: #303133; word-break: break-all;
    &.mono { font-family: 'SF Mono', 'JetBrains Mono', Consolas, monospace; font-size: 12px; }
  }
}

.mono {
  font-family: 'SF Mono', 'JetBrains Mono', Consolas, monospace;
  font-size: 12px;
}

.provider-inline {
  display: flex; align-items: center; gap: 6px;
}

.highlight-num {
  color: #409eff;
  font-weight: 600;
  font-size: 15px;
}

.port-text {
  font-family: 'SF Mono', 'JetBrains Mono', Consolas, monospace;
  font-weight: 600;
  color: #303133;
}

// 监听器 & 后端服务器
.tab-section {
  .section-summary {
    padding: 12px 16px;
    margin-bottom: 16px;
    background: #f5f7fa;
    border-radius: 8px;

    .summary-text {
      font-size: 13px;
      color: #606266;

      strong {
        color: #409eff;
        font-size: 15px;
      }
    }
  }
}

.tags-container {
  display: flex; flex-wrap: wrap; gap: 12px;
  .tag-item { font-size: 13px; }
}

.empty-tab {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  height: 300px; color: #909399;
  p { margin-top: 16px; }
  .empty-hint { font-size: 12px; color: #c0c4cc; margin-top: 4px; }
}
</style>

<style lang="scss">
.lb-detail-drawer {
  .el-drawer__body { padding: 0; height: 100%; overflow: hidden; }
}
</style>
