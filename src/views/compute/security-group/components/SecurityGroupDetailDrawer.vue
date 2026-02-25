<template>
  <el-drawer :model-value="visible" :with-header="false" size="50%" :close-on-click-modal="true" class="sg-detail-drawer" @update:model-value="$emit('update:visible', $event)">
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
              <el-tab-pane label="关联实例" name="instances" />
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
                  <div class="info-row"><span class="info-label">安全组ID</span><span class="info-value">{{ instance.asset_id }}</span></div>
                  <div class="info-row"><span class="info-label">名称</span><span class="info-value">{{ instance.asset_name || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">类型</span><span class="info-value">{{ instance.attributes?.security_group_type === 'enterprise' ? '企业级' : '普通' }}</span></div>
                  <div class="info-row"><span class="info-label">云平台</span><span class="info-value"><IconFont :type="getPlatformIcon(instance.provider)" :size="16" />{{ getProviderName(instance.provider) }}</span></div>
                  <div class="info-row"><span class="info-label">区域</span><span class="info-value">{{ instance.region || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">创建时间</span><span class="info-value">{{ formatTime(instance.create_time) }}</span></div>
                </div>
              </div>
              <div class="detail-column">
                <div class="column-title">关联信息</div>
                <div class="info-list">
                  <div class="info-row"><span class="info-label">VPC</span><span class="info-value link">{{ instance.attributes?.vpc_id || '-' }}</span></div>
                  <div class="info-row"><span class="info-label">入方向规则</span><span class="info-value">{{ instance.attributes?.ingress_rules?.length || 0 }} 条</span></div>
                  <div class="info-row"><span class="info-label">出方向规则</span><span class="info-value">{{ instance.attributes?.egress_rules?.length || 0 }} 条</span></div>
                  <div class="info-row"><span class="info-label">关联实例</span><span class="info-value">{{ instance.attributes?.instance_count || 0 }} 个</span></div>
                  <div class="info-row"><span class="info-label">描述</span><span class="info-value">{{ instance.attributes?.description || '-' }}</span></div>
                </div>
              </div>
            </div>
          </template>
          <template v-else-if="activeTab === 'ingress'">
            <el-table :data="instance.attributes?.ingress_rules || []" stripe size="small">
              <el-table-column prop="priority" label="优先级" width="70" />
              <el-table-column prop="protocol" label="协议" width="70" />
              <el-table-column prop="portrange" label="端口范围" width="110" />
              <el-table-column label="授权对象" min-width="140">
                <template #default="{ row }">{{ row.sourcecidr || row.sourcegroupid || '-' }}</template>
              </el-table-column>
              <el-table-column label="策略" width="70">
                <template #default="{ row }">
                  <el-tag :type="row.policy?.toLowerCase() === 'accept' ? 'success' : 'danger'" size="small">
                    {{ row.policy?.toLowerCase() === 'accept' ? '允许' : '拒绝' }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="description" label="描述" min-width="180" show-overflow-tooltip />
            </el-table>
          </template>
          <template v-else-if="activeTab === 'egress'">
            <el-table :data="instance.attributes?.egress_rules || []" stripe size="small">
              <el-table-column prop="priority" label="优先级" width="70" />
              <el-table-column prop="protocol" label="协议" width="70" />
              <el-table-column prop="portrange" label="端口范围" width="110" />
              <el-table-column label="目标对象" min-width="140">
                <template #default="{ row }">{{ row.destcidr || row.destgroupid || '-' }}</template>
              </el-table-column>
              <el-table-column label="策略" width="70">
                <template #default="{ row }">
                  <el-tag :type="row.policy?.toLowerCase() === 'accept' ? 'success' : 'danger'" size="small">
                    {{ row.policy?.toLowerCase() === 'accept' ? '允许' : '拒绝' }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="description" label="描述" min-width="180" show-overflow-tooltip />
            </el-table>
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
import { Close, Document, Lock } from '@element-plus/icons-vue';
import { ref } from 'vue';

defineProps<{ visible: boolean; instance: Asset | null }>()
defineEmits<{ 'update:visible': [value: boolean] }>()

const activeTab = ref('detail')

const getPlatformIcon = (provider?: string) => { if (!provider) return 'Alibaba_Cloud'; const p = provider.toLowerCase(); if (p.includes('aliyun')) return 'Alibaba_Cloud'; if (p.includes('tencent')) return 'Tencent_Cloud'; if (p.includes('huawei')) return 'Huawei_Cloud'; if (p.includes('aws')) return 'AWS'; if (p.includes('volcano')) return 'Bytecloud'; return 'Alibaba_Cloud' }
const getProviderName = (provider?: string) => { if (!provider) return '-'; const p = provider.toLowerCase(); if (p.includes('aliyun')) return '阿里云'; if (p.includes('tencent')) return '腾讯云'; if (p.includes('huawei')) return '华为云'; if (p.includes('aws')) return 'AWS'; if (p.includes('volcano')) return '火山引擎'; return provider }
const formatTime = (time?: number) => time ? new Date(time).toLocaleString('zh-CN') : '-'
</script>

<style scoped lang="scss">
@import '@/views/storage/styles/detail-drawer.scss';
</style>

<style lang="scss">
.sg-detail-drawer { .el-drawer__body { padding: 0; height: 100%; overflow: hidden; } }
</style>
