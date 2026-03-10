<template>
  <el-drawer :model-value="visible" :with-header="false" size="50%" :close-on-click-modal="true" class="waf-detail-drawer" @update:model-value="$emit('update:visible', $event)">
    <div class="drawer-wrapper">
      <template v-if="instance">
        <div class="drawer-header-area">
          <div class="drawer-header">
            <div class="close-corner" @click="$emit('update:visible', false)">
              <div class="corner-bg"></div>
              <el-icon class="corner-icon" :size="12"><Close /></el-icon>
            </div>
            <div class="header-left">
              <div class="instance-icon"><el-icon :size="24"><Lock /></el-icon></div>
              <div class="instance-info">
                <div class="instance-type">WAF 防火墙</div>
                <div class="instance-name">{{ instance.asset_name || instance.asset_id }}</div>
              </div>
            </div>
          </div>
          <div class="drawer-tabs">
            <el-tabs v-model="activeTab">
              <el-tab-pane label="详情" name="detail" />
              <el-tab-pane label="防护规则" name="rules" />
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
                  <div class="info-row"><span class="info-label">实例ID</span><span class="info-value">{{ instance.asset_id }}</span></div>
                  <div class="info-row"><span class="info-label">名称</span><span class="info-value">{{ instance.asset_name || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">状态</span><span class="info-value"><WafStatusBadge :status="instance.status" /></span></div>
                  <div class="info-row"><span class="info-label">版本</span><span class="info-value">{{ getEditionLabel(instance.attributes?.edition) }}</span></div>
                  <div class="info-row"><span class="info-label">云平台</span><span class="info-value"><ProviderIcon :provider="instance.provider" size="small" /> {{ getProviderName(instance.provider) }}</span></div>
                  <div class="info-row"><span class="info-label">区域</span><span class="info-value">{{ instance.region || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">创建时间</span><span class="info-value">{{ instance.attributes?.creation_time || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">过期时间</span><span class="info-value">{{ instance.attributes?.expired_time || '-' }}</span></div>
                </div>
              </div>
              <div class="detail-column">
                <div class="column-title">防护能力</div>
                <div class="info-list">
                  <div class="info-row"><span class="info-label">防护域名</span><span class="info-value">{{ instance.attributes?.domain_count || 0 }} / {{ instance.attributes?.domain_limit || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">自定义规则</span><span class="info-value">{{ instance.attributes?.rule_count || 0 }}</span></div>
                  <div class="info-row"><span class="info-label">QPS配额</span><span class="info-value">{{ instance.attributes?.qps || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">带宽</span><span class="info-value">{{ instance.attributes?.bandwidth ? instance.attributes.bandwidth + ' Mbps' : '-' }}</span></div>
                  <div class="info-row"><span class="info-label">Web防护</span><span class="info-value">{{ instance.attributes?.waf_enabled ? '已开启' : '未开启' }}</span></div>
                  <div class="info-row"><span class="info-label">CC防护</span><span class="info-value">{{ instance.attributes?.cc_enabled ? '已开启' : '未开启' }}</span></div>
                  <div class="info-row"><span class="info-label">Bot防护</span><span class="info-value">{{ instance.attributes?.anti_bot_enabled ? '已开启' : '未开启' }}</span></div>
                </div>
              </div>
            </div>
          </template>
          <template v-else-if="activeTab === 'tags'">
            <div v-if="tagList.length > 0" class="tags-container">
              <el-tag v-for="tag in tagList" :key="tag.key" size="default">{{ tag.key }}: {{ tag.value }}</el-tag>
            </div>
            <div v-else class="empty-tab"><el-icon :size="48"><PriceTag /></el-icon><p>暂无标签</p></div>
          </template>
          <template v-else>
            <div class="empty-tab"><el-icon :size="48"><Document /></el-icon><p>防护规则功能开发中...</p></div>
          </template>
        </div>
      </template>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import type { Asset } from '@/api/types/asset'
import ProviderIcon from '@/components/ProviderIcon.vue'
import { Close, Document, PriceTag } from '@element-plus/icons-vue'
import { computed, ref } from 'vue'
import WafStatusBadge from './WafStatusBadge.vue'

const props = defineProps<{ visible: boolean; instance: Asset | null }>()
defineEmits<{ 'update:visible': [value: boolean] }>()
const activeTab = ref('detail')

const getEditionLabel = (edition: string | undefined) => {
  const map: Record<string, string> = { basic: '基础版', pro: '专业版', business: '商业版', enterprise: '企业版' }
  return map[edition || ''] || edition || '-'
}
const getProviderName = (provider: string | undefined): string => {
  if (!provider) return '-'
  const p = provider.toLowerCase()
  if (p.includes('aliyun')) return '阿里云'; if (p.includes('tencent')) return '腾讯云'
  if (p.includes('huawei')) return '华为云'; if (p.includes('aws')) return 'AWS'
  if (p.includes('volc')) return '火山引擎'; return provider
}
const tagList = computed(() => {
  if (!props.instance?.attributes?.tags) return []
  const tags = props.instance.attributes.tags
  if (typeof tags === 'object' && !Array.isArray(tags)) return Object.entries(tags).map(([key, value]) => ({ key, value }))
  return []
})
</script>

<style scoped lang="scss">
.drawer-wrapper { height: 100%; display: flex; flex-direction: column; }
.drawer-header-area { background: #f5f7fa; flex-shrink: 0; }
.drawer-header { display: flex; align-items: center; padding: 12px 20px; position: relative; }
.close-corner { position: absolute; top: 0; left: 0; width: 36px; height: 36px; cursor: pointer; z-index: 10;
  .corner-bg { position: absolute; top: 0; left: 0; width: 0; height: 0; border-style: solid; border-width: 36px 36px 0 0; border-color: #409eff transparent transparent transparent; transition: border-color 0.2s; }
  .corner-icon { position: absolute; top: 6px; left: 6px; color: #fff; }
  &:hover .corner-bg { border-color: #66b1ff transparent transparent transparent; }
}
.header-left { display: flex; align-items: center; gap: 12px; margin-left: 36px;
  .instance-icon { width: 40px; height: 40px; background: #fff; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #409eff; }
  .instance-info { .instance-type { font-size: 11px; color: #909399; margin-bottom: 2px; } .instance-name { font-size: 15px; font-weight: 600; color: #303133; } }
}
.drawer-tabs { padding: 0 20px; border-bottom: 1px solid #e4e7ed;
  :deep(.el-tabs) { .el-tabs__header { margin: 0; } .el-tabs__nav-wrap::after { display: none; } .el-tabs__item { height: 36px; line-height: 36px; font-size: 13px; } }
}
.drawer-content { padding: 24px 28px; flex: 1; overflow: auto; background: #fff; }
.detail-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; }
.detail-column { .column-title { font-size: 14px; font-weight: 600; color: #303133; margin-bottom: 16px; padding-bottom: 10px; border-bottom: 1px solid #ebeef5; } }
.info-list { display: flex; flex-direction: column; }
.info-row { display: flex; align-items: flex-start; padding: 8px 0; font-size: 13px;
  .info-label { width: 80px; flex-shrink: 0; color: #909399; } .info-value { flex: 1; color: #303133; word-break: break-all; }
}
.tags-container { display: flex; flex-wrap: wrap; gap: 12px; }
.empty-tab { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 300px; color: #909399; p { margin-top: 16px; } }
</style>
<style lang="scss">.waf-detail-drawer { .el-drawer__body { padding: 0; height: 100%; overflow: hidden; } }</style>
