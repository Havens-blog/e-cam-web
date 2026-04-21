<template>
  <el-drawer
    :model-value="visible"
    :with-header="false"
    size="50%"
    :close-on-click-modal="true"
    class="cdn-detail-drawer"
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
                <div class="instance-type">CDN 加速域名</div>
                <div class="instance-name">{{ domainName }}</div>
              </div>
            </div>
          </div>
          <div class="drawer-tabs">
            <el-tabs v-model="activeTab">
              <el-tab-pane label="详情" name="detail" />
              <el-tab-pane label="源站配置" name="origins" />
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
                    <span class="info-label">域名</span>
                    <span class="info-value">{{ domainName }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">CNAME</span>
                    <span class="info-value mono">{{ attr.cname || '-' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">状态</span>
                    <span class="info-value"><CdnStatusBadge :status="instance.status" /></span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">业务类型</span>
                    <span class="info-value">
                      <el-tag size="small" effect="plain">{{ getBusinessTypeLabel(attr.business_type) }}</el-tag>
                    </span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">加速区域</span>
                    <span class="info-value">{{ getServiceAreaLabel(attr.service_area) }}</span>
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
                    <span class="info-value">
                      <el-tag size="small" :type="attr.https_enabled ? 'success' : 'info'" effect="plain">
                        {{ attr.https_enabled ? '已开启' : '未开启' }}
                      </el-tag>
                    </span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">HTTP/2</span>
                    <span class="info-value">
                      <el-tag size="small" :type="attr.http2_enabled ? 'success' : 'info'" effect="plain">
                        {{ attr.http2_enabled ? '已开启' : '未开启' }}
                      </el-tag>
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
import type { Asset } from '@/api/types/asset'
import ProviderIcon from '@/components/ProviderIcon.vue'
import { Close, Connection, PriceTag } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { computed, ref, watch } from 'vue'
import CdnStatusBadge from './CdnStatusBadge.vue'

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

// 切换实例时重置 tab
watch(() => props.instance, () => { activeTab.value = 'detail' })

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

const getBusinessTypeLabel = (type: string | undefined) => {
  const map: Record<string, string> = { web: '网页加速', download: '下载加速', media: '流媒体', page: '网页加速', api: 'API加速', vodDomainName: '点播', wholeSite: '全站加速' }
  return map[type || ''] || type || '-'
}

const getServiceAreaLabel = (area: string | undefined) => {
  const map: Record<string, string> = { domestic: '中国大陆', overseas: '海外加速', global: '全球加速', mainland: '中国大陆' }
  return map[area || ''] || area || '-'
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
.drawer-wrapper { height: 100%; display: flex; flex-direction: column; }

.drawer-header-area { background: #f5f7fa; flex-shrink: 0; }

.drawer-header {
  display: flex;
  align-items: center;
  padding: 12px 20px;
  position: relative;
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

.provider-inline {
  display: flex; align-items: center; gap: 6px;
}

.mono {
  font-family: 'SF Mono', 'JetBrains Mono', Consolas, monospace;
  font-size: 12px;
}

// 源站配置
.origins-section {
  .origins-summary {
    display: flex; gap: 32px; padding: 16px; margin-bottom: 16px;
    background: #f5f7fa; border-radius: 8px;

    .summary-item {
      display: flex; flex-direction: column; gap: 4px;
      .summary-label { font-size: 12px; color: #909399; }
      .summary-value { font-size: 13px; color: #303133; font-weight: 500; }
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
}
</style>

<style lang="scss">
.cdn-detail-drawer {
  .el-drawer__body { padding: 0; height: 100%; overflow: hidden; }
}
</style>
