<template>
  <el-drawer
    v-model="visible"
    size="55%"
    :destroy-on-close="false"
    class="vpc-detail-drawer"
  >
    <template #header>
      <div class="drawer-header">
        <div class="header-left">
          <el-icon class="vpc-icon"><Connection /></el-icon>
          <el-tag size="small" type="info">VPC</el-tag>
          <span class="instance-name">{{ instance?.asset_name || '-' }}</span>
          <el-button link type="primary" size="small">
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
                <el-dropdown-item>查看子网</el-dropdown-item>
                <el-dropdown-item>查看路由表</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>
    </template>

    <el-tabs v-model="activeTab" class="detail-tabs">
      <el-tab-pane label="详情" name="detail">
        <div class="detail-content">
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
                  <VpcStatusBadge :status="instance?.status || ''" />
                </span>
              </div>
              <div class="info-item">
                <span class="label">租户</span>
                <span class="value">{{ instance?.tenant_id || '-' }}</span>
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
                <span class="label">共享范围</span>
                <span class="value">{{ instance?.attributes?.share_type || '私有' }}</span>
              </div>
              <div class="info-item">
                <span class="label">平台</span>
                <span class="value">
                  <ProviderIcon :provider="instance?.provider || ''" size="small" />
                </span>
              </div>
              <div class="info-item">
                <span class="label">IPv4目标网段</span>
                <span class="value mono">{{ instance?.attributes?.cidr_block || '-' }}</span>
              </div>
              <div class="info-item">
                <span class="label">二层网络数量</span>
                <span class="value link">{{ instance?.attributes?.vswitch_count || 0 }}</span>
              </div>
              <div class="info-item">
                <span class="label">路由表数量</span>
                <span class="value link">{{ instance?.attributes?.route_table_count || 0 }}</span>
              </div>
              <div class="info-item">
                <span class="label">IP子网数量</span>
                <span class="value link">{{ instance?.attributes?.subnet_count || 0 }}</span>
              </div>
              <div class="info-item">
                <span class="label">nat网关数量</span>
                <span class="value">{{ instance?.attributes?.nat_gateway_count || 0 }}</span>
              </div>
              <div class="info-item">
                <span class="label">允许外网访问</span>
                <span class="value">{{ instance?.attributes?.enable_internet_access ? '启用' : '禁用' }}</span>
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
                <span class="label">云订阅</span>
                <span class="value link">{{ instance?.attributes?.subscription || '-' }}</span>
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
        </div>
      </el-tab-pane>

      <el-tab-pane label="安全组" name="security">
        <el-empty description="安全组功能开发中" />
      </el-tab-pane>

      <el-tab-pane label="IP子网" name="subnet">
        <el-empty description="IP子网功能开发中" />
      </el-tab-pane>

      <el-tab-pane label="路由表" name="route">
        <el-empty description="路由表功能开发中" />
      </el-tab-pane>

      <el-tab-pane label="标签" name="tags">
        <div class="tags-section">
          <div v-if="tagList.length > 0" class="tags-container">
            <el-tag v-for="tag in tagList" :key="tag.key" class="tag-item" size="default">
              {{ tag.key }}: {{ tag.value }}
            </el-tag>
          </div>
          <el-empty v-else description="暂无标签" />
        </div>
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
import { ArrowDown, Connection, Refresh } from '@element-plus/icons-vue'
import { computed, ref } from 'vue'
import VpcStatusBadge from './VpcStatusBadge.vue'

const props = defineProps<{
  visible: boolean
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

const getTagsDisplay = computed(() => {
  const tags = props.instance?.attributes?.tags
  if (!tags) return ''
  if (Array.isArray(tags) && tags.length > 0) return `${tags.length} 个标签`
  if (typeof tags === 'object') return `${Object.keys(tags).length} 个标签`
  return ''
})

const getRegionLabel = computed(() => {
  if (!props.instance) return '-'
  const config = PROVIDER_CONFIGS[props.instance.provider as keyof typeof PROVIDER_CONFIGS]
  const regionItem = config?.regions?.find((r: any) => r.value === props.instance?.region)
  return regionItem?.label || props.instance.region || '-'
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
</script>

<style scoped lang="scss">
.vpc-detail-drawer {
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
    
    .vpc-icon {
      font-size: 20px;
      color: var(--el-color-primary);
    }
    
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
      
      &:nth-child(2n) { border-right: none; }
      &:nth-last-child(-n+2) { border-bottom: none; }
      
      .label {
        flex: 0 0 100px;
        font-size: 13px;
        color: var(--text-secondary);
      }
      
      .value {
        flex: 1;
        font-size: 13px;
        color: var(--text-primary);
        
        &.link {
          color: var(--el-color-primary);
          cursor: pointer;
          &:hover { text-decoration: underline; }
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
  }
}
</style>
