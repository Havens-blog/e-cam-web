<template>
  <el-drawer
    v-model="visible"
    :title="drawerTitle"
    size="55%"
    :destroy-on-close="false"
    class="database-detail-drawer"
  >
    <template #header>
      <div class="drawer-header">
        <div class="header-left">
          <el-tag size="small" type="info">{{ dbTypeLabel }}</el-tag>
          <span class="instance-name">{{ instance?.asset_name || '-' }}</span>
          <el-button link type="primary" size="small" @click="handleRefresh">
            <el-icon><Refresh /></el-icon>
          </el-button>
        </div>
        <div class="header-actions">
          <el-dropdown trigger="click">
            <el-button type="primary" link>
              同步状态
              <el-icon class="el-icon--right"><ArrowDown /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item>同步状态</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <el-dropdown trigger="click">
            <el-button link>
              更多
              <el-icon class="el-icon--right"><ArrowDown /></el-icon>
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
    </template>

    <el-tabs v-model="activeTab" class="detail-tabs">
      <el-tab-pane label="详情" name="detail">
        <div class="detail-content">
          <!-- 基本信息 -->
          <div class="info-section">
            <div class="section-title">基本信息</div>
            <div class="info-grid">
              <div class="info-item">
                <span class="label">云上ID</span>
                <span class="value">{{ instance?.asset_id || '-' }}</span>
              </div>
              <div class="info-item">
                <span class="label">ID</span>
                <span class="value">{{ instance?.id || '-' }}</span>
              </div>
              <div class="info-item">
                <span class="label">名称</span>
                <span class="value">{{ instance?.asset_name || '-' }}</span>
              </div>
              <div class="info-item">
                <span class="label">状态</span>
                <span class="value">
                  <DatabaseStatusBadge :status="instance?.status || ''" />
                </span>
              </div>
              <div class="info-item">
                <span class="label">租户</span>
                <span class="value">{{ instance?.tenant_id || '-' }}</span>
              </div>
              <div class="info-item">
                <span class="label">项目</span>
                <span class="value link">{{ instance?.attributes?.project || '-' }}</span>
              </div>
              <div class="info-item">
                <span class="label">标签</span>
                <span class="value">
                  <el-tag v-if="instance?.attributes?.tags" size="small" type="info">
                    {{ getTagsDisplay }}
                  </el-tag>
                  <span v-else>-</span>
                </span>
              </div>
              <div class="info-item">
                <span class="label">平台</span>
                <span class="value">
                  <ProviderIcon :provider="instance?.provider || ''" size="small" />
                </span>
              </div>
              <div class="info-item">
                <span class="label">计费方式</span>
                <span class="value">
                  <el-tag :type="instance?.attributes?.charge_type === 'Prepaid' ? 'warning' : 'info'" size="small">
                    {{ instance?.attributes?.charge_type === 'Prepaid' ? '包年包月' : '按量付费' }}
                  </el-tag>
                </span>
              </div>
              <div class="info-item">
                <span class="label">可用区</span>
                <span class="value">{{ instance?.attributes?.zone || '-' }}</span>
              </div>
              <div class="info-item">
                <span class="label">区域</span>
                <span class="value">{{ getRegionLabel }}</span>
              </div>
              <div class="info-item">
                <span class="label">云账号</span>
                <span class="value link">{{ instance?.attributes?.account_name || '-' }}</span>
              </div>
              <div class="info-item">
                <span class="label">创建时间</span>
                <span class="value">{{ formatTime(instance?.create_time) }}</span>
              </div>
              <div class="info-item">
                <span class="label">更新时间</span>
                <span class="value">{{ formatTime(instance?.update_time) }}</span>
              </div>
              <div class="info-item">
                <span class="label">备注</span>
                <span class="value">{{ instance?.attributes?.description || '-' }}</span>
              </div>
            </div>
          </div>

          <!-- 数据库信息 -->
          <div class="info-section">
            <div class="section-title">数据库信息</div>
            <div class="info-grid">
              <div class="info-item">
                <span class="label">类型版本</span>
                <span class="value">{{ instance?.attributes?.engine || dbType.toUpperCase() }} {{ instance?.attributes?.engine_version || '-' }}</span>
              </div>
              <div class="info-item">
                <span class="label">节点类型</span>
                <span class="value">{{ getNodeType }}</span>
              </div>
              <div class="info-item">
                <span class="label">性能类型</span>
                <span class="value">{{ instance?.attributes?.performance_type || '-' }}</span>
              </div>
              <div class="info-item">
                <span class="label">可维护时间段</span>
                <span class="value">{{ instance?.attributes?.maintain_time || '-' }}</span>
              </div>
              <div class="info-item">
                <span class="label">实例规格</span>
                <span class="value">{{ instance?.attributes?.instance_class || '-' }}</span>
              </div>
              <div class="info-item">
                <span class="label">CPU</span>
                <span class="value">{{ instance?.attributes?.cpu || '-' }}</span>
              </div>
              <div class="info-item">
                <span class="label">缓存容量</span>
                <span class="value">{{ instance?.attributes?.capacity ? instance.attributes.capacity + ' MB' : '-' }}</span>
              </div>
              <div class="info-item">
                <span class="label">内存</span>
                <span class="value">{{ instance?.attributes?.memory || '-' }}</span>
              </div>
              <div class="info-item">
                <span class="label">最大连接数</span>
                <span class="value">{{ instance?.attributes?.max_connections || '-' }}</span>
              </div>
              <div class="info-item">
                <span class="label">最大吞吐带宽</span>
                <span class="value">{{ instance?.attributes?.bandwidth || '-' }}</span>
              </div>
            </div>
          </div>

          <!-- 链接信息 -->
          <div class="info-section">
            <div class="section-title">链接信息</div>
            <div class="info-grid">
              <div class="info-item full-width">
                <span class="label">内网地址</span>
                <span class="value mono">{{ instance?.attributes?.connection_string || instance?.attributes?.private_ip || '-' }}</span>
              </div>
              <div class="info-item">
                <span class="label">外网地址</span>
                <span class="value mono">{{ instance?.attributes?.public_ip || '-' }}</span>
              </div>
              <div class="info-item">
                <span class="label">VPC</span>
                <span class="value">{{ instance?.attributes?.vpc_id || '-' }}</span>
              </div>
              <div class="info-item">
                <span class="label">子网</span>
                <span class="value">{{ instance?.attributes?.vswitch_id || '-' }}</span>
              </div>
              <div class="info-item">
                <span class="label">访问方式</span>
                <span class="value">{{ instance?.attributes?.access_type || '密码访问' }}</span>
              </div>
            </div>
          </div>

          <!-- 其他信息 -->
          <div class="info-section">
            <div class="section-title">其他信息</div>
            <div class="info-grid">
              <div class="info-item">
                <span class="label">服务保障</span>
                <span class="value">
                  <el-tag size="small" type="success">开</el-tag>
                </span>
              </div>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane label="白名单设置" name="whitelist">
        <el-empty description="白名单设置功能开发中" />
      </el-tab-pane>

      <el-tab-pane label="标签管理" name="tags">
        <div class="tags-section">
          <div v-if="tagList.length > 0" class="tags-container">
            <el-tag v-for="tag in tagList" :key="tag.key" class="tag-item" size="default">
              {{ tag.key }}: {{ tag.value }}
            </el-tag>
          </div>
          <el-empty v-else description="暂无标签" />
        </div>
      </el-tab-pane>

      <el-tab-pane label="备份列表" name="backup">
        <el-empty description="备份列表功能开发中" />
      </el-tab-pane>

      <el-tab-pane label="监控" name="monitor">
        <el-empty description="监控功能开发中" />
      </el-tab-pane>

      <el-tab-pane label="任务" name="tasks">
        <el-empty description="任务列表功能开发中" />
      </el-tab-pane>

      <el-tab-pane label="操作日志" name="logs">
        <el-empty description="操作日志功能开发中" />
      </el-tab-pane>
    </el-tabs>
  </el-drawer>
