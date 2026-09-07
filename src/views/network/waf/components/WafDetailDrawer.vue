<template>
  <el-drawer
    :model-value="visible"
    :with-header="false"
    size="50%"
    :close-on-click-modal="true"
    class="waf-detail-drawer"
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
                <div class="instance-type">WAF 防火墙</div>
                <div class="instance-name">{{ instance.asset_name || instance.asset_id }}</div>
              </div>
            </div>
          </div>
          <div class="drawer-tabs">
            <el-tabs v-model="activeTab">
              <el-tab-pane label="详情" name="detail" />
              <el-tab-pane label="防护域名" name="domains" />
              <el-tab-pane label="源站信息" name="origins" />
              <el-tab-pane label="防护规则" name="rules" />
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
                    <span class="info-value"><AssetStatusBadge :status="instance.status" :labels="statusLabels" :tones="statusTones" /></span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">版本</span>
                    <span class="info-value">
                      <el-tag size="small" :type="getEditionTagType(attr.edition)" effect="plain">
                        {{ getEditionLabel(attr.edition) }}
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
                  <div class="info-row">
                    <span class="info-label">云账号</span>
                    <span class="info-value">{{ attr.cloud_account_name || '-' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">区域</span>
                    <span class="info-value">{{ instance.region || '-' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">付费类型</span>
                    <span class="info-value">{{ getPayTypeLabel(attr.pay_type) }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">独享IP</span>
                    <span class="info-value">{{ attr.exclusive_ip ? '是' : '否' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">资源组</span>
                    <span class="info-value mono">{{ attr.resource_group_id || '-' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">备注</span>
                    <span class="info-value">{{ attr.description || '-' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">创建时间</span>
                    <span class="info-value">{{ formatTime(attr.creation_time) }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">过期时间</span>
                    <span class="info-value" :class="{ 'expiring': isExpiringSoon(attr.expired_time) }">
                      {{ formatTime(attr.expired_time) }}
                    </span>
                  </div>
                </div>
              </div>
              <div class="detail-column">
                <div class="column-title">防护能力</div>
                <div class="info-list">
                  <div class="info-row">
                    <span class="info-label">防护域名</span>
                    <span class="info-value">
                      <span class="highlight-num">{{ attr.domain_count || 0 }}</span>
                      <template v-if="attr.domain_limit"> / {{ attr.domain_limit }}</template>
                    </span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">QPS配额</span>
                    <span class="info-value">{{ attr.qps || '-' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">带宽</span>
                    <span class="info-value">{{ attr.bandwidth ? attr.bandwidth + ' Mbps' : '-' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">CNAME</span>
                    <span class="info-value mono">{{ attr.cname || '-' }}</span>
                  </div>
                </div>

                <div class="column-title" style="margin-top: 24px">规则统计</div>
                <div class="info-list">
                  <div class="info-row">
                    <span class="info-label">自定义规则</span>
                    <span class="info-value">{{ attr.rule_count || 0 }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">ACL规则</span>
                    <span class="info-value">{{ attr.acl_rule_count || 0 }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">CC规则</span>
                    <span class="info-value">{{ attr.cc_rule_count || 0 }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">限速规则</span>
                    <span class="info-value">{{ attr.rate_limit_count || 0 }}</span>
                  </div>
                </div>

                <div class="column-title" style="margin-top: 24px">防护功能</div>
                <div class="info-list">
                  <div class="info-row">
                    <span class="info-label">Web防护</span>
                    <span class="info-value">
                      <el-tag size="small" :type="attr.waf_enabled ? 'success' : 'info'" effect="plain">
                        {{ attr.waf_enabled ? '已开启' : '未开启' }}
                      </el-tag>
                    </span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">CC防护</span>
                    <span class="info-value">
                      <el-tag size="small" :type="attr.cc_enabled ? 'success' : 'info'" effect="plain">
                        {{ attr.cc_enabled ? '已开启' : '未开启' }}
                      </el-tag>
                    </span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Bot防护</span>
                    <span class="info-value">
                      <el-tag size="small" :type="attr.anti_bot_enabled ? 'success' : 'info'" effect="plain">
                        {{ attr.anti_bot_enabled ? '已开启' : '未开启' }}
                      </el-tag>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <!-- 防护域名 Tab -->
          <template v-else-if="activeTab === 'domains'">
            <div v-if="protectedHosts.length > 0" class="domains-section">
              <div class="section-summary">
                <span class="summary-text">
                  已接入 <strong>{{ protectedHosts.length }}</strong> 个防护域名
                  <template v-if="attr.domain_limit">，配额 {{ attr.domain_limit }} 个</template>
                </span>
              </div>
              <el-table :data="protectedHosts" style="width: 100%" border>
                <el-table-column type="index" label="#" width="50" align="center" />
                <el-table-column label="域名" min-width="300">
                  <template #default="{ row }">
                    <span class="mono">{{ row }}</span>
                  </template>
                </el-table-column>
              </el-table>
            </div>
            <div v-else class="empty-tab">
              <el-icon :size="48"><Connection /></el-icon>
              <p>暂无防护域名信息</p>
              <p class="empty-hint">同步数据后将在此展示防护域名列表</p>
            </div>
          </template>

          <!-- 源站信息 Tab -->
          <template v-else-if="activeTab === 'origins'">
            <div v-if="sourceIPs.length > 0" class="origins-section">
              <div class="section-summary">
                <span class="summary-text">共 <strong>{{ sourceIPs.length }}</strong> 个源站地址</span>
              </div>
              <el-table :data="sourceIPs" style="width: 100%" border>
                <el-table-column type="index" label="#" width="50" align="center" />
                <el-table-column label="源站地址" min-width="300">
                  <template #default="{ row }">
                    <span class="mono">{{ row }}</span>
                  </template>
                </el-table-column>
              </el-table>
            </div>
            <div v-else class="empty-tab">
              <el-icon :size="48"><Position /></el-icon>
              <p>暂无源站信息</p>
              <p class="empty-hint">同步数据后将在此展示源站IP列表</p>
            </div>
          </template>

          <!-- 防护规则 Tab -->
          <template v-else-if="activeTab === 'rules'">
            <div class="empty-tab">
              <el-icon :size="48"><Document /></el-icon>
              <p>防护规则详情功能开发中...</p>
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
import { Close, Connection, Document, Lock, Position, PriceTag } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { computed, ref, watch } from 'vue'
import AssetStatusBadge from '@/components/AssetStatusBadge.vue'
import { getProviderLabel } from '@/utils/constants'

/** 状态值 → 展示文案(共享 AssetStatusBadge 的 labels 映射) */
const statusLabels: Record<string, string> = {
    active: '运行中', Active: '运行中', running: '运行中',
    inactive: '已停用', expired: '已过期', stopped: '已停用',
    creating: '创建中', configuring: '配置中',
    expiring: '即将到期',
    error: '异常',
  }
const statusTones: Record<string, string> = {'expiring': 'pending', 'Expiring': 'pending'}


const props = defineProps<{ visible: boolean; instance: Asset | null }>()
defineEmits<{ 'update:visible': [value: boolean] }>()
const activeTab = ref('detail')

watch(() => props.instance, () => { activeTab.value = 'detail' })

const attr = computed(() => props.instance?.attributes || {} as Record<string, any>)

/** 防护域名列表 */
const protectedHosts = computed<string[]>(() => {
  const hosts = attr.value.protected_hosts
  if (!hosts) return []
  if (Array.isArray(hosts)) return hosts.filter((h: any) => h != null && h !== '')
  return []
})

/** 源站IP列表 */
const sourceIPs = computed<string[]>(() => {
  const ips = attr.value.source_ips
  if (!ips) return []
  if (Array.isArray(ips)) return ips.filter((ip: any) => ip != null && ip !== '')
  return []
})

/** 标签列表 */
const tagList = computed(() => {
  const tags = attr.value.tags
  if (!tags || typeof tags !== 'object' || Array.isArray(tags)) return []
  return Object.entries(tags).map(([key, value]) => ({ key, value: String(value) }))
})

const getEditionLabel = (edition: string | undefined) => {
  const map: Record<string, string> = { basic: '基础版', pro: '专业版', business: '商业版', enterprise: '企业版' }
  return map[edition || ''] || edition || '-'
}

const getEditionTagType = (edition: string | undefined): any => {
  const map: Record<string, string> = { basic: 'info', pro: 'primary', business: 'warning', enterprise: 'danger' }
  return map[edition || ''] || 'info'
}

/** 云厂商展示名统一走 utils/constants 单源（含 volcengine/bytedance 等变体归一） */
const getProviderName = (provider: string | undefined): string => (provider ? getProviderLabel(provider) : '-')

const getPayTypeLabel = (payType: string | undefined) => {
  const map: Record<string, string> = { subscription: '包年包月', payasyougo: '按量付费', Subscription: '包年包月', PayAsYouGo: '按量付费' }
  return map[payType || ''] || payType || '-'
}

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

.drawer-header-area { background: var(--glass-bg); flex-shrink: 0; }

.drawer-header {
  display: flex; align-items: center; padding: 12px 20px; position: relative;
}

.close-corner {
  position: absolute; top: 0; left: 0; width: 36px; height: 36px; cursor: pointer; z-index: 10;
  .corner-bg { position: absolute; top: 0; left: 0; width: 0; height: 0; border-style: solid; border-width: 36px 36px 0 0; border-color: var(--el-color-primary) transparent transparent transparent; transition: border-color 0.2s; }
  .corner-icon { position: absolute; top: 6px; left: 6px; color: #fff; }
  &:hover .corner-bg { border-color: var(--el-color-primary) transparent transparent transparent; }
}

.header-left {
  display: flex; align-items: center; gap: 12px; margin-left: 36px;
  .instance-icon { width: 40px; height: 40px; background: var(--glass-bg); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: var(--el-color-primary); }
  .instance-info {
    .instance-type { font-size: 11px; color: var(--text-tertiary); margin-bottom: 2px; }
    .instance-name { font-size: 15px; font-weight: 600; color: var(--text-primary); }
  }
}

.drawer-tabs {
  padding: 0 20px; border-bottom: 1px solid var(--glass-border);
  :deep(.el-tabs) {
    .el-tabs__header { margin: 0; }
    .el-tabs__nav-wrap::after { display: none; }
    .el-tabs__item { height: 36px; line-height: 36px; font-size: 13px; }
  }
}

.drawer-content { padding: 24px 28px; flex: 1; overflow: auto; background: var(--glass-bg); }

.detail-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; }

.detail-column {
  .column-title {
    font-size: 14px; font-weight: 600; color: var(--text-primary);
    margin-bottom: 16px; padding-bottom: 10px; border-bottom: 1px solid var(--glass-border);
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

// 防护域名 & 源站信息
.domains-section,
.origins-section {
  .section-summary {
    padding: 12px 16px;
    margin-bottom: 16px;
    background: var(--glass-bg);
    border-radius: 8px;

    .summary-text {
      font-size: 13px;
      color: var(--text-secondary);

      strong {
        color: var(--el-color-primary);
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
  height: 300px; color: var(--text-tertiary);
  p { margin-top: 16px; }
  .empty-hint { font-size: 12px; color: var(--text-muted); margin-top: 4px; }
}
</style>

<style lang="scss">
.waf-detail-drawer {
  .el-drawer__body { padding: 0; height: 100%; overflow: hidden; }
}
</style>
