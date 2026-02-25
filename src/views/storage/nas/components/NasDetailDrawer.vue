<template>
  <el-drawer
    :model-value="visible"
    :with-header="false"
    size="50%"
    :close-on-click-modal="true"
    class="nas-detail-drawer"
    @update:model-value="$emit('update:visible', $event)"
  >
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
                <el-icon :size="24"><FolderOpened /></el-icon>
              </div>
              <div class="instance-info">
                <div class="instance-type">文件存储 NAS</div>
                <div class="instance-name">{{ instance.asset_name || instance.asset_id }}</div>
              </div>
            </div>
            <div class="header-right">
              <el-dropdown trigger="click">
                <el-button size="small">更多 <el-icon><ArrowDown /></el-icon></el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item>挂载点管理</el-dropdown-item>
                    <el-dropdown-item>扩容</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </div>
          <div class="drawer-tabs">
            <el-tabs v-model="activeTab">
              <el-tab-pane label="详情" name="detail" />
              <el-tab-pane label="挂载点" name="mount" />
              <el-tab-pane label="标签" name="tags" />
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
                  <div class="info-row"><span class="info-label">文件系统ID</span><span class="info-value">{{ instance.asset_id }}</span></div>
                  <div class="info-row"><span class="info-label">名称</span><span class="info-value">{{ instance.asset_name || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">状态</span><span class="info-value"><span class="status-dot" :class="getStatusClass(instance.attributes?.status)"></span>{{ getStatusText(instance.attributes?.status) }}</span></div>
                  <div class="info-row"><span class="info-label">文件系统类型</span><span class="info-value">{{ getFileSystemTypeText(instance.attributes?.file_system_type) }}</span></div>
                  <div class="info-row"><span class="info-label">协议类型</span><span class="info-value">{{ instance.attributes?.protocol_type || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">存储类型</span><span class="info-value">{{ instance.attributes?.storage_type || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">云平台</span><span class="info-value"><IconFont :type="getPlatformIcon(instance.attributes?.provider)" :size="16" />{{ getProviderName(instance.attributes?.provider) }}</span></div>
                  <div class="info-row"><span class="info-label">区域</span><span class="info-value">{{ instance.attributes?.region || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">可用区</span><span class="info-value">{{ instance.attributes?.zone || '-' }}</span></div>
                </div>
              </div>
              <div class="detail-column">
                <div class="column-title">容量与配置</div>
                <div class="info-list">
                  <div class="info-row"><span class="info-label">总容量</span><span class="info-value">{{ formatCapacity(instance.attributes?.capacity) }}</span></div>
                  <div class="info-row"><span class="info-label">已用容量</span><span class="info-value">{{ formatCapacity(instance.attributes?.used_capacity) }}</span></div>
                  <div class="info-row"><span class="info-label">挂载点数量</span><span class="info-value">{{ instance.attributes?.mount_target_count || 0 }}</span></div>
                  <div class="info-row"><span class="info-label">VPC</span><span class="info-value link">{{ instance.attributes?.vpc_id || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">加密</span><span class="info-value">{{ instance.attributes?.encrypt_type ? '已加密' : '未加密' }}</span></div>
                  <div class="info-row"><span class="info-label">计费方式</span><span class="info-value highlight">{{ getChargeTypeText(instance.attributes?.charge_type) }}</span></div>
                  <div class="info-row"><span class="info-label">创建时间</span><span class="info-value">{{ formatDateTime(instance.attributes?.creation_time) }}</span></div>
                  <div class="info-row"><span class="info-label">描述</span><span class="info-value">{{ instance.attributes?.description || '-' }}</span></div>
                </div>
              </div>
            </div>
          </template>
          <template v-else>
            <div class="empty-tab"><el-icon :size="48"><Document /></el-icon><p>{{ activeTab }} 功能开发中...</p></div>
          </template>
        </div>
      </template>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import type { Asset } from '@/api/types/asset';
import IconFont from '@/components/IconFont/index.vue';
import { ArrowDown, Close, Document, FolderOpened } from '@element-plus/icons-vue';
import { ref } from 'vue';

defineProps<{ visible: boolean; instance: Asset | null }>()
defineEmits<{ 'update:visible': [value: boolean] }>()

const activeTab = ref('detail')

const getStatusClass = (status?: string) => { if (!status) return ''; const s = status.toLowerCase(); return s === 'running' ? 'running' : s === 'stopped' ? 'stopped' : '' }
const getStatusText = (status?: string) => { if (!status) return '-'; const map: Record<string, string> = { running: '运行中', stopped: '已停止', pending: '创建中', Running: '运行中', Stopped: '已停止' }; return map[status] || status }
const getFileSystemTypeText = (type?: string) => { if (!type) return '-'; const map: Record<string, string> = { standard: '通用型', extreme: '极速型', cpfs: 'CPFS' }; return map[type] || type }
const formatCapacity = (capacity?: number) => { if (!capacity) return '-'; if (capacity >= 1024 * 1024) return `${(capacity / 1024 / 1024).toFixed(1)} TB`; if (capacity >= 1024) return `${(capacity / 1024).toFixed(1)} GB`; return `${capacity} MB` }
const getPlatformIcon = (provider?: string) => { if (!provider) return 'Alibaba_Cloud'; const p = provider.toLowerCase(); if (p.includes('aliyun')) return 'Alibaba_Cloud'; if (p.includes('tencent')) return 'Tencent_Cloud'; if (p.includes('huawei')) return 'Huawei_Cloud'; if (p.includes('aws')) return 'AWS'; if (p.includes('volcano')) return 'Bytecloud'; return 'Alibaba_Cloud' }
const getProviderName = (provider?: string) => { if (!provider) return '-'; const p = provider.toLowerCase(); if (p.includes('aliyun')) return '阿里云'; if (p.includes('tencent')) return '腾讯云'; if (p.includes('huawei')) return '华为云'; if (p.includes('aws')) return 'AWS'; if (p.includes('volcano')) return '火山引擎'; return provider }
const getChargeTypeText = (type?: string) => { if (!type) return '-'; const map: Record<string, string> = { PrePaid: '包年包月', PostPaid: '按量付费', prepaid: '包年包月', postpaid: '按量付费' }; return map[type] || type }
const formatDateTime = (dateStr?: string) => { if (!dateStr) return '-'; try { return new Date(dateStr).toLocaleString('zh-CN') } catch { return dateStr } }
</script>

<style scoped lang="scss">
@import '../../styles/detail-drawer.scss';
</style>

<style lang="scss">
.nas-detail-drawer { .el-drawer__body { padding: 0; height: 100%; overflow: hidden; } }
</style>