</template>

<script setup lang="ts">
import type { Asset } from '@/api/types/asset'
import ProviderIcon from '@/components/ProviderIcon.vue'
import { PROVIDER_CONFIGS } from '@/utils/constants'
import { ArrowDown, Refresh } from '@element-plus/icons-vue'
import { computed, ref } from 'vue'
import DatabaseStatusBadge from './DatabaseStatusBadge.vue'

type DatabaseType = 'rds' | 'redis' | 'mongodb'

const props = defineProps<{
  visible: boolean
  dbType: DatabaseType
  instance: Asset | null
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
}>()

const visible = computed({
  get: () => props.visible,
  set: (val) => emit('update:visible', val)
})

const activeTab = ref('detail')

const dbTypeLabel = computed(() => {
  const labels: Record<DatabaseType, string> = {
    rds: 'RDS',
    redis: 'Redis',
    mongodb: 'MongoDB',
  }
  return labels[props.dbType]
})

const drawerTitle = computed(() => props.instance?.asset_name || '实例详情')

const getTagsDisplay = computed(() => {
  const tags = props.instance?.attributes?.tags
  if (!tags) return ''
  if (Array.isArray(tags) && tags.length > 0) {
    return `${tags.length} 个标签`
  }
  if (typeof tags === 'object') {
    return `${Object.keys(tags).length} 个标签`
  }
  return ''
})

