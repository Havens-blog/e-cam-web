<template>
  <el-drawer
    :model-value="visible"
    :with-header="false"
    size="50%"
    :close-on-click-modal="true"
    class="sg-detail-drawer"
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
                <div class="instance-type">安全组</div>
                <div class="instance-name">{{ instance.asset_name || instance.asset_id }}</div>
              </div>
            </div>
          </div>
          <div class="drawer-tabs">
            <el-tabs v-model="activeTab">
              <el-tab-pane label="详情" name="detail" />
              <el-tab-pane label="入方向规则" name="ingress" />
              <el-tab-pane label="出方向规则" name="egress" />
              <el-tab-pane label="标签" name="tags" />
            </el-tabs>
          </div>
        </div>

        <div class="drawer-content">
          <template v-if="activeTab === 'detail'">
            <div class="detail-columns">
              <div class="detail-column">
                <div class="column-title">基本信息</div>
                <div class="info-list">
                  <div class="info-row">
                    <span class="info-label">安全组ID</span>
                    <span class="info-value">{{ instance.asset_id }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">名称</span>
                    <span class="info-value">{{ instance.asset_name || '-' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">状态</span>
                    <span class="info-value">{{ instance.status || '-' }}</span>
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
                    <span class="info-label">类型</span>
                    <span class="info-value">{{ instance.attributes?.security_group_type || '-' }}</span>
                  </div>
                </div>
              </div>
              <div class="detail-column">
                <div class="column-title">关联信息</div>
                <div class="info-list">
                  <div class="info-row">
                    <span class="info-label">VPC ID</span>
                    <span class="info-value mono">{{ instance.attributes?.vpc_id || '-' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">描述</span>
                    <span class="info-value">{{ instance.attributes?.description || '-' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">创建时间</span>
                    <span class="info-value">{{ formatTime(instance.attributes?.create_time || instance.create_time) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <template v-else-if="activeTab === 'ingress'">
            <div v-if="ingressRules.length > 0">
              <el-table :data="ingressRules" style="width: 100%" size="small">
                <el-table-column label="协议" width="80" prop="ip_protocol" />
                <el-table-column label="端口范围" width="120" prop="port_range" />
                <el-table-column label="授权对象" min-width="160" show-overflow-tooltip prop="source_cidr_ip" />
                <el-table-column label="策略" width="80" prop="policy" />
                <el-table-column label="描述" min-width="160" show-overflow-tooltip prop="description" />
              </el-table>
            </div>
            <div v-else class="empty-tab">
              <p>暂无入方向规则</p>
            </div>
          </template>

          <template v-else-if="activeTab === 'egress'">
            <div v-if="egressRules.length > 0">
              <el-table :data="egressRules" style="width: 100%" size="small">
                <el-table-column label="协议" width="80" prop="ip_protocol" />
                <el-table-column label="端口范围" width="120" prop="port_range" />
                <el-table-column label="授权对象" min-width="160" show-overflow-tooltip prop="dest_cidr_ip" />
                <el-table-column label="策略" width="80" prop="policy" />
                <el-table-column label="描述" min-width="160" show-overflow-tooltip prop="description" />
              </el-table>
            </div>
            <div v-else class="empty-tab">
              <p>暂无出方向规则</p>
            </div>
          </template>

          <template v-else-if="activeTab === 'tags'">
            <div v-if="tagList.length > 0" class="tags-container">
              <el-tag v-for="tag in tagList" :key="tag.key" size="default">{{ tag.key }}: {{ tag.value }}</el-tag>
            </div>
            <div v-else class="empty-tab"><p>暂无标签</p></div>
          </template>
        </div>
      </template>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import type { Asset } from '@/api/types/asset'
import ProviderIcon from '@/components/ProviderIcon.vue'
import { PROVIDER_CONFIGS, getProviderLabel } from '@/utils/constants'
import { Close, Lock } from '@element-plus/icons-vue'
import { computed, ref } from 'vue'


interface SecurityRule {
  ip_protocol?: string
  port_range?: string
  source_cidr_ip?: string
  dest_cidr_ip?: string
  policy?: string
  description?: string
}

const props = defineProps<{
  visible: boolean
  instance: Asset | null
}>()

defineEmits<{ 'update:visible': [value: boolean] }>()

const activeTab = ref('detail')

/** 云厂商展示名统一走 utils/constants 单源（含 volcengine/bytedance 等变体归一） */
const getProviderName = (provider: string | undefined): string => (provider ? getProviderLabel(provider) : '-')

const getRegionLabel = computed(() => {
  if (!props.instance) return '-'
  const config = PROVIDER_CONFIGS[props.instance.provider as keyof typeof PROVIDER_CONFIGS]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- PROVIDER_CONFIGS regions 类型不精确
  const regionItem = config?.regions?.find((r: any) => r.value === props.instance?.region)
  return regionItem?.label || props.instance.region || '-'
})

const ingressRules = computed<SecurityRule[]>(() => {
  const rules = props.instance?.attributes?.ingress_rules || props.instance?.attributes?.permissions?.permission
  return Array.isArray(rules) ? rules : []
})

const egressRules = computed<SecurityRule[]>(() => {
  const rules = props.instance?.attributes?.egress_rules
  return Array.isArray(rules) ? rules : []
})

const tagList = computed(() => {
  if (!props.instance?.attributes?.tags) return []
  const tags = props.instance.attributes.tags
  if (typeof tags === 'object' && !Array.isArray(tags)) {
    return Object.entries(tags).map(([key, value]) => ({ key, value }))
  }
  return []
})

const formatTime = (time: number | string | undefined) => {
  if (!time) return '-'
  if (typeof time === 'string' && time.includes('-')) return time
  const ts = typeof time === 'number' ? time : parseInt(time)
  if (isNaN(ts)) return time as string
  return new Date(ts).toLocaleString('zh-CN')
}
</script>

<style scoped lang="scss">
.drawer-wrapper { height: 100%; display: flex; flex-direction: column; }
.drawer-header-area { background: var(--glass-bg); flex-shrink: 0; }
.drawer-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 20px; background: var(--glass-bg); position: relative;
}
.close-corner {
  position: absolute; top: 0; left: 0; width: 36px; height: 36px; cursor: pointer; z-index: 10;
  .corner-bg {
    position: absolute; top: 0; left: 0; width: 0; height: 0;
    border-style: solid; border-width: 36px 36px 0 0;
    border-color: var(--el-color-primary) transparent transparent transparent; transition: border-color 0.2s;
  }
  .corner-icon { position: absolute; top: 6px; left: 6px; color: #fff; }
  &:hover .corner-bg { border-color: var(--el-color-primary) transparent transparent transparent; }
}
.header-left {
  display: flex; align-items: center; gap: 12px; margin-left: 36px;
  .instance-icon {
    width: 40px; height: 40px; background: var(--glass-bg); border-radius: 8px;
    display: flex; align-items: center; justify-content: center; color: var(--el-color-primary);
  }
  .instance-info {
    .instance-type { font-size: 11px; color: var(--text-tertiary); margin-bottom: 2px; }
    .instance-name { font-size: 15px; font-weight: 600; color: var(--text-primary); }
  }
}
.drawer-tabs {
  padding: 0 20px; background: var(--glass-bg); border-bottom: 1px solid var(--glass-border);
  :deep(.el-tabs) {
    .el-tabs__header { margin: 0; }
    .el-tabs__nav-wrap::after { display: none; }
    .el-tabs__item { height: 36px; line-height: 36px; font-size: 13px; color: var(--text-secondary); padding: 0 14px;
      &.is-active { color: var(--el-color-primary); } &:hover { color: var(--text-primary); }
    }
    .el-tabs__active-bar { background-color: var(--el-color-primary); height: 2px; }
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
  display: flex; align-items: flex-start; padding: 8px 0; font-size: 13px; min-height: 34px;
  .info-label { width: 80px; flex-shrink: 0; color: var(--text-tertiary); line-height: 1.6; }
  .info-value {
    flex: 1; color: var(--text-primary); word-break: break-all; display: flex; align-items: center; gap: 6px; line-height: 1.6;
    &.mono { font-family: 'JetBrains Mono', monospace; font-size: 12px; }
  }
}
.tags-container { display: flex; flex-wrap: wrap; gap: 12px; }
.empty-tab {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  height: 200px; color: var(--text-tertiary); p { margin-top: 16px; }
}
</style>

<style lang="scss">
.sg-detail-drawer {
  .el-drawer__body { padding: 0; height: 100%; overflow: hidden; }
}
</style>
