<template>
  <el-drawer
    :model-value="visible"
    :with-header="false"
    size="50%"
    :close-on-click-modal="true"
    class="ddos-detail-drawer"
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
                <el-icon :size="24"><Lock /></el-icon>
              </div>
              <div class="instance-info">
                <div class="instance-type">DDoS 防护</div>
                <div class="instance-name">{{ instance.asset_name || instance.asset_id }}</div>
              </div>
            </div>
          </div>
        </div>

        <div class="drawer-content">
          <!-- 字段分组：基本信息 / 防护规格 / 周期（WAF 抽屉两栏分组式样，无 tab） -->
          <div class="detail-columns">
            <div class="detail-column">
              <div class="column-title">基本信息</div>
              <div class="info-list">
                <div class="info-row">
                  <span class="info-label">实例名称</span>
                  <span class="info-value">{{ instance.asset_name || '-' }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">实例ID</span>
                  <span class="info-value mono">{{ instance.asset_id }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">状态</span>
                  <span class="info-value"><AssetStatusBadge :status="instance.status" :labels="statusLabels" :tones="statusTones" /></span>
                </div>
                <div class="info-row">
                  <span class="info-label">版本</span>
                  <span class="info-value">{{ attr.edition || '-' }}</span>
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
                  <span class="info-label">地域</span>
                  <span class="info-value">{{ instance.region || '-' }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">云账号</span>
                  <span class="info-value">{{ attr.cloud_account_name || '-' }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">资源组</span>
                  <span class="info-value mono">{{ attr.resource_group_id || '-' }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">项目</span>
                  <span class="info-value mono">{{ attr.project_id || '-' }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">描述</span>
                  <span class="info-value">{{ attr.description || '-' }}</span>
                </div>
              </div>

              <div class="column-title" style="margin-top: 24px">周期</div>
              <div class="info-list">
                <div class="info-row">
                  <span class="info-label">计费方式</span>
                  <span class="info-value">{{ getChargeTypeLabel(attr.charge_type) }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">自动续费</span>
                  <span class="info-value">{{ attr.auto_renew ? '是' : '否' }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">创建时间</span>
                  <span class="info-value">{{ formatTime(attr.creation_time) }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">到期时间</span>
                  <span class="info-value" :class="{ 'expiring': isExpiringSoon(attr.expired_time) }">
                    {{ formatTime(attr.expired_time) }}
                  </span>
                </div>
              </div>
            </div>
            <div class="detail-column">
              <div class="column-title">防护规格</div>
              <div class="info-list">
                <div class="info-row">
                  <span class="info-label">保底带宽</span>
                  <span class="info-value mono">{{ getBandwidthText(attr.basic_bandwidth) }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">弹性带宽</span>
                  <span class="info-value mono">{{ getBandwidthText(attr.elastic_bandwidth) }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">业务带宽</span>
                  <span class="info-value mono">{{ getBandwidthText(attr.service_bandwidth) }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">CC峰值QPS</span>
                  <span class="info-value">{{ attr.cc_qps || '-' }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">防护IP数</span>
                  <span class="info-value">
                    <span class="highlight-num">{{ attr.protected_ip_count ?? '-' }}</span>
                  </span>
                </div>
                <div class="info-row">
                  <span class="info-label">防护对象列表</span>
                  <span class="info-value">
                    <div v-if="protectedIps.length > 0" class="ip-list">
                      <div v-for="(ip, idx) in protectedIps" :key="idx" class="ip-item mono">{{ ip }}</div>
                    </div>
                    <span v-else>-</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import type { Asset } from '@/api/types/asset'
import ProviderIcon from '@/components/ProviderIcon.vue'
import { Close, Lock } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { computed } from 'vue'
import AssetStatusBadge from '@/components/AssetStatusBadge.vue'
import { getProviderLabel } from '@/utils/constants'
import { CHARGE_TYPE_LABELS, DDOS_STATUS_LABELS, labelOfLenient } from '@/utils/fieldLabels'

/** 状态文案以 DDoS 词表为 canonical（与列表页 Ddos 页 getStatusText 同单源）；
 *  未知厂商原生值（阿里/华为,可能中文）由 AssetStatusBadge 原样透出 */
const statusLabels: Record<string, string> = { ...DDOS_STATUS_LABELS }
/** 状态色调与列表页状态族同口径：idle=active(绿) / attacking·creating·deblocking=pending(黄) /
 *  blocking·isolate=inactive(灰,服务被封停)；未知值由 AssetStatusBadge 关键词推断 */
const statusTones: Record<string, string> = {
  idle: 'active',
  attacking: 'pending', creating: 'pending', deblocking: 'pending',
  blocking: 'inactive', isolate: 'inactive',
}

const props = defineProps<{ visible: boolean; instance: Asset | null }>()
defineEmits<{ 'update:visible': [value: boolean] }>()

const attr = computed(() => props.instance?.attributes || {} as Record<string, any>)

/** 防护对象列表（protected_ips 数组逐行展示，过滤空值） */
const protectedIps = computed<string[]>(() => {
  const ips = attr.value.protected_ips
  if (!ips) return []
  if (Array.isArray(ips)) return ips.filter((ip: any) => ip != null && ip !== '')
  return []
})

/** 带宽展示：数值与 bandwidth_unit 拼接，空值 '-'（与列表页 getBandwidthText 同口径） */
const getBandwidthText = (value: any) => {
  const v = value
  if (v === null || v === undefined || v === '') return '-'
  const unit = attr.value.bandwidth_unit
  return unit ? `${v} ${unit}` : String(v)
}

/** 云厂商展示名统一走 utils/constants 单源 */
const getProviderName = (provider: string | undefined): string => (provider ? getProviderLabel(provider) : '-')

/** 计费方式文案走 fieldLabels 单源 CHARGE_TYPE_LABELS（未知值原样透出） */
const getChargeTypeLabel = (chargeType: string | undefined) => labelOfLenient(CHARGE_TYPE_LABELS, chargeType, '-')

const isExpiringSoon = (expiredTime: string | undefined) => {
  if (!expiredTime) return false
  try {
    const diffDays = (new Date(expiredTime).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    return diffDays > 0 && diffDays <= 90
  } catch { return false }
}

const formatTime = (time: string | number | undefined) => {
  if (!time) return '-'
  const d = dayjs(time)
  return d.isValid() ? d.format('YYYY-MM-DD HH:mm:ss') : String(time)
}
</script>

<style scoped lang="scss">
.drawer-wrapper { height: 100%; display: flex; flex-direction: column; }

.drawer-header-area { background: var(--bg-surface); flex-shrink: 0; }

.drawer-header {
  display: flex; align-items: center; padding: 12px 20px; position: relative;
  .header-action { margin-left: auto; }
}

.close-corner {
  position: absolute; top: 0; left: 0; width: 36px; height: 36px; cursor: pointer; z-index: 10;
  .corner-bg { position: absolute; top: 0; left: 0; width: 0; height: 0; border-style: solid; border-width: 36px 36px 0 0; border-color: var(--el-color-primary) transparent transparent transparent; transition: border-color 0.2s; }
  .corner-icon { position: absolute; top: 6px; left: 6px; color: #fff; }
  &:hover .corner-bg { border-color: var(--el-color-primary) transparent transparent transparent; }
}

.header-left {
  display: flex; align-items: center; gap: 12px;
  .instance-icon { width: 40px; height: 40px; background: var(--bg-surface); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: var(--el-color-primary); }
  .instance-info {
    .instance-type { font-size: 11px; color: var(--text-tertiary); margin-bottom: 2px; }
    .instance-name { font-size: 15px; font-weight: 600; color: var(--text-primary); }
  }
}

.drawer-content { padding: 24px 28px; flex: 1; overflow: auto; background: var(--bg-surface); }

.detail-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; }

.detail-column {
  .column-title {
    font-size: 14px; font-weight: 600; color: var(--text-primary);
    margin-bottom: 16px; padding-bottom: 10px; border-bottom: 1px solid var(--border-subtle);
  }
}

.info-list { display: flex; flex-direction: column; }

.info-row {
  display: flex; align-items: flex-start; padding: 8px 0; font-size: 13px;
  .info-label { width: 80px; flex-shrink: 0; color: var(--text-tertiary); }
  .info-value {
    flex: 1; color: var(--text-primary); word-break: break-all;
    &.mono { font-family: 'SF Mono', 'JetBrains Mono', Consolas, monospace; font-size: 12px; }
    &.expiring { color: var(--el-color-warning); }
  }
}

.highlight-num {
  color: var(--el-color-primary);
  font-weight: 600;
}

.mono {
  font-family: 'SF Mono', 'JetBrains Mono', Consolas, monospace;
  font-size: 12px;
}

.provider-inline {
  display: flex; align-items: center; gap: 6px;
}

// 防护对象列表（protected_ips 逐行）
.ip-list {
  display: flex; flex-direction: column; gap: 4px;
  .ip-item { padding: 4px 8px; background: var(--bg-hover); border-radius: 4px; }
}
</style>

<style lang="scss">
.ddos-detail-drawer {
  .el-drawer__body { padding: 0; height: 100%; overflow: hidden; }
}
</style>