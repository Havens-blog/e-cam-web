<template>
  <el-drawer :model-value="visible" :with-header="false" size="50%" :close-on-click-modal="true" class="redis-detail-drawer" @update:model-value="$emit('update:visible', $event)">
    <div class="drawer-wrapper">
      <template v-if="instance">
        <div class="drawer-header-area">
          <div class="drawer-header">
            <div class="header-left">
              <div class="close-corner" @click="$emit('update:visible', false)">
                <div class="corner-bg"></div>
                <el-icon class="corner-icon" :size="12"><Close /></el-icon>
              </div>
              <div class="instance-icon"><IconFont type="caise-database" :size="24" /></div>
              <div class="instance-info">
                <div class="instance-type">Redis 云数据库</div>
                <div class="instance-name">{{ instance.asset_name || instance.asset_id }}</div>
              </div>
            </div>
            <div class="header-right">
              <el-dropdown trigger="click">
                <el-button size="small">更多 <el-icon><ArrowDown /></el-icon></el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item>重启实例</el-dropdown-item>
                    <el-dropdown-item>清空数据</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </div>
          <div class="drawer-tabs">
            <el-tabs v-model="activeTab">
              <el-tab-pane label="详情" name="detail" />
              <el-tab-pane label="白名单" name="whitelist" />
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
                  <div class="info-row"><span class="info-label">版本</span><span class="info-value">Redis {{ instance.attributes?.engine_version || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">架构</span><span class="info-value">{{ instance.attributes?.architecture_type || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">云平台</span><span class="info-value"><IconFont :type="getPlatformIcon(instance.attributes?.provider)" :size="16" /> {{ getProviderName(instance.attributes?.provider) }}</span></div>
                  <div class="info-row"><span class="info-label">区域</span><span class="info-value">{{ instance.attributes?.region || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">可用区</span><span class="info-value">{{ instance.attributes?.zone || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">计费方式</span><span class="info-value highlight">{{ getChargeTypeText(instance.attributes?.charge_type) }}</span></div>
                  <div class="info-row"><span class="info-label">创建时间</span><span class="info-value">{{ formatDateTime(instance.attributes?.creation_time) || formatTime(instance.create_time) }}</span></div>
                </div>
              </div>
              <div class="detail-column">
                <div class="column-title">配置信息</div>
                <div class="info-list">
                  <div class="info-row"><span class="info-label">规格</span><span class="info-value">{{ instance.attributes?.instance_type || instance.attributes?.instance_class || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">内存</span><span class="info-value">{{ instance.attributes?.capacity || instance.attributes?.memory || '-' }} MB</span></div>
                  <div class="info-row"><span class="info-label">最大连接数</span><span class="info-value">{{ instance.attributes?.max_connections || instance.attributes?.connections || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">带宽</span><span class="info-value">{{ instance.attributes?.bandwidth || '-' }} Mbps</span></div>
                  <div class="info-row"><span class="info-label">连接地址</span><span class="info-value">{{ instance.attributes?.connection_domain || instance.attributes?.endpoint || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">端口</span><span class="info-value">{{ instance.attributes?.port || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">VPC</span><span class="info-value link">{{ instance.attributes?.vpc_id || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">子网</span><span class="info-value">{{ instance.attributes?.vswitch_id || '-' }}</span></div>
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
import { ArrowDown, Close, Document } from '@element-plus/icons-vue';
import { ref } from 'vue';

defineProps<{ visible: boolean; instance: Asset | null }>()
defineEmits<{ 'update:visible': [value: boolean] }>()

const activeTab = ref('detail')

const getStatusClass = (status?: string) => { if (!status) return ''; const s = status.toLowerCase(); if (['running', 'normal'].includes(s)) return 'running'; if (['stopped', 'shutdown'].includes(s)) return 'stopped'; return 'pending' }
const getStatusText = (status?: string) => { if (!status) return '-'; const map: Record<string, string> = { running: '运行中', normal: '运行中', stopped: '已停止' }; return map[status.toLowerCase()] || status }
const getPlatformIcon = (provider?: string) => { if (!provider) return 'Alibaba_Cloud'; const p = provider.toLowerCase(); if (p.includes('aliyun') || p.includes('alibaba')) return 'Alibaba_Cloud'; if (p.includes('tencent')) return 'Tencent_Cloud'; if (p.includes('huawei')) return 'Huawei_Cloud'; if (p.includes('aws')) return 'AWS'; if (p.includes('volcano')) return 'Bytecloud'; return 'Alibaba_Cloud' }
const getProviderName = (provider?: string) => { if (!provider) return '-'; const p = provider.toLowerCase(); if (p.includes('aliyun') || p.includes('alibaba')) return '阿里云'; if (p.includes('tencent')) return '腾讯云'; if (p.includes('huawei')) return '华为云'; if (p.includes('aws')) return 'AWS'; if (p.includes('volcano')) return '火山引擎'; return provider }
const getChargeTypeText = (chargeType?: string) => { if (!chargeType) return '-'; const map: Record<string, string> = { PrePaid: '包年包月', PostPaid: '按量付费' }; return map[chargeType] || chargeType }
const formatDateTime = (dateStr?: string) => { if (!dateStr) return '-'; try { return new Date(dateStr).toLocaleString('zh-CN') } catch { return dateStr } }
const formatTime = (time?: number) => { if (!time) return '-'; return new Date(time).toLocaleString('zh-CN') }
</script>

<style scoped lang="scss">
@import '@/views/storage/styles/detail-drawer.scss';
</style>

<style lang="scss">
.redis-detail-drawer { .el-drawer__body { padding: 0; height: 100%; overflow: hidden; } }
</style>
