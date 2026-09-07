<template>
  <el-drawer
    :model-value="visible"
    size="720px"
    :close-on-click-modal="true"
    class="cdn-detail-drawer"
    @update:model-value="$emit('update:visible', $event)"
  >
    <template #header>
      <div class="drawer-header">
        <div class="instance-icon">
          <el-icon :size="20"><Connection /></el-icon>
        </div>
        <div class="instance-info">
          <div class="instance-type">CDN 加速域名</div>
          <div class="instance-name">{{ domainName }}</div>
        </div>
      </div>
    </template>
    <div class="drawer-body">
      <template v-if="instance">
        <div class="drawer-tabs">
          <el-tabs v-model="activeTab">
            <el-tab-pane label="详情" name="detail" />
            <el-tab-pane label="缓存配置" name="cache" />
            <el-tab-pane label="源站配置" name="origins" />
            <el-tab-pane label="标签" name="tags" />
          </el-tabs>
        </div>

        <div class="drawer-content">
          <!-- 详情 Tab -->
          <template v-if="activeTab === 'detail'">
            <div class="detail-columns">
              <div class="detail-column">
                <div class="column-title">基本信息</div>
                <div class="info-list">
                  <div class="info-row">
                    <span class="info-label">域名</span>
                    <span class="info-value">{{ domainName }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">CNAME</span>
                    <span class="info-value mono">{{ attr.cname || '-' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">状态</span>
                    <span class="info-value"><AssetStatusBadge :status="instance.status" :labels="statusLabels" /></span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">业务类型</span>
                    <span class="info-value">
                      <el-tag size="small" effect="plain">{{ cdnBusinessTypeLabel(attr.business_type) }}</el-tag>
                    </span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">服务区域</span>
                    <span class="info-value">{{ cdnServiceAreaLabel(attr.service_area) }}</span>
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
                    <span class="info-label">域名ID</span>
                    <span class="info-value mono">{{ attr.domain_id || instance.asset_id || '-' }}</span>
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
                    <span class="info-label">修改时间</span>
                    <span class="info-value">{{ formatTime(attr.modified_time) }}</span>
                  </div>
                </div>
              </div>
              <div class="detail-column">
                <div class="column-title">安全配置</div>
                <div class="info-list">
                  <div class="info-row">
                    <span class="info-label">HTTPS</span>
                    <span class="info-value" :class="attr.https_enabled ? 'bool-on' : 'bool-off'">
                      {{ attr.https_enabled ? '已开启' : '未开启' }}
                    </span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">HTTP/2</span>
                    <span class="info-value" :class="attr.http2_enabled ? 'bool-on' : 'bool-off'">
                      {{ attr.http2_enabled ? '已开启' : '未开启' }}
                    </span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">证书名称</span>
                    <span class="info-value">{{ attr.cert_name || '-' }}</span>
                  </div>
                </div>

                <div class="column-title" style="margin-top: 24px">回源概要</div>
                <div class="info-list">
                  <div class="info-row">
                    <span class="info-label">回源 Host</span>
                    <span class="info-value mono">{{ attr.origin_host || '-' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">回源类型</span>
                    <span class="info-value">{{ getOriginTypeLabel(attr.origin_type) }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">源站数量</span>
                    <span class="info-value">{{ originList.length }} 个</span>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <!-- 缓存配置 Tab -->
          <template v-else-if="activeTab === 'cache'">
            <div v-loading="cacheLoading" class="cache-section">
              <template v-if="cacheError">
                <div class="empty-tab">
                  <el-icon :size="48"><WarningFilled /></el-icon>
                  <p>{{ cacheError }}</p>
                  <el-button size="small" type="primary" plain @click="fetchCacheRules">重试</el-button>
                </div>
              </template>
              <template v-else-if="cacheRules.length > 0">
                <div class="cache-note">
                  实时读取自云厂商 API,共 {{ cacheRules.length }} 条规则;按优先级生效
                </div>
                <el-table :data="sortedCacheRules" style="width: 100%" border>
                  <el-table-column label="匹配内容" min-width="220" show-overflow-tooltip>
                    <template #default="{ row }">
                      <span class="mono">{{ row.path }}</span>
                    </template>
                  </el-table-column>
                  <el-table-column label="匹配类型" width="110" align="center">
                    <template #default="{ row }">
                      <el-tag size="small" effect="plain">{{ cdnCacheRuleTypeLabel(row.type) }}</el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column label="缓存时间" width="120" align="center">
                    <template #default="{ row }">
                      <span :class="{ 'ttl-no-cache': row.ttl === 0 }">{{ cdnTtlText(row.ttl) }}</span>
                    </template>
                  </el-table-column>
                  <el-table-column min-width="150">
                    <template #header>
                      <span class="behavior-header">
                        行为
                        <el-tooltip placement="top">
                          <template #content>
                            规则的缓存策略细节,悬停各项术语查看说明。<br />
                            多条规则按优先级匹配:命中第一条后不再向下。
                          </template>
                          <el-icon :size="13" class="behavior-help"><QuestionFilled /></el-icon>
                        </el-tooltip>
                      </span>
                    </template>
                    <template #default="{ row }">
                      <span class="behavior-cell">
                        <el-tooltip
                          v-for="seg in cdnCacheBehaviorHints(row)"
                          :key="seg.text"
                          :content="seg.hint"
                          placement="top"
                          :disabled="!seg.hint"
                        >
                          <span class="behavior-item" :class="{ 'behavior-plain': !seg.hint }">{{ seg.text }}</span>
                        </el-tooltip>
                      </span>
                    </template>
                  </el-table-column>
                  <el-table-column label="优先级" width="90" align="center">
                    <template #default="{ row }">{{ row.priority || '-' }}</template>
                  </el-table-column>
                </el-table>
              </template>
              <div v-else-if="!cacheLoading" class="empty-tab">
                <el-icon :size="48"><Connection /></el-icon>
                <p>该云厂商暂无缓存规则数据</p>
              </div>
            </div>
          </template>

          <!-- 源站配置 Tab -->
          <template v-else-if="activeTab === 'origins'">
            <div v-if="originList.length > 0" class="origins-section">
              <div class="origins-summary">
                <div class="summary-item">
                  <span class="summary-label">回源 Host</span>
                  <span class="summary-value mono">{{ attr.origin_host || '-' }}</span>
                </div>
                <div class="summary-item">
                  <span class="summary-label">回源类型</span>
                  <span class="summary-value">{{ getOriginTypeLabel(attr.origin_type) }}</span>
                </div>
              </div>

              <el-table :data="originList" style="width: 100%" border>
                <el-table-column label="源站地址" min-width="280" show-overflow-tooltip>
                  <template #default="{ row }">
                    <span class="mono">{{ row.address || '-' }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="类型" width="100">
                  <template #default="{ row }">
                    <el-tag size="small" effect="plain">{{ getOriginTypeLabel(row.type) }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="端口" width="80" align="center">
                  <template #default="{ row }">{{ row.port || '-' }}</template>
                </el-table-column>
                <el-table-column label="优先级" width="80" align="center">
                  <template #default="{ row }">{{ row.priority ?? '-' }}</template>
                </el-table-column>
                <el-table-column label="权重" width="80" align="center">
                  <template #default="{ row }">{{ row.weight ?? '-' }}</template>
                </el-table-column>
              </el-table>
            </div>
            <div v-else class="empty-tab">
              <el-icon :size="48"><Connection /></el-icon>
              <p>暂无源站配置信息</p>
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
import { getCDNCacheConfigApi, type CDNCacheRule } from '@/api/asset'
import type { Asset } from '@/api/types/asset'
import AssetStatusBadge from '@/components/AssetStatusBadge.vue'
import ProviderIcon from '@/components/ProviderIcon.vue'
import {
  CDN_STATUS_LABELS,
  cdnBusinessTypeLabel,
  cdnCacheBehaviorHints,
  cdnCacheRuleTypeLabel,
  cdnServiceAreaLabel,
  cdnTtlText,
} from '@/utils/cdn'
import { Connection, PriceTag, QuestionFilled, WarningFilled } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { computed, ref, watch } from 'vue'

/** 状态值 → 展示文案(与列表页共用同一份映射) */
const statusLabels = CDN_STATUS_LABELS

interface OriginItem {
  address: string
  type?: string
  port?: number
  priority?: number
  weight?: number
}

const props = defineProps<{ visible: boolean; instance: Asset | null }>()
defineEmits<{ 'update:visible': [value: boolean] }>()
const activeTab = ref('detail')

// ===== 缓存配置(按需实时查询) =====
const cacheLoading = ref(false)
const cacheRules = ref<CDNCacheRule[]>([])
const cacheError = ref('')
const cacheFetchedKey = ref('')

/** 优先级降序,未标优先级的排后 */
const sortedCacheRules = computed(() =>
  [...cacheRules.value].sort((a, b) => (b.priority || 0) - (a.priority || 0))
)

const fetchCacheRules = async () => {
  const inst = props.instance
  if (!inst) return
  const accountId = Number(inst.attributes?.cloud_account_id || 0)
  const domainName = attr.value.domain_name || ''
  const domainId = String(inst.attributes?.domain_id || inst.asset_id || '')
  if (!accountId || (!domainName && !domainId)) {
    cacheError.value = '缺少账号或域名标识,无法查询'
    return
  }
  cacheLoading.value = true
  cacheError.value = ''
  try {
    const res = await getCDNCacheConfigApi({
      account_id: accountId,
      domain_name: domainName || undefined,
      domain_id: domainId || undefined,
    })
    cacheRules.value = (res as any).data?.rules || []
    cacheFetchedKey.value = `${accountId}:${domainId}:${domainName}`
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '查询缓存配置失败'
    // 多数情况是厂商接口失败;提示具体原因并允许重试
    cacheError.value = msg.includes('不支持') ? msg : `缓存配置查询失败: ${msg}`
  } finally {
    cacheLoading.value = false
  }
}

// 切换实例时重置 tab 与缓存配置状态
watch(() => props.instance, () => {
  activeTab.value = 'detail'
  cacheRules.value = []
  cacheError.value = ''
  cacheFetchedKey.value = ''
})

// 打开抽屉或切到缓存 Tab 时按需拉取
watch(
  () => [props.visible, activeTab.value] as const,
  ([visible, tab]) => {
    if (!visible || tab !== 'cache') return
    const inst = props.instance
    const key = inst ? `${Number(inst.attributes?.cloud_account_id || 0)}:${inst.attributes?.domain_id || inst.asset_id || ''}:${inst.attributes?.domain_name || ''}` : ''
    if (key && key !== cacheFetchedKey.value && !cacheError.value) fetchCacheRules()
  }
)

/** 安全获取 attributes */
const attr = computed(() => props.instance?.attributes || {} as Record<string, any>)

/** 域名 */
const domainName = computed(() => {
  if (!props.instance) return '-'
  if (attr.value.domain_name) return attr.value.domain_name
  const name = props.instance.asset_name || props.instance.asset_id || ''
  const idx = name.indexOf('CNAME:')
  return idx > 0 ? name.substring(0, idx) : name || '-'
})

/** 源站列表 */
const originList = computed<OriginItem[]>(() => {
  const origins = attr.value.origins
  if (!origins) return []
  if (Array.isArray(origins)) return origins.filter((o: any) => o != null)
  return []
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

const getOriginTypeLabel = (type: string | undefined) => {
  const map: Record<string, string> = {
    oss: 'OSS 对象存储', ipaddr: 'IP 地址', domain: '域名',
    cos: 'COS 对象存储', obs: 'OBS 对象存储', s3: 'S3 对象存储',
    fc_domain: '函数计算', ip: 'IP 地址',
  }
  return map[type || ''] || type || '-'
}

const formatTime = (time: string | number | undefined) => {
  if (!time) return '-'
  const d = dayjs(time)
  return d.isValid() ? d.format('YYYY-MM-DD HH:mm:ss') : String(time)
}
</script>

<style scoped lang="scss">
.drawer-header {
  display: flex;
  align-items: center;
  gap: 12px;

  .instance-icon {
    width: 40px; height: 40px; border-radius: 9px;
    background: rgba(59, 130, 246, 0.14); color: #60a5fa;
    display: flex; align-items: center; justify-content: center;
  }
  .instance-info {
    .instance-type { font-size: 11px; color: var(--text-tertiary); margin-bottom: 2px; }
    .instance-name { font-size: 15px; font-weight: 600; color: var(--text-primary); }
  }
}

.drawer-tabs {
  flex-shrink: 0;
  padding: 0 24px; border-bottom: 1px solid var(--glass-border);
  :deep(.el-tabs) {
    .el-tabs__header { margin: 0; }
    .el-tabs__nav-wrap::after { display: none; }
    .el-tabs__item { height: 40px; line-height: 40px; font-size: 13px; }
  }
}

.drawer-content { padding: 24px 28px; flex: 1; overflow: auto; }

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
    &.bool-on { color: #4ade80; }
    &.bool-off { color: var(--text-muted); }
  }
}

.provider-inline {
  display: flex; align-items: center; gap: 6px;
}

.mono {
  font-family: 'SF Mono', 'JetBrains Mono', Consolas, monospace;
  font-size: 12px;
}

// 缓存配置
.cache-section {
  min-height: 200px;

  .cache-note {
    font-size: 12px;
    color: var(--text-tertiary);
    margin-bottom: 12px;
  }

  .ttl-no-cache {
    color: var(--el-color-warning);
  }

  .behavior-header {
    display: inline-flex;
    align-items: center;
    gap: 3px;

    .behavior-help {
      color: var(--text-tertiary);
      cursor: help;
    }
  }

  .behavior-cell {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 2px 8px;
    font-size: 12px;

    .behavior-item {
      cursor: help;
      text-decoration: underline dotted var(--text-tertiary);
      text-underline-offset: 3px;
    }

    .behavior-plain {
      cursor: default;
      text-decoration: none;
    }
  }
}

// 源站配置
.origins-section {
  .origins-summary {
    display: flex; gap: 32px; padding: 16px; margin-bottom: 16px;
    background: var(--glass-bg); border: 1px solid var(--glass-border); border-radius: 8px;

    .summary-item {
      display: flex; flex-direction: column; gap: 4px;
      .summary-label { font-size: 12px; color: var(--text-tertiary); }
      .summary-value { font-size: 13px; color: var(--text-primary); font-weight: 500; }
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
}
</style>

<style lang="scss">
.cdn-detail-drawer {
  .el-drawer__body { padding: 0; display: flex; flex-direction: column; overflow: hidden; }
}
</style>
