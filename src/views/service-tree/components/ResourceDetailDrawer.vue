<template>
  <el-drawer
    :model-value="visible"
    :with-header="false"
    size="50%"
    :close-on-click-modal="true"
    class="resource-detail-drawer"
    @update:model-value="$emit('update:visible', $event)"
  >
    <div class="drawer-wrapper">
      <template v-if="resource">
        <div class="drawer-header-area">
          <div class="drawer-header">
            <div class="close-corner" @click="$emit('update:visible', false)">
              <div class="corner-bg"></div>
              <el-icon class="corner-icon" :size="12"><Close /></el-icon>
            </div>
            <div class="header-left">
              <div class="instance-icon">
                <el-icon :size="24"><Monitor /></el-icon>
              </div>
              <div class="instance-info">
                <div class="instance-type">{{ assetTypeLabel }}</div>
                <div class="instance-name">{{ displayName }}</div>
              </div>
            </div>
            <div class="header-right">
              <el-tag :type="statusType" size="small">{{ statusText }}</el-tag>
              <ProviderIcon v-if="provider" :provider="provider" size="small" />
            </div>
          </div>
          <div class="drawer-tabs">
            <el-tabs v-model="activeTab">
              <el-tab-pane label="详情" name="detail" />
              <el-tab-pane label="全部属性" name="attributes" />
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
                    <span class="info-label">资产ID</span>
                    <span class="info-value mono">{{ assetId }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">名称</span>
                    <span class="info-value">{{ displayName }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">类型</span>
                    <span class="info-value">
                      <el-tag size="small" type="info">{{ assetTypeLabel }}</el-tag>
                    </span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">状态</span>
                    <span class="info-value">
                      <el-tag :type="statusType" size="small">{{ statusText }}</el-tag>
                    </span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">云平台</span>
                    <span class="info-value">
                      <ProviderIcon v-if="provider" :provider="provider" size="small" />
                      {{ providerLabel }}
                    </span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">地域</span>
                    <span class="info-value">{{ region || '-' }}</span>
                  </div>
                  <div v-if="attrs.zone" class="info-row">
                    <span class="info-label">可用区</span>
                    <span class="info-value">{{ attrs.zone }}</span>
                  </div>
                  <div v-if="attrs.creation_time" class="info-row">
                    <span class="info-label">创建时间</span>
                    <span class="info-value">{{ attrs.creation_time }}</span>
                  </div>
                </div>
              </div>

              <div class="detail-column">
                <div class="column-title">网络 / 配置</div>
                <div class="info-list">
                  <div v-if="attrs.private_ip" class="info-row">
                    <span class="info-label">内网IP</span>
                    <span class="info-value mono">{{ attrs.private_ip }}</span>
                  </div>
                  <div v-if="attrs.public_ip" class="info-row">
                    <span class="info-label">公网IP</span>
                    <span class="info-value mono">{{ attrs.public_ip }}</span>
                  </div>
                  <div v-if="attrs.vpc_id" class="info-row">
                    <span class="info-label">VPC</span>
                    <span class="info-value mono">{{ attrs.vpc_id }}</span>
                  </div>
                  <div v-if="attrs.subnet_id || attrs.vswitch_id" class="info-row">
                    <span class="info-label">子网</span>
                    <span class="info-value mono">{{ attrs.subnet_id || attrs.vswitch_id }}</span>
                  </div>
                  <div v-if="attrs.instance_type" class="info-row">
                    <span class="info-label">规格</span>
                    <span class="info-value">{{ attrs.instance_type }}</span>
                  </div>
                  <div v-if="attrs.cpu" class="info-row">
                    <span class="info-label">CPU</span>
                    <span class="info-value">{{ attrs.cpu }} 核</span>
                  </div>
                  <div v-if="attrs.memory" class="info-row">
                    <span class="info-label">内存</span>
                    <span class="info-value">{{ attrs.memory }} MB</span>
                  </div>
                  <div v-if="attrs.os_name || attrs.os_type" class="info-row">
                    <span class="info-label">操作系统</span>
                    <span class="info-value">{{ attrs.os_name || attrs.os_type }}</span>
                  </div>
                  <div v-if="attrs.bandwidth" class="info-row">
                    <span class="info-label">带宽</span>
                    <span class="info-value">{{ attrs.bandwidth }} Mbps</span>
                  </div>
                  <div v-if="attrs.address" class="info-row">
                    <span class="info-label">VIP地址</span>
                    <span class="info-value mono">{{ attrs.address }}</span>
                  </div>
                  <div v-if="attrs.domain_name" class="info-row">
                    <span class="info-label">域名</span>
                    <span class="info-value mono">{{ attrs.domain_name }}</span>
                  </div>
                  <div v-if="attrs.cname" class="info-row">
                    <span class="info-label">CNAME</span>
                    <span class="info-value mono">{{ attrs.cname }}</span>
                  </div>
                  <div v-if="attrs.edition" class="info-row">
                    <span class="info-label">版本</span>
                    <span class="info-value">{{ attrs.edition }}</span>
                  </div>
                  <div v-if="attrs.engine" class="info-row">
                    <span class="info-label">引擎</span>
                    <span class="info-value">{{ attrs.engine }}</span>
                  </div>
                  <div v-if="attrs.engine_version" class="info-row">
                    <span class="info-label">引擎版本</span>
                    <span class="info-value">{{ attrs.engine_version }}</span>
                  </div>
                  <div v-if="attrs.storage_type" class="info-row">
                    <span class="info-label">存储类型</span>
                    <span class="info-value">{{ attrs.storage_type }}</span>
                  </div>
                  <div v-if="attrs.storage_size" class="info-row">
                    <span class="info-label">存储大小</span>
                    <span class="info-value">{{ attrs.storage_size }} GB</span>
                  </div>
                  <div v-if="!hasNetworkInfo" class="info-row">
                    <span class="info-label" style="color: var(--text-muted)">暂无网络/配置信息</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- 绑定信息 -->
            <div v-if="bindingInfo" class="binding-section">
              <div class="column-title">绑定信息</div>
              <div class="info-list horizontal">
                <div v-if="bindingInfo.env_name" class="info-row">
                  <span class="info-label">环境</span>
                  <span class="info-value">
                    <span class="env-dot" :style="{ background: bindingInfo.env_color || '#909399' }"></span>
                    {{ bindingInfo.env_name }}
                  </span>
                </div>
                <div v-if="bindingInfo.bind_type" class="info-row">
                  <span class="info-label">绑定方式</span>
                  <span class="info-value">
                    <el-tag :type="bindingInfo.bind_type === 'manual' ? 'info' : 'success'" size="small">
                      {{ bindingInfo.bind_type === 'manual' ? '手动绑定' : '规则绑定' }}
                    </el-tag>
                  </span>
                </div>
              </div>
            </div>
          </template>

          <!-- 全部属性 Tab -->
          <template v-else-if="activeTab === 'attributes'">
            <div v-if="attrEntries.length > 0" class="attributes-table">
              <el-table :data="attrEntries" size="small" stripe max-height="calc(100vh - 200px)">
                <el-table-column prop="key" label="属性名" width="200" show-overflow-tooltip>
                  <template #default="{ row }">
                    <span class="attr-key">{{ row.key }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="value" label="属性值" min-width="300" show-overflow-tooltip>
                  <template #default="{ row }">
                    <span class="attr-value">{{ formatAttrValue(row.value) }}</span>
                  </template>
                </el-table-column>
              </el-table>
            </div>
            <el-empty v-else description="暂无属性数据" />
          </template>

          <!-- 标签 Tab -->
          <template v-else-if="activeTab === 'tags'">
            <div v-if="tagList.length > 0" class="tags-container">
              <el-tag v-for="tag in tagList" :key="tag.key" size="default" class="tag-item">
                {{ tag.key }}: {{ tag.value }}
              </el-tag>
            </div>
            <el-empty v-else description="暂无标签" />
          </template>
        </div>
      </template>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import ProviderIcon from '@/components/ProviderIcon.vue'
import { Close, Monitor } from '@element-plus/icons-vue'
import { computed, ref } from 'vue'

export interface ResourceData {
  // 通用字段
  asset_id?: string
  asset_name?: string
  asset_type?: string
  resource_name?: string
  resource_status?: string
  status?: string
  provider?: string
  region?: string
  attributes?: Record<string, any>
  // 绑定信息
  env_name?: string
  env_color?: string
  bind_type?: string
  // CMDB 实例
  model_uid?: string
  model_name?: string
  inst_id?: string
  // 其他
  [key: string]: any
}

const props = defineProps<{
  visible: boolean
  resource: ResourceData | null
  bindingInfo?: { env_name?: string; env_color?: string; bind_type?: string } | null
}>()

defineEmits<{ 'update:visible': [value: boolean] }>()

const activeTab = ref('detail')

const attrs = computed(() => props.resource?.attributes || {})

const assetId = computed(() =>
  props.resource?.asset_id || props.resource?.inst_id || attrs.value.instance_id || '-'
)

const displayName = computed(() =>
  props.resource?.asset_name || props.resource?.resource_name || assetId.value
)

const assetTypeLabel = computed(() => {
  const t = props.resource?.asset_type || props.resource?.model_uid || ''
  const map: Record<string, string> = {
    ecs: '云服务器', rds: '云数据库', redis: 'Redis', mongodb: 'MongoDB',
    vpc: 'VPC', eip: '弹性IP', lb: '负载均衡', cdn: 'CDN', waf: 'WAF',
    nas: '文件存储', oss: '对象存储', kafka: 'Kafka', elasticsearch: 'Elasticsearch',
    disk: '云硬盘', snapshot: '快照', security_group: '安全组', vswitch: '交换机',
    subnet: '子网'
  }
  return map[t] || t || '实例'
})

const provider = computed(() => props.resource?.provider || attrs.value.provider || '')

const providerLabel = computed(() => {
  const map: Record<string, string> = {
    aliyun: '阿里云', aws: 'AWS', tencent: '腾讯云', huawei: '华为云', volcano: '火山引擎'
  }
  return map[provider.value] || provider.value || '-'
})

const region = computed(() => props.resource?.region || attrs.value.region || '')

const currentStatus = computed(() =>
  props.resource?.status || props.resource?.resource_status || attrs.value.status || ''
)

const statusType = computed((): 'success' | 'info' | 'warning' | 'danger' => {
  const s = currentStatus.value?.toLowerCase()
  if (['running', 'active', 'online', 'deployed', 'available'].includes(s)) return 'success'
  if (['stopped', 'offline'].includes(s)) return 'info'
  if (['error', 'terminated', 'deleted'].includes(s)) return 'danger'
  return 'info'
})

const statusText = computed(() => {
  const s = currentStatus.value
  if (!s) return '-'
  const map: Record<string, string> = {
    running: '运行中', active: '活跃', online: '在线', stopped: '已停止',
    offline: '离线', error: '错误', terminated: '已终止', Deployed: '已部署',
    available: '可用', inactive: '未激活'
  }
  return map[s] || s
})

const hasNetworkInfo = computed(() => {
  const a = attrs.value
  return a.private_ip || a.public_ip || a.vpc_id || a.subnet_id || a.vswitch_id ||
    a.instance_type || a.cpu || a.memory || a.bandwidth || a.address ||
    a.domain_name || a.cname || a.edition || a.engine || a.storage_type || a.storage_size
})

const attrEntries = computed(() => {
  const a = attrs.value
  if (!a || typeof a !== 'object') return []
  return Object.entries(a)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => ({ key, value }))
})

const tagList = computed(() => {
  const tags = attrs.value.tags
  if (!tags) return []
  if (typeof tags === 'object' && !Array.isArray(tags)) {
    return Object.entries(tags).map(([key, value]) => ({ key, value: String(value) }))
  }
  if (Array.isArray(tags)) {
    return tags.map((t: any) => {
      if (typeof t === 'string') return { key: t, value: '' }
      return { key: t.key || t.Key || t.tag_key || '', value: t.value || t.Value || t.tag_value || '' }
    })
  }
  return []
})

const formatAttrValue = (value: any): string => {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'boolean') return value ? '是' : '否'
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}
</script>

<style scoped lang="scss">
.drawer-wrapper { height: 100%; display: flex; flex-direction: column; }
.drawer-header-area { background: #f5f7fa; flex-shrink: 0; }
.drawer-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 20px; position: relative;
}
.close-corner {
  position: absolute; top: 0; left: 0; width: 36px; height: 36px; cursor: pointer; z-index: 10;
  .corner-bg {
    position: absolute; top: 0; left: 0; width: 0; height: 0;
    border-style: solid; border-width: 36px 36px 0 0;
    border-color: #409eff transparent transparent transparent; transition: border-color 0.2s;
  }
  .corner-icon { position: absolute; top: 6px; left: 6px; color: #fff; }
  &:hover .corner-bg { border-color: #66b1ff transparent transparent transparent; }
}
.header-left {
  display: flex; align-items: center; gap: 12px; margin-left: 36px;
  .instance-icon {
    width: 40px; height: 40px; background: #fff; border-radius: 8px;
    display: flex; align-items: center; justify-content: center; color: #409eff;
  }
  .instance-info {
    .instance-type { font-size: 11px; color: #909399; margin-bottom: 2px; }
    .instance-name { font-size: 15px; font-weight: 600; color: #303133; }
  }
}
.header-right { display: flex; align-items: center; gap: 8px; }
.drawer-tabs {
  padding: 0 20px; border-bottom: 1px solid #e4e7ed;
  :deep(.el-tabs) {
    .el-tabs__header { margin: 0; }
    .el-tabs__nav-wrap::after { display: none; }
    .el-tabs__item { height: 36px; line-height: 36px; font-size: 13px; }
    .el-tabs__active-bar { background-color: #409eff; height: 2px; }
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
.info-list.horizontal { flex-direction: row; gap: 32px; flex-wrap: wrap; }
.info-row {
  display: flex; align-items: flex-start; padding: 8px 0; font-size: 13px; min-height: 34px;
  .info-label { width: 80px; flex-shrink: 0; color: #909399; line-height: 1.6; }
  .info-value {
    flex: 1; color: #303133; word-break: break-all; line-height: 1.6;
    display: flex; align-items: center; gap: 4px;
    &.mono { font-family: 'JetBrains Mono', monospace; font-size: 12px; }
  }
}
.binding-section { margin-top: 32px; }
.env-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.attributes-table {
  .attr-key { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #606266; }
  .attr-value { font-size: 12px; color: #303133; white-space: pre-wrap; word-break: break-all; }
}
.tags-container { display: flex; flex-wrap: wrap; gap: 12px; }
.tag-item { font-size: 13px; }
</style>

<style lang="scss">
.resource-detail-drawer {
  .el-drawer__body { padding: 0; height: 100%; overflow: hidden; }
}
</style>
