<template>
  <el-drawer :model-value="visible" :with-header="false" size="50%" :close-on-click-modal="true" class="disk-detail-drawer" @update:model-value="$emit('update:visible', $event)">
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
                <el-icon :size="24"><Box /></el-icon>
              </div>
              <div class="instance-info">
                <div class="instance-type">云盘</div>
                <div class="instance-name">{{ instance.asset_name || instance.asset_id }}</div>
              </div>
            </div>
          </div>
          <div class="drawer-tabs">
            <el-tabs v-model="activeTab">
              <el-tab-pane label="详情" name="detail" />
              <el-tab-pane label="快照" name="snapshot" />
              <el-tab-pane label="监控" name="monitor" />
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
                  <div class="info-row"><span class="info-label">云盘ID</span><span class="info-value">{{ instance.asset_id }}</span></div>
                  <div class="info-row"><span class="info-label">名称</span><span class="info-value">{{ instance.asset_name || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">状态</span><span class="info-value"><span class="status-dot" :class="getStatusClass(instance.status)"></span>{{ getStatusText(instance.status) }}</span></div>
                  <div class="info-row"><span class="info-label">磁盘类型</span><span class="info-value">{{ instance.attributes?.disk_type === 'system' ? '系统盘' : '数据盘' }}</span></div>
                  <div class="info-row"><span class="info-label">云平台</span><span class="info-value"><IconFont :type="getPlatformIcon(instance.provider)" :size="16" />{{ getProviderName(instance.provider) }}</span></div>
                  <div class="info-row"><span class="info-label">区域</span><span class="info-value">{{ instance.region || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">可用区</span><span class="info-value">{{ instance.attributes?.zone || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">创建时间</span><span class="info-value">{{ formatTime(instance.create_time) }}</span></div>
                </div>
              </div>
              <div class="detail-column">
                <div class="column-title">配置信息</div>
                <div class="info-list">
                  <div class="info-row"><span class="info-label">容量</span><span class="info-value">{{ instance.attributes?.size || '-' }} GB</span></div>
                  <div class="info-row"><span class="info-label">云盘类型</span><span class="info-value">{{ getDiskCategory(instance.attributes?.category) }}</span></div>
                  <div class="info-row"><span class="info-label">挂载实例</span><span class="info-value link">{{ instance.attributes?.instance_id || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">挂载点</span><span class="info-value">{{ instance.attributes?.device || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">是否加密</span><span class="info-value">{{ instance.attributes?.encrypted ? '是' : '否' }}</span></div>
                  <div class="info-row"><span class="info-label">IOPS</span><span class="info-value">{{ instance.attributes?.iops || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">吞吐量</span><span class="info-value">{{ instance.attributes?.throughput ? `${instance.attributes.throughput} MB/s` : '-' }}</span></div>
                  <div class="info-row"><span class="info-label">描述</span><span class="info-value">{{ instance.attributes?.description || '-' }}</span></div>
                </div>
              </div>
            </div>
          </template>
          <template v-else><div class="empty-tab"><el-icon :size="48"><Document /></el-icon><p>{{ activeTab }} 功能开发中...</p></div></template>
        </div>
      </template>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import type { Asset } from '@/api/types/asset';
import IconFont from '@/components/IconFont/index.vue';
import { Box, Close, Document } from '@element-plus/icons-vue';
import { ref } from 'vue';

defineProps<{ visible: boolean; instance: Asset | null }>()
defineEmits<{ 'update:visible': [value: boolean] }>()

const activeTab = ref('detail')

const getStatusClass = (status?: string) => { if (!status) return ''; const s = status.toLowerCase(); if (s.includes('use')) return 'running'; if (s.includes('available')) return 'stopped'; return 'pending' }
const getStatusText = (status?: string) => { if (!status) return '-'; const map: Record<string, string> = { in_use: '使用中', available: '可用', creating: '创建中' }; return map[status.toLowerCase()] || status }
const getDiskCategory = (category?: string) => { if (!category) return '-'; const map: Record<string, string> = { cloud_efficiency: '高效云盘', cloud_ssd: 'SSD云盘', cloud_essd: 'ESSD云盘', cloud: '普通云盘' }; return map[category] || category }
const getPlatformIcon = (provider?: string) => { if (!provider) return 'Alibaba_Cloud'; const p = provider.toLowerCase(); if (p.includes('aliyun')) return 'Alibaba_Cloud'; if (p.includes('tencent')) return 'Tencent_Cloud'; if (p.includes('huawei')) return 'Huawei_Cloud'; if (p.includes('aws')) return 'AWS'; if (p.includes('volcano')) return 'Bytecloud'; return 'Alibaba_Cloud' }
const getProviderName = (provider?: string) => { if (!provider) return '-'; const p = provider.toLowerCase(); if (p.includes('aliyun')) return '阿里云'; if (p.includes('tencent')) return '腾讯云'; if (p.includes('huawei')) return '华为云'; if (p.includes('aws')) return 'AWS'; if (p.includes('volcano')) return '火山引擎'; return provider }
const formatTime = (time?: number) => time ? new Date(time).toLocaleString('zh-CN') : '-'
</script>

<style scoped lang="scss">
@import '@/views/storage/styles/detail-drawer.scss';
</style>

<style lang="scss">
.disk-detail-drawer { .el-drawer__body { padding: 0; height: 100%; overflow: hidden; } }
</style>
