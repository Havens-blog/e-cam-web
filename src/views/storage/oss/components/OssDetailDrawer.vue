<template>
  <el-drawer
    :model-value="visible"
    :with-header="false"
    size="50%"
    :close-on-click-modal="true"
    class="oss-detail-drawer"
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
                <el-icon :size="24"><Folder /></el-icon>
              </div>
              <div class="instance-info">
                <div class="instance-type">对象存储 OSS</div>
                <div class="instance-name">{{ instance.asset_name || instance.asset_id }}</div>
              </div>
            </div>
            <div class="header-right">
              <el-dropdown trigger="click">
                <el-button size="small">更多 <el-icon><ArrowDown /></el-icon></el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item>文件管理</el-dropdown-item>
                    <el-dropdown-item>基础设置</el-dropdown-item>
                    <el-dropdown-item>权限管理</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </div>
          <div class="drawer-tabs">
            <el-tabs v-model="activeTab">
              <el-tab-pane label="详情" name="detail" />
              <el-tab-pane label="文件列表" name="files" />
              <el-tab-pane label="访问控制" name="acl" />
              <el-tab-pane label="生命周期" name="lifecycle" />
              <el-tab-pane label="标签" name="tags" />
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
                  <div class="info-row"><span class="info-label">存储桶名称</span><span class="info-value">{{ instance.asset_name || instance.asset_id }}</span></div>
                  <div class="info-row"><span class="info-label">存储桶ID</span><span class="info-value">{{ instance.asset_id }}</span></div>
                  <div class="info-row"><span class="info-label">存储类型</span><span class="info-value"><el-tag size="small" :type="getStorageClassType(instance.attributes?.storage_class)">{{ getStorageClassText(instance.attributes?.storage_class) }}</el-tag></span></div>
                  <div class="info-row"><span class="info-label">访问权限</span><span class="info-value">{{ getAclText(instance.attributes?.acl) }}</span></div>
                  <div class="info-row"><span class="info-label">云平台</span><span class="info-value"><IconFont :type="getPlatformIcon(instance.attributes?.provider)" :size="16" />{{ getProviderName(instance.attributes?.provider) }}</span></div>
                  <div class="info-row"><span class="info-label">区域</span><span class="info-value">{{ instance.attributes?.region || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">Endpoint</span><span class="info-value">{{ instance.attributes?.endpoint || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">创建时间</span><span class="info-value">{{ formatDateTime(instance.attributes?.creation_time) }}</span></div>
                </div>
              </div>
              <div class="detail-column">
                <div class="column-title">存储统计</div>
                <div class="info-list">
                  <div class="info-row"><span class="info-label">对象数量</span><span class="info-value">{{ formatNumber(instance.attributes?.object_count) }}</span></div>
                  <div class="info-row"><span class="info-label">存储量</span><span class="info-value">{{ formatStorageSize(instance.attributes?.storage_size) }}</span></div>
                  <div class="info-row"><span class="info-label">版本控制</span><span class="info-value">{{ instance.attributes?.versioning ? '已开启' : '未开启' }}</span></div>
                  <div class="info-row"><span class="info-label">跨域访问</span><span class="info-value">{{ instance.attributes?.cors_enabled ? '已开启' : '未开启' }}</span></div>
                  <div class="info-row"><span class="info-label">静态网站</span><span class="info-value">{{ instance.attributes?.website_enabled ? '已开启' : '未开启' }}</span></div>
                  <div class="info-row"><span class="info-label">日志记录</span><span class="info-value">{{ instance.attributes?.logging_enabled ? '已开启' : '未开启' }}</span></div>
                  <div class="info-row"><span class="info-label">加密</span><span class="info-value">{{ instance.attributes?.encryption_enabled ? '已开启' : '未开启' }}</span></div>
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
import { ArrowDown, Close, Document, Folder } from '@element-plus/icons-vue';
import { ref } from 'vue';

defineProps<{ visible: boolean; instance: Asset | null }>()
defineEmits<{ 'update:visible': [value: boolean] }>()

const activeTab = ref('detail')

const getStorageClassText = (type?: string) => { if (!type) return '-'; const map: Record<string, string> = { Standard: '标准存储', IA: '低频存储', Archive: '归档存储', ColdArchive: '冷归档存储' }; return map[type] || type }
const getStorageClassType = (type?: string) => { if (!type) return 'info'; const map: Record<string, string> = { Standard: '', IA: 'warning', Archive: 'info' }; return map[type] || 'info' }
const getAclText = (acl?: string) => { if (!acl) return '-'; const map: Record<string, string> = { private: '私有', 'public-read': '公共读', 'public-read-write': '公共读写' }; return map[acl] || acl }
const formatNumber = (num?: number) => { if (!num) return '0'; return num.toLocaleString() }
const formatStorageSize = (size?: number) => { if (!size) return '-'; if (size >= 1024 * 1024 * 1024) return `${(size / 1024 / 1024 / 1024).toFixed(2)} TB`; if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(2)} GB`; if (size >= 1024) return `${(size / 1024).toFixed(2)} MB`; return `${size} KB` }
const getPlatformIcon = (provider?: string) => { if (!provider) return 'Alibaba_Cloud'; const p = provider.toLowerCase(); if (p.includes('aliyun')) return 'Alibaba_Cloud'; if (p.includes('tencent')) return 'Tencent_Cloud'; if (p.includes('huawei')) return 'Huawei_Cloud'; if (p.includes('aws')) return 'AWS'; if (p.includes('volcano')) return 'Bytecloud'; return 'Alibaba_Cloud' }
const getProviderName = (provider?: string) => { if (!provider) return '-'; const p = provider.toLowerCase(); if (p.includes('aliyun')) return '阿里云'; if (p.includes('tencent')) return '腾讯云'; if (p.includes('huawei')) return '华为云'; if (p.includes('aws')) return 'AWS'; if (p.includes('volcano')) return '火山引擎'; return provider }
const formatDateTime = (dateStr?: string) => { if (!dateStr) return '-'; try { return new Date(dateStr).toLocaleString('zh-CN') } catch { return dateStr } }
</script>

<style scoped lang="scss">
@import '../../styles/detail-drawer.scss';
</style>

<style lang="scss">
.oss-detail-drawer { .el-drawer__body { padding: 0; height: 100%; overflow: hidden; } }
</style>
