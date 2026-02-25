<template>
  <el-drawer :model-value="visible" :with-header="false" size="50%" :close-on-click-modal="true" class="es-detail-drawer" @update:model-value="$emit('update:visible', $event)">
    <div class="drawer-wrapper">
      <template v-if="instance">
        <div class="drawer-header-area">
          <div class="drawer-header">
            <div class="header-left">
              <div class="close-corner" @click="$emit('update:visible', false)">
                <div class="corner-bg"></div>
                <el-icon class="corner-icon" :size="12"><Close /></el-icon>
              </div>
              <div class="instance-icon"><IconFont type="caise-middleware" :size="24" /></div>
              <div class="instance-info">
                <div class="instance-type">Elasticsearch 搜索服务</div>
                <div class="instance-name">{{ instance.asset_name || instance.asset_id }}</div>
              </div>
            </div>
          </div>
          <div class="drawer-tabs">
            <el-tabs v-model="activeTab">
              <el-tab-pane label="详情" name="detail" />
              <el-tab-pane label="索引" name="index" />
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
                  <div class="info-row"><span class="info-label">云上ID</span><span class="info-value">{{ instance.asset_id }}</span></div>
                  <div class="info-row"><span class="info-label">名称</span><span class="info-value">{{ instance.asset_name || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">状态</span><span class="info-value"><span class="status-dot" :class="getStatusClass(instance.attributes?.status)"></span>{{ getStatusText(instance.attributes?.status) }}</span></div>
                  <div class="info-row"><span class="info-label">版本</span><span class="info-value">ES {{ instance.attributes?.version || instance.attributes?.es_version || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">云平台</span><span class="info-value"><IconFont :type="getPlatformIcon(instance.attributes?.provider)" :size="16" /> {{ getProviderName(instance.attributes?.provider) }}</span></div>
                  <div class="info-row"><span class="info-label">区域</span><span class="info-value">{{ instance.attributes?.region || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">可用区</span><span class="info-value">{{ instance.attributes?.zone || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">创建时间</span><span class="info-value">{{ formatDateTime(instance.attributes?.creation_time) || formatTime(instance.create_time) }}</span></div>
                </div>
              </div>
              <div class="detail-column">
                <div class="column-title">配置信息</div>
                <div class="info-list">
                  <div class="info-row"><span class="info-label">规格</span><span class="info-value">{{ instance.attributes?.spec || instance.attributes?.instance_type || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">节点数量</span><span class="info-value">{{ instance.attributes?.node_amount || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">存储容量</span><span class="info-value">{{ instance.attributes?.disk_size || '-' }} GB</span></div>
                  <div class="info-row"><span class="info-label">存储类型</span><span class="info-value">{{ instance.attributes?.disk_type || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">公网地址</span><span class="info-value">{{ instance.attributes?.public_domain || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">内网地址</span><span class="info-value">{{ instance.attributes?.private_domain || instance.attributes?.endpoint || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">VPC</span><span class="info-value link">{{ instance.attributes?.vpc_id || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">Kibana</span><span class="info-value">{{ instance.attributes?.kibana_domain || '-' }}</span></div>
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
import { Close, Document } from '@element-plus/icons-vue';
import { ref } from 'vue';

defineProps<{ visible: boolean; instance: Asset | null }>()
defineEmits<{ 'update:visible': [value: boolean] }>()

const activeTab = ref('detail')

const getStatusClass = (status?: string) => { if (!status) return ''; const s = status.toLowerCase(); if (['running', 'active'].includes(s)) return 'running'; if (['stopped', 'inactive'].includes(s)) return 'stopped'; return 'pending' }
const getStatusText = (status?: string) => { if (!status) return '-'; const map: Record<string, string> = { running: '运行中', active: '运行中', stopped: '已停止' }; return map[status.toLowerCase()] || status }
const getPlatformIcon = (provider?: string) => { if (!provider) return 'Alibaba_Cloud'; const p = provider.toLowerCase(); if (p.includes('aliyun') || p.includes('alibaba')) return 'Alibaba_Cloud'; if (p.includes('tencent')) return 'Tencent_Cloud'; if (p.includes('huawei')) return 'Huawei_Cloud'; if (p.includes('aws')) return 'AWS'; if (p.includes('volcano')) return 'Bytecloud'; return 'Alibaba_Cloud' }
const getProviderName = (provider?: string) => { if (!provider) return '-'; const p = provider.toLowerCase(); if (p.includes('aliyun') || p.includes('alibaba')) return '阿里云'; if (p.includes('tencent')) return '腾讯云'; if (p.includes('huawei')) return '华为云'; if (p.includes('aws')) return 'AWS'; if (p.includes('volcano')) return '火山引擎'; return provider }
const formatDateTime = (dateStr?: string) => { if (!dateStr) return '-'; try { return new Date(dateStr).toLocaleString('zh-CN') } catch { return dateStr } }
const formatTime = (time?: number) => { if (!time) return '-'; return new Date(time).toLocaleString('zh-CN') }
</script>

<style scoped lang="scss">
@import '@/views/storage/styles/detail-drawer.scss';
</style>

<style lang="scss">
.es-detail-drawer { .el-drawer__body { padding: 0; height: 100%; overflow: hidden; } }
</style>
