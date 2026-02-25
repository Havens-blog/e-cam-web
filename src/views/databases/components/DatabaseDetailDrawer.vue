<template>
  <el-drawer
    :model-value="visible"
    :with-header="false"
    size="50%"
    :close-on-click-modal="true"
    class="database-detail-drawer"
    @update:model-value="$emit('update:visible', $event)"
  >
    <div class="drawer-wrapper">
      <template v-if="instance">
        <!-- 头部区域（浅灰背景） -->
        <div class="drawer-header-area">
          <!-- 自定义头部 -->
          <div class="drawer-header">
            <div class="close-corner" @click="$emit('update:visible', false)">
              <div class="corner-bg"></div>
              <el-icon class="corner-icon" :size="12"><Close /></el-icon>
            </div>
            <div class="header-left">
              <div class="instance-icon">
                <el-icon :size="24"><Coin /></el-icon>
              </div>
              <div class="instance-info">
                <div class="instance-type">{{ dbTypeLabel }}</div>
                <div class="instance-name">
                  {{ instance.asset_name || instance.asset_id }}
                  <el-button text size="small" @click="handleRefresh">
                    <el-icon><Refresh /></el-icon>
                  </el-button>
                </div>
              </div>
            </div>
            <div class="header-right">
              <el-dropdown trigger="click">
                <el-button size="small">
                  同步状态 <el-icon><ArrowDown /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item>同步状态</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
              <el-dropdown trigger="click">
                <el-button size="small">
                  更多 <el-icon><ArrowDown /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item>查看监控</el-dropdown-item>
                    <el-dropdown-item>查看日志</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </div>

          <!-- 标签页 -->
          <div class="drawer-tabs">
            <el-tabs v-model="activeTab">
              <el-tab-pane label="详情" name="detail" />
              <el-tab-pane label="白名单" name="whitelist" />
              <el-tab-pane label="标签" name="tags" />
              <el-tab-pane label="备份" name="backup" />
              <el-tab-pane label="监控" name="monitor" />
              <el-tab-pane label="任务" name="tasks" />
              <el-tab-pane label="操作日志" name="logs" />
            </el-tabs>
          </div>
        </div>

        <!-- 内容区域 -->
        <div class="drawer-content">
          <template v-if="activeTab === 'detail'">
            <div class="detail-columns">
              <!-- 左列：基本信息 -->
              <div class="detail-column">
                <div class="column-title">基本信息</div>
                <div class="info-list">
                  <div class="info-row">
                    <span class="info-label">云上ID</span>
                    <span class="info-value">{{ instance.asset_id }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">ID</span>
                    <span class="info-value">{{ instance.id }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">名称</span>
                    <span class="info-value">{{ instance.asset_name || '-' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">状态</span>
                    <span class="info-value">
                      <DatabaseStatusBadge :status="instance.status" />
                    </span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">租户</span>
                    <span class="info-value">{{ instance.tenant_id }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">项目</span>
                    <span class="info-value link">{{ instance.attributes?.project || '-' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">云账号</span>
                    <span class="info-value link">{{ instance.attributes?.account_name || '-' }}</span>
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
                    <span class="info-label">计费方式</span>
                    <span class="info-value highlight">{{ getChargeTypeText(instance.attributes?.charge_type) }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">创建时间</span>
                    <span class="info-value">{{ formatTime(instance.create_time) }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">更新时间</span>
                    <span class="info-value">{{ formatTime(instance.update_time) }}</span>
                  </div>
                </div>
              </div>

              <!-- 右列：配置信息 -->
              <div class="detail-column">
                <div class="column-title">配置信息</div>
                <div class="info-list">
                  <div class="info-row">
                    <span class="info-label">类型版本</span>
                    <span class="info-value">{{ instance.attributes?.engine || dbType.toUpperCase() }} {{ instance.attributes?.engine_version || '-' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">节点类型</span>
                    <span class="info-value">{{ getNodeType }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">实例规格</span>
                    <span class="info-value">{{ instance.attributes?.instance_class || '-' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">CPU</span>
                    <span class="info-value">{{ instance.attributes?.cpu || '-' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">内存</span>
                    <span class="info-value">{{ instance.attributes?.memory || '-' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">存储容量</span>
                    <span class="info-value">{{ instance.attributes?.capacity ? instance.attributes.capacity + ' MB' : '-' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">最大连接数</span>
                    <span class="info-value">{{ instance.attributes?.max_connections || '-' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">内网地址</span>
                    <span class="info-value mono">{{ instance.attributes?.connection_string || instance.attributes?.private_ip || '-' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">端口</span>
                    <span class="info-value">{{ instance.attributes?.port || '-' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">VPC</span>
                    <span class="info-value link">{{ instance.attributes?.vpc_id || '-' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">子网</span>
                    <span class="info-value">{{ instance.attributes?.vswitch_id || '-' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">描述</span>
                    <span class="info-value">{{ instance.attributes?.description || '-' }}</span>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <!-- 标签页 -->
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

          <!-- 其他标签页占位 -->
          <template v-else>
            <div class="empty-tab">
              <el-icon :size="48"><Document /></el-icon>
              <p>{{ getTabName(activeTab) }} 功能开发中...</p>
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
import { ArrowDown, Close, Coin, Document, PriceTag, Refresh } from '@element-plus/icons-vue'
import { computed, ref } from 'vue'
import DatabaseStatusBadge from './DatabaseStatusBadge.vue'

type DatabaseType = 'rds' | 'redis' | 'mongodb'

const props = defineProps<{
  visible: boolean
  dbType: DatabaseType
  instance: Asset | null
}>()

defineEmits<{
  'update:visible': [value: boolean]
}>()

const activeTab = ref('detail')

const handleRefresh = () => {
  // 刷新数据
}

const dbTypeLabel = computed(() => {
  const labels: Record<DatabaseType, string> = {
    rds: 'RDS',
    redis: 'Redis',
    mongodb: 'MongoDB',
  }
  return labels[props.dbType]
})

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

const getRegionLabel = computed(() => {
  if (!props.instance) return '-'
  const config = PROVIDER_CONFIGS[props.instance.provider as keyof typeof PROVIDER_CONFIGS]
  const regionItem = config?.regions?.find((r: any) => r.value === props.instance?.region)
  return regionItem?.label || props.instance.region || '-'
})

const getChargeTypeText = (chargeType: string | undefined): string => {
  if (!chargeType) return '-'
  const map: Record<string, string> = {
    PrePaid: '包年包月',
    PostPaid: '按量付费',
    Prepaid: '包年包月',
    Postpaid: '按量付费',
  }
  return map[chargeType] || chargeType
}

const getNodeType = computed(() => {
  if (props.dbType === 'redis') {
    const arch = props.instance?.attributes?.architecture
    const map: Record<string, string> = { standard: '单副本', cluster: '集群', rwsplit: '读写分离' }
    return map[arch] || '单副本'
  }
  if (props.dbType === 'mongodb') {
    const type = props.instance?.attributes?.db_type
    const map: Record<string, string> = { replicate: '副本集', sharding: '分片集群', serverless: 'Serverless' }
    return map[type] || '副本集'
  }
  return props.instance?.attributes?.node_type || '高可用'
})

const tagList = computed(() => {
  if (!props.instance?.attributes?.tags) return []
  const tags = props.instance.attributes.tags
  if (Array.isArray(tags)) {
    return tags.map((tag: any) => ({ key: tag.key || tag.Key, value: tag.value || tag.Value }))
  }
  if (typeof tags === 'object') {
    return Object.entries(tags).map(([key, value]) => ({ key, value }))
  }
  return []
})

const formatTime = (time: number | string | undefined) => {
  if (!time) return '-'
  const ts = typeof time === 'number' ? time : parseInt(time)
  return new Date(ts).toLocaleString('zh-CN')
}

const getTabName = (tab: string) => {
  const map: Record<string, string> = {
    whitelist: '白名单',
    tags: '标签',
    backup: '备份',
    monitor: '监控',
    tasks: '任务',
    logs: '操作日志',
  }
  return map[tab] || tab
}
</script>

<style scoped lang="scss">
.drawer-wrapper {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.drawer-header-area {
  background: #f5f7fa;
  flex-shrink: 0;
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: #f5f7fa;
  position: relative;
}

.close-corner {
  position: absolute;
  top: 0;
  left: 0;
  width: 36px;
  height: 36px;
  cursor: pointer;
  z-index: 10;

  .corner-bg {
    position: absolute;
    top: 0;
    left: 0;
    width: 0;
    height: 0;
    border-style: solid;
    border-width: 36px 36px 0 0;
    border-color: #409eff transparent transparent transparent;
    transition: border-color 0.2s;
  }

  .corner-icon {
    position: absolute;
    top: 6px;
    left: 6px;
    color: #fff;
  }

  &:hover .corner-bg {
    border-color: #66b1ff transparent transparent transparent;
  }
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: 36px;

  .instance-icon {
    width: 40px;
    height: 40px;
    background: #fff;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #409eff;
  }

  .instance-info {
    .instance-type {
      font-size: 11px;
      color: #909399;
      margin-bottom: 2px;
    }

    .instance-name {
      font-size: 15px;
      font-weight: 600;
      color: #303133;
      display: flex;
      align-items: center;
      gap: 4px;
    }
  }
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.drawer-tabs {
  padding: 0 20px;
  background: #f5f7fa;
  border-bottom: 1px solid #e4e7ed;

  :deep(.el-tabs) {
    .el-tabs__header { margin: 0; }
    .el-tabs__nav-wrap::after { display: none; }
    .el-tabs__item {
      height: 36px;
      line-height: 36px;
      font-size: 13px;
      color: #606266;
      padding: 0 14px;
      &.is-active { color: #409eff; }
      &:hover { color: #303133; }
    }
    .el-tabs__active-bar {
      background-color: #409eff;
      height: 2px;
    }
  }
}

.drawer-content {
  padding: 24px 28px;
  flex: 1;
  overflow: auto;
  background: #fff;
}

.detail-columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 48px;
}

.detail-column {
  .column-title {
    font-size: 14px;
    font-weight: 600;
    color: #303133;
    margin-bottom: 16px;
    padding-bottom: 10px;
    border-bottom: 1px solid #ebeef5;
  }
}

.info-list {
  display: flex;
  flex-direction: column;
}

.info-row {
  display: flex;
  align-items: flex-start;
  padding: 8px 0;
  font-size: 13px;
  min-height: 34px;

  .info-label {
    width: 80px;
    flex-shrink: 0;
    color: #909399;
    line-height: 1.6;
  }

  .info-value {
    flex: 1;
    color: #303133;
    word-break: break-all;
    display: flex;
    align-items: center;
    gap: 6px;
    line-height: 1.6;

    &.link {
      color: #409eff;
      cursor: pointer;
      &:hover { text-decoration: underline; }
    }

    &.highlight { color: #409eff; }

    &.mono {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
    }
  }
}

.tags-container {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  .tag-item-large { font-size: 13px; }
}

.empty-tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 300px;
  color: #909399;
  p { margin-top: 16px; }
}
</style>

<style lang="scss">
.database-detail-drawer {
  .el-drawer__body {
    padding: 0;
    height: 100%;
    overflow: hidden;
  }
}
</style>
