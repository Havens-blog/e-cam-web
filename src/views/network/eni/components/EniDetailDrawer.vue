<template>
  <el-drawer
    :model-value="visible"
    :with-header="false"
    size="50%"
    :close-on-click-modal="true"
    class="eni-detail-drawer"
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
                <el-icon :size="24"><Connection /></el-icon>
              </div>
              <div class="instance-info">
                <div class="instance-type">弹性网卡</div>
                <div class="instance-name">{{ instance.asset_id }}</div>
              </div>
            </div>
          </div>
          <div class="drawer-tabs">
            <el-tabs v-model="activeTab">
              <el-tab-pane label="详情" name="detail" />
              <el-tab-pane name="ips">
                <template #label>
                  IP 地址
                  <span v-if="allIPs.length" class="tab-badge">{{ allIPs.length }}</span>
                </template>
              </el-tab-pane>
              <el-tab-pane name="security_groups">
                <template #label>
                  安全组
                  <span v-if="securityGroupIDs.length" class="tab-badge">{{ securityGroupIDs.length }}</span>
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
                  <div class="info-row"><span class="info-label">网卡ID</span><span class="info-value mono">{{ instance.asset_id }}</span></div>
                  <div class="info-row"><span class="info-label">名称</span><span class="info-value">{{ instance.asset_name || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">状态</span><span class="info-value"><EniStatusBadge :status="instance.status" /></span></div>
                  <div class="info-row">
                    <span class="info-label">类型</span>
                    <span class="info-value">
                      <el-tag size="small" :type="attr.type === 'Primary' ? 'primary' : 'info'" effect="plain">
                        {{ attr.type === 'Primary' ? '主网卡' : '辅助网卡' }}
                      </el-tag>
                    </span>
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
                  <div class="info-row"><span class="info-label">云账号</span><span class="info-value">{{ attr.cloud_account_name || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">区域</span><span class="info-value">{{ instance.region || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">可用区</span><span class="info-value">{{ attr.zone || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">描述</span><span class="info-value">{{ attr.description || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">创建时间</span><span class="info-value">{{ formatTime(attr.creation_time) }}</span></div>
                </div>
              </div>
              <div class="detail-column">
                <div class="column-title">网络信息</div>
                <div class="info-list">
                  <div class="info-row"><span class="info-label">主私网IP</span><span class="info-value"><span class="ip-highlight">{{ attr.primary_private_ip || '-' }}</span></span></div>
                  <div class="info-row"><span class="info-label">MAC地址</span><span class="info-value mono">{{ attr.mac_address || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">VPC</span><span class="info-value mono">{{ attr.vpc_id || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">交换机</span><span class="info-value mono">{{ attr.subnet_id || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">公网IP</span><span class="info-value"><span v-if="attr.public_ip" class="ip-highlight">{{ attr.public_ip }}</span><span v-else>-</span></span></div>
                </div>

                <div class="column-title" style="margin-top: 24px">绑定实例</div>
                <div class="info-list">
                  <div class="info-row"><span class="info-label">实例ID</span><span class="info-value mono">{{ attr.instance_id || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">实例名称</span><span class="info-value">{{ attr.instance_name || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">设备索引</span><span class="info-value">{{ attr.device_index ?? '-' }}</span></div>
                </div>
              </div>
            </div>
          </template>

          <!-- IP 地址 Tab -->
          <template v-else-if="activeTab === 'ips'">
            <div v-if="allIPs.length > 0" class="tab-section">
              <div class="section-summary">
                <span class="summary-text">共 <strong>{{ allIPs.length }}</strong> 个 IP 地址</span>
              </div>
              <el-table :data="allIPs" style="width: 100%" border>
                <el-table-column label="IP 地址" min-width="200">
                  <template #default="{ row }">
                    <span class="mono ip-highlight">{{ row.address }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="类型" width="120" align="center">
                  <template #default="{ row }">
                    <el-tag size="small" :type="row.type === 'primary' ? 'primary' : row.type === 'eip' ? 'success' : row.type === 'ipv6' ? 'warning' : 'info'" effect="plain">
                      {{ row.label }}
                    </el-tag>
                  </template>
                </el-table-column>
              </el-table>
            </div>
            <div v-else class="empty-tab">
              <el-icon :size="48"><Position /></el-icon>
              <p>暂无 IP 地址信息</p>
            </div>
          </template>

          <!-- 安全组 Tab -->
          <template v-else-if="activeTab === 'security_groups'">
            <div v-if="securityGroupIDs.length > 0" class="tab-section">
              <div class="section-summary">
                <span class="summary-text">关联 <strong>{{ securityGroupIDs.length }}</strong> 个安全组</span>
              </div>
              <el-table :data="securityGroupIDs" style="width: 100%" border>
                <el-table-column type="index" label="#" width="50" align="center" />
                <el-table-column label="安全组ID" min-width="300">
                  <template #default="{ row }">
                    <span class="mono">{{ row }}</span>
                  </template>
                </el-table-column>
              </el-table>
            </div>
            <div v-else class="empty-tab">
              <el-icon :size="48"><Lock /></el-icon>
              <p>暂无安全组信息</p>
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
import { Close, Connection, Lock, Position, PriceTag } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { computed, ref, watch } from 'vue'
import EniStatusBadge from './EniStatusBadge.vue'

const props = defineProps<{ visible: boolean; instance: Asset | null }>()
defineEmits<{ 'update:visible': [value: boolean] }>()
const activeTab = ref('detail')

watch(() => props.instance, () => { activeTab.value = 'detail' })

const attr = computed(() => props.instance?.attributes || {} as Record<string, any>)

/** 所有 IP 地址汇总 */
const allIPs = computed(() => {
  const ips: { address: string; type: string; label: string }[] = []
  if (attr.value.primary_private_ip) {
    ips.push({ address: attr.value.primary_private_ip, type: 'primary', label: '主私网IP' })
  }
  const privateIPs = attr.value.private_ip_addresses
  if (Array.isArray(privateIPs)) {
    privateIPs.filter((ip: any) => ip != null && ip !== attr.value.primary_private_ip).forEach((ip: string) => {
      ips.push({ address: ip, type: 'secondary', label: '辅助私网IP' })
    })
  }
  if (attr.value.public_ip) {
    ips.push({ address: attr.value.public_ip, type: 'public', label: '公网IP' })
  }
  const eips = attr.value.eip_addresses
  if (Array.isArray(eips)) {
    eips.filter((ip: any) => ip != null).forEach((ip: string) => {
      ips.push({ address: ip, type: 'eip', label: 'EIP' })
    })
  }
  const ipv6s = attr.value.ipv6_addresses
  if (Array.isArray(ipv6s)) {
    ipv6s.filter((ip: any) => ip != null).forEach((ip: string) => {
      ips.push({ address: ip, type: 'ipv6', label: 'IPv6' })
    })
  }
  return ips
})

/** 安全组 ID 列表 */
const securityGroupIDs = computed<string[]>(() => {
  const sgs = attr.value.security_group_ids
  if (!Array.isArray(sgs)) return []
  return sgs.filter((sg: any) => sg != null && sg !== '')
})

/** 标签列表 */
const tagList = computed(() => {
  const tags = attr.value.tags
  if (!tags || typeof tags !== 'object' || Array.isArray(tags)) return []
  return Object.entries(tags).map(([key, value]) => ({ key, value: String(value) }))
})

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

const formatTime = (time: string | number | undefined) => {
  if (!time) return '-'
  const d = dayjs(time)
  return d.isValid() ? d.format('YYYY-MM-DD HH:mm:ss') : String(time)
}
</script>

<style scoped lang="scss">
.drawer-wrapper { height: 100%; display: flex; flex-direction: column; }
.drawer-header-area { background: #f5f7fa; flex-shrink: 0; }
.drawer-header { display: flex; align-items: center; padding: 12px 20px; position: relative; }
.close-corner {
  position: absolute; top: 0; left: 0; width: 36px; height: 36px; cursor: pointer; z-index: 10;
  .corner-bg { position: absolute; top: 0; left: 0; width: 0; height: 0; border-style: solid; border-width: 36px 36px 0 0; border-color: #409eff transparent transparent transparent; transition: border-color 0.2s; }
  .corner-icon { position: absolute; top: 6px; left: 6px; color: #fff; }
  &:hover .corner-bg { border-color: #66b1ff transparent transparent transparent; }
}
.header-left {
  display: flex; align-items: center; gap: 12px; margin-left: 36px;
  .instance-icon { width: 40px; height: 40px; background: #fff; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #409eff; }
  .instance-info { .instance-type { font-size: 11px; color: #909399; margin-bottom: 2px; } .instance-name { font-size: 15px; font-weight: 600; color: #303133; } }
}
.drawer-tabs {
  padding: 0 20px; border-bottom: 1px solid #e4e7ed;
  :deep(.el-tabs) { .el-tabs__header { margin: 0; } .el-tabs__nav-wrap::after { display: none; } .el-tabs__item { height: 36px; line-height: 36px; font-size: 13px; } }
  .tab-badge { margin-left: 4px; font-size: 10px; background: rgba(64, 158, 255, 0.12); color: #409eff; padding: 1px 6px; border-radius: 8px; font-weight: 600; }
}
.drawer-content { padding: 24px 28px; flex: 1; overflow: auto; background: #fff; }
.detail-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; }
.detail-column { .column-title { font-size: 14px; font-weight: 600; color: #303133; margin-bottom: 16px; padding-bottom: 10px; border-bottom: 1px solid #ebeef5; } }
.info-list { display: flex; flex-direction: column; }
.info-row {
  display: flex; align-items: flex-start; padding: 8px 0; font-size: 13px;
  .info-label { width: 80px; flex-shrink: 0; color: #909399; }
  .info-value { flex: 1; color: #303133; word-break: break-all; &.mono { font-family: 'SF Mono', 'JetBrains Mono', Consolas, monospace; font-size: 12px; } }
}
.mono { font-family: 'SF Mono', 'JetBrains Mono', Consolas, monospace; font-size: 12px; }
.provider-inline { display: flex; align-items: center; gap: 6px; }
.ip-highlight { font-family: 'SF Mono', Consolas, monospace; font-size: 12px; color: #409eff; background: rgba(64, 158, 255, 0.06); padding: 1px 6px; border-radius: 3px; }
.tab-section {
  .section-summary { padding: 12px 16px; margin-bottom: 16px; background: #f5f7fa; border-radius: 8px;
    .summary-text { font-size: 13px; color: #606266; strong { color: #409eff; font-size: 15px; } }
  }
}
.tags-container { display: flex; flex-wrap: wrap; gap: 12px; .tag-item { font-size: 13px; } }
.empty-tab { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 300px; color: #909399; p { margin-top: 16px; } }
</style>
<style lang="scss">.eni-detail-drawer { .el-drawer__body { padding: 0; height: 100%; overflow: hidden; } }</style>
