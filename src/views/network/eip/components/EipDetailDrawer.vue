<template>
  <el-drawer
    :model-value="visible"
    :with-header="false"
    size="50%"
    :close-on-click-modal="true"
    class="eip-detail-drawer"
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
                <el-icon :size="24"><Position /></el-icon>
              </div>
              <div class="instance-info">
                <div class="instance-type">弹性公网IP</div>
                <div class="instance-name">
                  {{ instance.asset_name || instance.asset_id }}
                  <!-- F-EIP-03：handleRefresh 为空实现（单实例刷新未接线），按主题 B 决策禁用 + tooltip -->
                  <el-tooltip content="功能开发中" placement="top">
                    <el-button text size="small" disabled @click="handleRefresh">
                      <el-icon><Refresh /></el-icon>
                    </el-button>
                  </el-tooltip>
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
                    <!-- F-EIP-02：菜单无处理器，按主题 B 决策禁用 + title -->
                    <el-dropdown-item disabled title="功能开发中">同步状态</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
              <el-dropdown trigger="click">
                <el-button size="small">
                  更多 <el-icon><ArrowDown /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <!-- F-EIP-02：绑定/解绑实例未实现（解绑属危险操作，实现时须二次确认），禁用 + title -->
                    <el-dropdown-item disabled title="功能开发中">绑定实例</el-dropdown-item>
                    <el-dropdown-item disabled title="功能开发中">解绑实例</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </div>

          <!-- 标签页 -->
          <div class="drawer-tabs">
            <el-tabs v-model="activeTab">
              <el-tab-pane label="详情" name="detail" />
              <el-tab-pane label="标签" name="tags" />
              <el-tab-pane label="监控" name="monitor" />
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
                      <AssetStatusBadge :status="instance.status" :labels="statusLabels" :tones="statusTones" />
                    </span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">IP地址</span>
                    <span class="info-value mono">{{ instance.attributes?.ip_address || '-' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">租户</span>
                    <span class="info-value">{{ instance.tenant_id }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">云账号</span>
                    <!-- F-EIP-07：假链接（无点击行为），去掉 link 样式避免误导 -->
                    <span class="info-value">{{ instance.attributes?.account_name || '-' }}</span>
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
                    <span class="info-label">带宽</span>
                    <span class="info-value">{{ instance.attributes?.bandwidth ? instance.attributes.bandwidth + ' Mbps' : '-' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">计费方式</span>
                    <span class="info-value highlight">{{ getChargeTypeText(instance.attributes?.charge_type) }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">绑定实例</span>
                    <span class="info-value">{{ instance.attributes?.instance_id || '-' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">实例类型</span>
                    <span class="info-value">{{ getInstanceTypeLabel(instance.attributes?.instance_type) }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">网络类型</span>
                    <span class="info-value">{{ instance.attributes?.network_type || 'VPC' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">到期时间</span>
                    <span class="info-value">{{ formatTime(instance.attributes?.expired_time) }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">标签</span>
                    <span class="info-value tags">
                      <template v-if="tagList.length > 0">
                        <span v-for="tag in tagList.slice(0, 3)" :key="tag.key" class="tag-item">
                          {{ tag.key }}: {{ tag.value }}
                        </span>
                        <span v-if="tagList.length > 3" class="tag-more">+{{ tagList.length - 3 }}</span>
                      </template>
                      <span v-else>-</span>
                    </span>
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
import { ArrowDown, Close, Document, Position, PriceTag, Refresh } from '@element-plus/icons-vue'
import { computed, ref } from 'vue'
import AssetStatusBadge from '@/components/AssetStatusBadge.vue'

/** 状态值 → 展示文案/色调(共享 AssetStatusBadge 映射) */
const statusLabels: Record<string, string> = {
  InUse: '已绑定', inuse: '已绑定', '已绑定': '已绑定',
  Available: '未绑定', available: '未绑定', '未绑定': '未绑定',
  Bindable: '可绑定',
}
const statusTones: Record<string, string> = {
  InUse: 'active', inuse: 'active', '已绑定': 'active',
  Available: 'inactive', available: 'inactive', '未绑定': 'inactive',
  Bindable: 'pending',
}


const props = defineProps<{
  visible: boolean
  instance: Asset | null
}>()

defineEmits<{
  'update:visible': [value: boolean]
}>()

const activeTab = ref('detail')

const handleRefresh = () => {
  // 刷新数据
}

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

const getInstanceTypeLabel = (type: string | undefined) => {
  const map: Record<string, string> = {
    EcsInstance: 'ECS实例',
    SlbInstance: '负载均衡',
    NatGateway: 'NAT网关',
    HaVip: '高可用VIP',
    NetworkInterface: '弹性网卡',
  }
  return map[type || ''] || type || '-'
}

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
    tags: '标签',
    monitor: '监控',
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

    // F-EIP-07：两处假链接已去 link 样式，原 .link 变体随之移除
    &.highlight { color: #409eff; }

    &.mono {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
    }

    &.tags {
      flex-wrap: wrap;
      gap: 4px;
      .tag-item {
        padding: 2px 8px;
        background: #f0f2f5;
        border-radius: 4px;
        font-size: 12px;
        color: #606266;
      }
      .tag-more {
        color: #409eff;
        font-size: 12px;
      }
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
.eip-detail-drawer {
  .el-drawer__body {
    padding: 0;
    height: 100%;
    overflow: hidden;
  }
}
</style>
