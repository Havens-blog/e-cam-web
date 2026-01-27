<template>
  <el-drawer
    :model-value="visible"
    :with-header="false"
    size="860px"
    :close-on-click-modal="true"
    class="instance-detail-drawer"
    @update:model-value="$emit('update:visible', $event)"
  >
    <template v-if="instance">
      <!-- 自定义头部 -->
      <div class="drawer-header">
        <div class="header-left">
          <div class="instance-icon">
            <IconFont :type="getOsIcon(instance.attributes?.os_type)" :size="24" />
          </div>
          <div class="instance-info">
            <div class="instance-type">虚拟机</div>
            <div class="instance-name">
              {{ instance.asset_name || instance.asset_id }}
              <el-button text size="small" @click="handleRefresh">
                <el-icon><Refresh /></el-icon>
              </el-button>
            </div>
          </div>
        </div>
        <div class="header-right">
          <el-dropdown trigger="click">
            <el-button size="small">
              实例控制 <el-icon><ArrowDown /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item>开机</el-dropdown-item>
                <el-dropdown-item>关机</el-dropdown-item>
                <el-dropdown-item>重启</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <el-dropdown trigger="click">
            <el-button size="small">
              更多 <el-icon><ArrowDown /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="$emit('edit', instance)">编辑</el-dropdown-item>
                <el-dropdown-item divided @click="$emit('delete', instance)">
                  <span class="danger-text">删除</span>
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <el-button text @click="$emit('update:visible', false)">
            <el-icon :size="18"><Close /></el-icon>
          </el-button>
        </div>
      </div>

      <!-- 标签页 -->
      <div class="drawer-tabs">
        <el-tabs v-model="activeTab">
          <el-tab-pane label="详情" name="detail" />
          <el-tab-pane label="安全组" name="security" />
          <el-tab-pane label="网络" name="network" />
          <el-tab-pane label="磁盘" name="disk" />
          <el-tab-pane label="快照" name="snapshot" />
          <el-tab-pane label="监控" name="monitor" />
          <el-tab-pane label="报警" name="alarm" />
          <el-tab-pane label="任务" name="task" />
          <el-tab-pane label="定时任务" name="schedule" />
          <el-tab-pane label="操作日志" name="log" />
        </el-tabs>
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
                    <span class="status-dot" :class="getStatusClass(instance.attributes?.status)"></span>
                    {{ getStatusText(instance.attributes?.status) }}
                  </span>
                </div>
                <div class="info-row">
                  <span class="info-label">主机名</span>
                  <span class="info-value">{{ instance.attributes?.host_name || instance.asset_name || '-' }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">租户</span>
                  <span class="info-value">{{ instance.tenant_id }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">云账号</span>
                  <span class="info-value link">{{ instance.attributes?.cloud_account_name || '-' }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">云平台</span>
                  <span class="info-value">
                    <IconFont :type="getPlatformIconType(instance.attributes?.provider)" :size="16" />
                    {{ getProviderName(instance.attributes?.provider) }}
                  </span>
                </div>
                <div class="info-row">
                  <span class="info-label">区域</span>
                  <span class="info-value">{{ instance.attributes?.region || '-' }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">可用区</span>
                  <span class="info-value">{{ instance.attributes?.zone || '-' }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">计费方式</span>
                  <span class="info-value highlight">{{ getChargeTypeText(instance.attributes?.charge_type) }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">到期时间</span>
                  <span class="info-value">{{ formatDateTime(instance.attributes?.expired_time) }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">标签</span>
                  <span class="info-value tags">
                    <template v-if="instance.attributes?.tags && Object.keys(instance.attributes.tags).length > 0">
                      <span v-for="(value, key) in instance.attributes.tags" :key="key" class="tag-item">
                        {{ key }}: {{ value }}
                      </span>
                    </template>
                    <span v-else>-</span>
                  </span>
                </div>
                <div class="info-row">
                  <span class="info-label">创建时间</span>
                  <span class="info-value">{{ formatDateTime(instance.attributes?.creation_time) || formatTime(instance.create_time) }}</span>
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
                  <span class="info-label">操作系统</span>
                  <span class="info-value">
                    <IconFont :type="getOsIcon(instance.attributes?.os_type)" :size="16" />
                    {{ instance.attributes?.os_name || '-' }}
                  </span>
                </div>
                <div class="info-row">
                  <span class="info-label">规格</span>
                  <span class="info-value">{{ instance.attributes?.instance_type || '-' }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">CPU</span>
                  <span class="info-value">{{ instance.attributes?.cpu || '-' }} 核</span>
                </div>
                <div class="info-row">
                  <span class="info-label">内存</span>
                  <span class="info-value">{{ formatMemory(instance.attributes?.memory) }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">私网IP</span>
                  <span class="info-value">{{ instance.attributes?.private_ip || '-' }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">公网IP</span>
                  <span class="info-value">{{ instance.attributes?.public_ip || '-' }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">镜像ID</span>
                  <span class="info-value">{{ instance.attributes?.image_id || '-' }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">VPC</span>
                  <span class="info-value link">{{ instance.attributes?.vpc_id || '-' }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">子网</span>
                  <span class="info-value">{{ instance.attributes?.vswitch_id || '-' }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">安全组</span>
                  <span class="info-value">
                    <template v-if="instance.attributes?.security_groups?.length">
                      {{ instance.attributes.security_groups.length }} 个
                    </template>
                    <template v-else>-</template>
                  </span>
                </div>
                <div class="info-row">
                  <span class="info-label">网络类型</span>
                  <span class="info-value">{{ instance.attributes?.network_type || '-' }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">密钥对</span>
                  <span class="info-value">{{ instance.attributes?.key_pair_name || '-' }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">入带宽</span>
                  <span class="info-value">{{ instance.attributes?.internet_max_bandwidth_in || 0 }} Mbps</span>
                </div>
                <div class="info-row">
                  <span class="info-label">出带宽</span>
                  <span class="info-value">{{ instance.attributes?.internet_max_bandwidth_out || 0 }} Mbps</span>
                </div>
                <div class="info-row">
                  <span class="info-label">自动续费</span>
                  <span class="info-value">{{ instance.attributes?.auto_renew ? '开启' : '关闭' }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">描述</span>
                  <span class="info-value">{{ instance.attributes?.description || '-' }}</span>
                </div>
              </div>
            </div>
          </div>
        </template>

        <!-- 其他标签页占位 -->
        <template v-else>
          <div class="empty-tab">
            <el-icon :size="48"><Document /></el-icon>
            <p>{{ activeTab }} 功能开发中...</p>
          </div>
        </template>
      </div>
    </template>
  </el-drawer>
</template>

<script setup lang="ts">
import type { InstanceVO } from '@/api/types/cmdb';
import IconFont from '@/components/IconFont/index.vue';
import { ArrowDown, Close, Document, Refresh } from '@element-plus/icons-vue';
import { ref } from 'vue';

defineProps<{
  visible: boolean
  instance: InstanceVO | null
}>()

defineEmits<{
  'update:visible': [value: boolean]
  edit: [instance: InstanceVO]
  delete: [instance: InstanceVO]
}>()

const activeTab = ref('detail')

const handleRefresh = () => {
  // 刷新数据
}

const getOsIcon = (osType: string | undefined): string => {
  if (!osType) return 'caise-Linux'
  const os = osType.toLowerCase()
  if (os.includes('windows')) return 'caise-Windows'
  if (os.includes('ubuntu')) return 'caise-Ubuntu'
  if (os.includes('centos')) return 'caise-centos'
  return 'caise-Linux'
}

const getStatusClass = (status: string | undefined) => {
  if (!status) return ''
  const s = status.toUpperCase()
  const map: Record<string, string> = {
    RUNNING: 'running',
    STOPPED: 'stopped',
    DELETED: 'error',
    PENDING: 'pending',
  }
  return map[s] || ''
}

const getStatusText = (status: string | undefined) => {
  if (!status) return '-'
  const s = status.toUpperCase()
  const map: Record<string, string> = {
    RUNNING: '运行中',
    STOPPED: '已关机',
    DELETED: '已删除',
    PENDING: '创建中',
  }
  return map[s] || status
}

const getPlatformIconType = (provider: string | undefined): string => {
  if (!provider) return 'Alibaba_Cloud'
  const p = provider.toLowerCase()
  if (p.includes('aliyun') || p.includes('alibaba')) return 'Alibaba_Cloud'
  if (p.includes('tencent') || p.includes('qcloud')) return 'Tencent_Cloud'
  if (p.includes('huawei')) return 'Huawei_Cloud'
  if (p.includes('aws') || p.includes('amazon')) return 'AWS'
  if (p.includes('azure') || p.includes('microsoft')) return 'Azure'
  if (p.includes('google') || p.includes('gcp')) return 'Google_Cloud_Platform'
  if (p.includes('volcengine') || p.includes('volc') || p.includes('bytedance') || p.includes('volcano')) return 'Bytecloud'
  if (p.includes('ucloud')) return 'UCloud'
  if (p.includes('jd') || p.includes('jdcloud')) return 'JDCloud'
  if (p.includes('ecloud') || p.includes('ctyun')) return 'Ctyun'
  if (p.includes('openstack')) return 'OpenStack'
  if (p.includes('vmware') || p.includes('vsphere')) return 'caise-vmware'
  if (p.includes('nutanix')) return 'Nutanix'
  if (p.includes('zstack')) return 'ZStack'
  return 'Alibaba_Cloud'
}

const getProviderName = (provider: string | undefined): string => {
  if (!provider) return '-'
  const p = provider.toLowerCase()
  if (p.includes('aliyun') || p.includes('alibaba')) return '阿里云'
  if (p.includes('tencent') || p.includes('qcloud')) return '腾讯云'
  if (p.includes('huawei')) return '华为云'
  if (p.includes('aws') || p.includes('amazon')) return 'AWS'
  if (p.includes('azure') || p.includes('microsoft')) return 'Azure'
  if (p.includes('google') || p.includes('gcp')) return 'Google Cloud'
  if (p.includes('volcengine') || p.includes('volc') || p.includes('bytedance') || p.includes('volcano')) return '火山引擎'
  if (p.includes('ucloud')) return 'UCloud'
  if (p.includes('jd') || p.includes('jdcloud')) return '京东云'
  if (p.includes('ecloud') || p.includes('ctyun')) return '天翼云'
  if (p.includes('openstack')) return 'OpenStack'
  if (p.includes('vmware') || p.includes('vsphere')) return 'VMware'
  if (p.includes('nutanix')) return 'Nutanix'
  if (p.includes('zstack')) return 'ZStack'
  return provider
}

const getChargeTypeText = (chargeType: string | undefined): string => {
  if (!chargeType) return '-'
  const map: Record<string, string> = {
    PrePaid: '包年包月',
    PostPaid: '按量付费',
    prepaid: '包年包月',
    postpaid: '按量付费',
  }
  return map[chargeType] || chargeType
}

const formatDateTime = (dateStr: string | undefined): string => {
  if (!dateStr) return '-'
  try {
    const date = new Date(dateStr)
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

const formatTime = (time: number | undefined) => {
  if (!time) return '-'
  return new Date(time).toLocaleString('zh-CN')
}

const formatMemory = (memory: number | undefined) => {
  if (!memory) return '-'
  if (memory >= 1024) {
    return `${(memory / 1024).toFixed(0)}GB`
  }
  return `${memory}MB`
}
</script>

<style scoped lang="scss">
.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--bg-elevated);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;

  .instance-icon {
    width: 40px;
    height: 40px;
    background: var(--bg-hover);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-tertiary);
  }

  .instance-info {
    .instance-type {
      font-size: 11px;
      color: var(--text-muted);
      margin-bottom: 2px;
    }

    .instance-name {
      font-size: 15px;
      font-weight: 600;
      color: var(--text-primary);
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
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border-subtle);

  :deep(.el-tabs) {
    .el-tabs__header {
      margin: 0;
    }

    .el-tabs__nav-wrap::after {
      display: none;
    }

    .el-tabs__item {
      height: 36px;
      line-height: 36px;
      font-size: 13px;
      color: var(--text-secondary);
      padding: 0 14px;

      &.is-active {
        color: var(--accent-blue);
      }

      &:hover {
        color: var(--text-primary);
      }
    }

    .el-tabs__active-bar {
      background-color: var(--accent-blue);
      height: 2px;
    }
  }
}

.drawer-content {
  padding: 20px 24px;
  height: calc(100% - 110px);
  overflow: auto;
  background: var(--bg-base);
}

.detail-columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 40px;
}

.detail-column {
  .column-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-secondary);
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border-subtle);
  }
}

.info-list {
  display: flex;
  flex-direction: column;
}

.info-row {
  display: flex;
  align-items: flex-start;
  padding: 7px 0;
  font-size: 13px;
  min-height: 32px;

  .info-label {
    width: 80px;
    flex-shrink: 0;
    color: var(--text-muted);
    line-height: 1.5;
  }

  .info-value {
    flex: 1;
    color: var(--text-primary);
    word-break: break-all;
    display: flex;
    align-items: center;
    gap: 6px;
    line-height: 1.5;

    &.link {
      color: var(--accent-blue);
      cursor: pointer;

      &:hover {
        text-decoration: underline;
      }
    }

    &.highlight {
      color: var(--accent-blue);
    }

    .edit-icon {
      color: var(--accent-blue);
      cursor: pointer;
      font-size: 12px;
    }

    .platform-icon {
      width: 14px;
      height: 14px;
    }

    // 标签样式
    &.tags {
      flex-wrap: wrap;
      gap: 4px;

      .tag-item {
        padding: 2px 8px;
        background: var(--bg-hover);
        border-radius: 4px;
        font-size: 12px;
        color: var(--text-secondary);
      }
    }
  }
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-muted);
  flex-shrink: 0;

  &.running { background: var(--accent-green); }
  &.stopped { background: var(--text-tertiary); }
  &.error { background: var(--accent-red); }
}

.empty-tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 300px;
  color: var(--text-muted);

  p {
    margin-top: 16px;
  }
}

.danger-text {
  color: var(--accent-red);
}
</style>