const getRegionLabel = computed(() => {
  if (!props.instance) return '-'
  const config = PROVIDER_CONFIGS[props.instance.provider as keyof typeof PROVIDER_CONFIGS]
  const regionItem = config?.regions?.find((r: any) => r.value === props.instance?.region)
  return regionItem?.label || props.instance.region || '-'
})

const getNodeType = computed(() => {
  if (props.dbType === 'redis') {
    const arch = props.instance?.attributes?.architecture
    const map: Record<string, string> = { standard: '单副本', cluster: '集群', rwsplit: '读写分离' }
    return map[arch] || '单副本'
  }
  return props.instance?.attributes?.node_type || '-'
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

const handleRefresh = () => {
  // TODO: 刷新实例详情
}
</script>

<style scoped lang="scss">
.database-detail-drawer {
  :deep(.el-drawer__header) {
    margin-bottom: 0;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-subtle);
  }
  
  :deep(.el-drawer__body) {
    padding: 0;
  }
}

.drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  
  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;
    
    .instance-name {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary);
    }
  }
  
  .header-actions {
    display: flex;
    gap: 16px;
  }
}

.detail-tabs {
  height: 100%;
  
  :deep(.el-tabs__header) {
    margin: 0;
    padding: 0 20px;
    background: var(--bg-elevated);
    border-bottom: 1px solid var(--border-subtle);
  }
  
  :deep(.el-tabs__content) {
    padding: 20px;
    height: calc(100% - 40px);
    overflow-y: auto;
  }
}

.detail-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.info-section {
  .section-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 16px;
    padding-left: 12px;
    border-left: 3px solid var(--el-color-primary);
  }
  
  .info-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0;
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    border-radius: 8px;
    overflow: hidden;
    
    .info-item {
      display: flex;
      padding: 12px 16px;
      border-bottom: 1px solid var(--border-subtle);
      border-right: 1px solid var(--border-subtle);
      
      &:nth-child(2n) {
        border-right: none;
      }
      
      &:nth-last-child(-n+2) {
        border-bottom: none;
      }
      
      &.full-width {
        grid-column: span 2;
        border-right: none;
      }
      
      .label {
        flex: 0 0 100px;
        font-size: 13px;
        color: var(--text-secondary);
      }
      
      .value {
        flex: 1;
        font-size: 13px;
        color: var(--text-primary);
        word-break: break-all;
        
        &.link {
          color: var(--el-color-primary);
          cursor: pointer;
          
          &:hover {
            text-decoration: underline;
          }
        }
        
        &.mono {
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
        }
      }
    }
  }
}

.tags-section {
  .tags-container {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    
    .tag-item {
      font-size: 13px;
    }
  }
}
</style>
