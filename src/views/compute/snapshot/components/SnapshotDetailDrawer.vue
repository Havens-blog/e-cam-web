<template>
  <el-drawer :model-value="visible" :with-header="false" size="50%" :close-on-click-modal="true" class="snapshot-detail-drawer" @update:model-value="$emit('update:visible', $event)">
    <div class="drawer-wrapper">
      <template v-if="instance">
        <div class="drawer-header-area">
          <div class="drawer-header">
            <div class="header-left">
              <div class="close-corner" @click="$emit('update:visible', false)">
                <div class="corner-bg"></div>
                <el-icon class="corner-icon" :size="12"><Close /></el-icon>
              </div>
              <div class="instance-icon">
                <el-icon :size="24"><Camera /></el-icon>
              </div>
              <div class="instance-info">
                <div class="instance-type">快照</div>
                <div class="instance-name">{{ instance.asset_name || instance.asset_id }}</div>
              </div>
            </div>
          </div>
          <div class="drawer-tabs">
            <el-tabs v-model="activeTab">
              <el-tab-pane label="详情" name="detail" />
              <el-tab-pane label="操作日志" name="log" />
            </el-tabs>
          </div>
        </div>
        <div class="drawer-content">
          <template v-if="activeTab === 'detail'">
            <div class="detail-columns">
              <div class="detail-column">
                <div class="column-title">基本信息</div>
                <div class="info-list">
                  <div class="info-row"><span class="info-label">快照ID</span><span class="info-value">{{ instance.asset_id }}</span></div>
                  <div class="info-row"><span class="info-label">名称</span><span class="info-value">{{ instance.asset_name || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">状态</span><span class="info-value"><span class="status-dot" :class="getStatusClass(instance.status)"></span>{{ getStatusText(instance.status) }}</span></div>
                  <div class="info-row"><span class="info-label">云平台</span><span class="info-value"><IconFont :type="getPlatformIcon(instance.provider)" :size="16" />{{ getProviderName(instance.provider) }}</span></div>
                  <div class="info-row"><span class="info-label">区域</span><span class="info-value">{{ instance.region || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">创建时间</span><span class="info-value">{{ formatTime(instance.create_time) }}</span></div>
                </div>
              </div>
              <div class="detail-column">
                <div class="column-title">快照信息</div>
                <div class="info-list">
                  <div class="info-row"><span class="info-label">源云盘ID</span><span class="info-value link">{{ instance.attributes?.source_disk_id || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">源盘容量</span><span class="info-value">{{ instance.attributes?.source_disk_size || '-' }} GB</span></div>
                  <div class="info-row"><span class="info-label">快照类型</span><span class="info-value">{{ instance.attributes?.snapshot_type || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">加密</span><span class="info-value">{{ instance.attributes?.encrypted ? '是' : '否' }}</span></div>
                  <div class="info-row"><span class="info-label">进度</span><span class="info-value">{{ instance.attributes?.progress || '100%' }}</span></div>
                  <div class="info-row"><span class="info-label">描述</span><span class="info-value">{{ instance.attributes?.description || '-' }}</span></div>
                </div>
              </div>
            </div>
          </template>
          <template v-else><div class="empty-tab"><el-icon :size="48"><Document /></el-icon><p class="empty-tab-title">{{ tabPlaceholder.title }}</p>
            <p class="empty-tab-desc">{{ tabPlaceholder.desc }}</p></div></template>
        </div>
      </template>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import type { Asset } from '@/api/types/asset';
import { IconFont } from '@haven/ui/IconFont';
import { getProviderLabel } from '@/utils/constants';
import { Camera, Close, Document } from '@element-plus/icons-vue';
import { ref, computed, watch } from 'vue';
import { getProviderIcon } from '@/utils/icon-mapping'
import { SNAPSHOT_STATUS_LABELS, labelOfLenient } from '@/utils/fieldLabels'
import { formatTime } from '@/utils/formatters'
import { placeholderFor } from '@/composables/tabPlaceholders'

const props = defineProps<{ visible: boolean; instance: Asset | null }>()
defineEmits<{ 'update:visible': [value: boolean] }>()

const activeTab = ref('detail')

/**
 * 切换查看对象时把 tab 复位到「详情」（iter298）。
 *
 * 缺陷（实测）：本抽屉被列表页与 ECS 详情页复用；打开快照 A → 切到「操作日志」→ 关闭 →
 * 打开快照 B 时**仍停在「操作日志」**，而 B 的操作日志是空占位，用户会误以为 B 没有操作记录。
 * 同为详情抽屉的 `DiskDetailDrawer` 已有 `watch(() => props.instance)` 做复位，
 * 这里补齐以保持同类组件行为一致。
 */
watch(
  () => props.instance,
  () => {
    activeTab.value = 'detail'
  },
)

/** 占位标签页的文案（iter212）：原先直接渲染 {{ activeTab }}，会把内部 key 漏给用户 */
const tabPlaceholder = computed(() => placeholderFor(activeTab.value))

const getStatusClass = (status?: string) => { if (!status) return ''; const s = status.toLowerCase(); if (['accomplished', 'available', 'normal', 'completed'].some(k => s.includes(k))) return 'running'; if (s.includes('failed')) return 'error'; return 'pending' }
/** 状态文案走 fieldLabels 单源 SNAPSHOT_STATUS_LABELS——补齐华为 available/腾讯 NORMAL/AWS completed 等厂商成功态(此前抽屉裸显英文) */
const getStatusText = (status?: string) => labelOfLenient(SNAPSHOT_STATUS_LABELS, (status || '').toLowerCase(), '-')
const getPlatformIcon = (provider?: string) => getProviderIcon(provider || '')
const getProviderName = (provider?: string) => (provider ? getProviderLabel(provider) : '-')

</script>

<style scoped lang="scss">
@import '@/views/storage/styles/detail-drawer.scss';
</style>

<style lang="scss">
.snapshot-detail-drawer { .el-drawer__body { padding: 0; height: 100%; overflow: hidden; } }
</style>
