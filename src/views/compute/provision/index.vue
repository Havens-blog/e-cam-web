<template>
  <div class="provision-page">
    <div class="page-title-area">
      <h2 class="page-title">创建云服务器</h2>
      <p class="page-subtitle">选择云账号和配置参数，快速创建云服务器实例</p>
    </div>

    <div class="content-grid">
      <!-- ========== 左侧配置区 ========== -->
      <div class="left-panel">

        <!-- 1. 云账号选择 -->
        <el-card class="config-card">
          <template #header>
            <div class="card-header">
              <span class="card-title"><span class="title-icon" style="background: linear-gradient(135deg, #409eff, #7c3aed)"><el-icon><UserFilled /></el-icon></span> 云账号选择</span>
              <span v-if="selectedAccount" class="card-header-extra">
                已选: {{ selectedAccount?.name }}
              </span>
            </div>
          </template>

          <!-- 已选账号信息 -->
          <div v-if="selectedAccount" class="selected-account-banner">
            <div class="account-icon" :style="{ background: getProviderColor(selectedAccount?.provider) }">
              {{ getProviderShort(selectedAccount?.provider) }}
            </div>
            <div class="account-info">
              <div class="account-name">{{ selectedAccount?.name }}</div>
              <div class="account-meta">
                <span>{{ getProviderLabel(selectedAccount?.provider) }}</span>
                <span v-if="selectedAccount?.description">· {{ selectedAccount?.description }}</span>
              </div>
            </div>
            <el-button size="small" @click="showAccountPanel = !showAccountPanel">
              {{ showAccountPanel ? '收起' : '切换账号' }}
            </el-button>
          </div>

          <!-- 账号网格 -->
          <div v-show="!selectedAccount || showAccountPanel" class="account-grid">
            <div
              v-for="acc in safeAccounts"
              :key="acc?.id"
              class="account-card"
              :class="{ active: form.cloud_account_id === acc?.id }"
              @click="handleAccountSelect(acc)"
            >
              <div class="account-card-icon" :style="{ background: getProviderColor(acc?.provider) }">
                {{ getProviderShort(acc?.provider) }}
              </div>
              <div class="account-card-info">
                <div class="account-card-name">{{ acc?.name }}</div>
                <div class="account-card-desc">{{ getProviderLabel(acc?.provider) }}</div>
              </div>
              <div class="account-card-check">
                <el-icon v-if="form.cloud_account_id === acc?.id"><Check /></el-icon>
              </div>
            </div>
          </div>
        </el-card>

        <!-- 2. 基础配置 -->
        <el-card class="config-card">
          <template #header>
            <div class="card-header">
              <span class="card-title"><span class="title-icon" style="background: linear-gradient(135deg, #22c55e, #10b981)"><el-icon><Cpu /></el-icon></span> 基础配置</span>
            </div>
          </template>

          <div class="form-section">
            <div class="form-section-title">地域 / 可用区</div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">地域</label>
                <el-select
                  v-model="form.region"
                  placeholder="请选择地域"
                  filterable
                  :loading="regionLoading"
                  style="width: 100%"
                  @change="handleRegionChange"
                >
                  <el-option
                    v-for="r in safeRegions"
                    :key="r?.id"
                    :label="r?.local_name || r?.id"
                    :value="r?.id"
                  />
                </el-select>
              </div>
              <div class="form-group">
                <label class="form-label">可用区</label>
                <el-input v-model="form.zone" placeholder="请输入可用区 ID" />
              </div>
            </div>
          </div>

          <div class="form-section">
            <div class="form-section-title">实例规格</div>
            <InstanceTypeSelector
              v-model="form.instance_type"
              :instance-types="safeInstanceTypes"
              :loading="specLoading"
            />
          </div>

          <div class="form-section">
            <div class="form-section-title">镜像</div>
            <div class="form-row">
              <div class="form-group full">
                <el-select
                  v-model="form.image_id"
                  placeholder="请选择镜像"
                  filterable
                  :loading="specLoading"
                  style="width: 100%"
                >
                  <el-option
                    v-for="img in safeImages"
                    :key="img?.image_id"
                    :label="`${img?.name || ''} (${img?.os_type || ''})`"
                    :value="img?.image_id"
                  />
                </el-select>
              </div>
            </div>
          </div>
        </el-card>

        <!-- 3. 存储配置 -->
        <el-card class="config-card">
          <template #header>
            <div class="card-header">
              <span class="card-title"><span class="title-icon" style="background: linear-gradient(135deg, #f59e0b, #eab308)"><el-icon><Box /></el-icon></span> 存储配置</span>
            </div>
          </template>

          <div class="form-section">
            <div class="form-section-title">系统盘</div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">磁盘类型</label>
                <el-select v-model="form.system_disk_type" placeholder="系统盘类型" clearable style="width: 100%">
                  <el-option label="高效云盘" value="cloud_efficiency" />
                  <el-option label="SSD 云盘" value="cloud_ssd" />
                  <el-option label="ESSD 云盘" value="cloud_essd" />
                </el-select>
              </div>
              <div class="form-group">
                <label class="form-label">磁盘大小 (GB)</label>
                <el-slider v-model="form.system_disk_size" :min="20" :max="500" :step="10" show-input />
              </div>
            </div>
          </div>

          <div class="form-section">
            <div class="form-section-title">
              数据盘
              <el-button size="small" type="primary" link @click="addDataDisk">
                <el-icon><Plus /></el-icon> 添加数据盘
              </el-button>
            </div>
            <div v-if="form.data_disks.length === 0" class="empty-placeholder">暂无数据盘，点击上方添加</div>
            <div v-for="(disk, idx) in form.data_disks" :key="idx" class="disk-item">
              <div class="disk-icon">💾</div>
              <div class="disk-info">
                <el-select v-model="disk.category" placeholder="磁盘类型" size="small" style="width: 140px">
                  <el-option label="高效云盘" value="cloud_efficiency" />
                  <el-option label="SSD 云盘" value="cloud_ssd" />
                  <el-option label="ESSD 云盘" value="cloud_essd" />
                </el-select>
              </div>
              <div class="disk-size">
                <el-input-number v-model="disk.size" :min="20" :max="2000" :step="10" size="small" />
                <span class="size-unit">GB</span>
              </div>
              <el-button size="small" type="danger" link @click="form.data_disks.splice(idx, 1)">
                <el-icon><Delete /></el-icon>
              </el-button>
            </div>
          </div>
        </el-card>

        <!-- 4. 网络配置 -->
        <el-card class="config-card">
          <template #header>
            <div class="card-header">
              <span class="card-title"><span class="title-icon" style="background: linear-gradient(135deg, #a855f7, #c084fc)"><el-icon><Connection /></el-icon></span> 网络配置</span>
            </div>
          </template>

          <div class="form-section">
            <div class="form-section-title">VPC / 子网</div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">VPC</label>
                <el-select
                  v-model="form.vpc_id"
                  placeholder="请选择 VPC"
                  filterable
                  :loading="specLoading"
                  style="width: 100%"
                  @change="handleVPCChange"
                >
                  <el-option
                    v-for="vpc in safeVPCs"
                    :key="vpc?.vpc_id"
                    :label="`${vpc?.vpc_name || vpc?.vpc_id} (${vpc?.cidr_block || ''})`"
                    :value="vpc?.vpc_id"
                  />
                </el-select>
              </div>
              <div class="form-group">
                <label class="form-label">子网 / 交换机</label>
                <el-select
                  v-model="form.subnet_id"
                  placeholder="请选择子网"
                  filterable
                  :loading="subnetLoading"
                  style="width: 100%"
                >
                  <el-option
                    v-for="sn in safeSubnets"
                    :key="sn?.subnet_id"
                    :label="`${sn?.name || sn?.subnet_id} (${sn?.zone || ''})`"
                    :value="sn?.subnet_id"
                  />
                </el-select>
              </div>
            </div>
          </div>

          <div class="form-section">
            <div class="form-section-title">公网带宽</div>
            <div class="form-row">
              <div class="form-group full">
                <el-slider v-model="form.bandwidth_out" :min="0" :max="200" :step="1" show-input />
                <span class="slider-hint">单位: Mbps，设为 0 表示不分配公网</span>
              </div>
            </div>
          </div>

          <div class="form-section">
            <div class="form-section-title">安全组</div>
            <div v-if="specLoading || subnetLoading" class="loading-placeholder">
              <el-icon class="is-loading"><Loading /></el-icon> 加载中...
            </div>
            <div v-else-if="safeSecurityGroups.length === 0" class="empty-placeholder">
              请先选择 VPC
            </div>
            <div v-else class="sg-chip-list">
              <div
                v-for="sg in safeSecurityGroups"
                :key="sg?.security_group_id"
                class="sg-chip"
                :class="{ active: form.security_group_ids.includes(sg?.security_group_id || '') }"
                @click="toggleSecurityGroup(sg?.security_group_id || '')"
              >
                <el-icon><Lock /></el-icon>
                {{ sg?.name || sg?.security_group_id }}
              </div>
            </div>
          </div>
        </el-card>

        <!-- 5. 其他配置 -->
        <el-card class="config-card">
          <template #header>
            <div class="card-header">
              <span class="card-title"><span class="title-icon" style="background: linear-gradient(135deg, #ec4899, #f472b6)"><el-icon><Setting /></el-icon></span> 其他配置</span>
            </div>
          </template>

          <div class="form-section">
            <div class="form-section-title">实例信息</div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">实例名称前缀</label>
                <el-input v-model="form.instance_name_prefix" placeholder="如 web-server" />
              </div>
              <div class="form-group">
                <label class="form-label">主机名前缀</label>
                <el-input v-model="form.host_name_prefix" placeholder="如 web" />
              </div>
            </div>
          </div>

          <div class="form-section">
            <div class="form-section-title">密钥与计费</div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">密钥对</label>
                <el-input v-model="form.key_pair_name" placeholder="密钥对名称" />
              </div>
              <div class="form-group">
                <label class="form-label">计费方式</label>
                <el-select v-model="form.charge_type" placeholder="计费方式" clearable style="width: 100%">
                  <el-option label="按量付费" value="PostPaid" />
                  <el-option label="包年包月" value="PrePaid" />
                </el-select>
              </div>
            </div>
          </div>

          <div class="form-section">
            <div class="form-section-title">标签</div>
            <div class="tags-input-area">
              <div v-for="(val, key) in form.tags" :key="key" class="tag-chip">
                <span>{{ key }}={{ val }}</span>
                <el-icon class="tag-close" @click="removeTag(String(key))"><Close /></el-icon>
              </div>
              <div class="tag-add-row">
                <el-input v-model="newTagKey" placeholder="键" size="small" style="width: 100px" />
                <el-input v-model="newTagValue" placeholder="值" size="small" style="width: 100px" />
                <el-button size="small" type="primary" link @click="addTag">
                  <el-icon><Plus /></el-icon> 添加
                </el-button>
              </div>
            </div>
          </div>

          <div class="form-section">
            <div class="form-section-title">购买数量</div>
            <div class="quantity-selector">
              <div class="quantity-btn" @click="form.count = Math.max(1, form.count - 1)">−</div>
              <div class="quantity-value">{{ form.count }}</div>
              <div class="quantity-btn" @click="form.count = Math.min(20, form.count + 1)">+</div>
            </div>
          </div>

          <div class="form-section">
            <div class="form-section-title">描述</div>
            <el-input v-model="form.description" type="textarea" :rows="2" placeholder="实例描述（可选）" />
          </div>
        </el-card>
      </div>

      <!-- ========== 右侧边栏 ========== -->
      <div class="right-panel">

        <!-- 主机模板 -->
        <el-card class="config-card">
          <template #header>
            <div class="card-header">
              <span class="card-title"><span class="title-icon" style="background: linear-gradient(135deg, #06b6d4, #22d3ee)"><el-icon><Document /></el-icon></span> 主机模板</span>
            </div>
          </template>
          <div v-if="templateLoading" class="loading-placeholder">
            <el-icon class="is-loading"><Loading /></el-icon> 加载中...
          </div>
          <div v-else-if="safeTemplates.length === 0" class="empty-placeholder">暂无模板</div>
          <div v-else class="template-list">
            <div
              v-for="tpl in safeTemplates"
              :key="tpl?.id"
              class="template-item"
              :class="{ active: selectedTemplateId === tpl?.id }"
              @click="applyTemplate(tpl)"
            >
              <div class="template-header-row">
                <span class="template-name">{{ tpl?.name }}</span>
                <el-tag size="small" :type="getProviderTagType(tpl?.provider)">
                  {{ getProviderLabel(tpl?.provider) }}
                </el-tag>
              </div>
              <div v-if="tpl?.description" class="template-desc">{{ tpl?.description }}</div>
              <div class="template-specs">
                <el-tag v-if="tpl?.instance_type" size="small" type="info">{{ tpl?.instance_type }}</el-tag>
                <el-tag v-if="tpl?.region" size="small" type="info">{{ tpl?.region }}</el-tag>
              </div>
            </div>
          </div>
        </el-card>

        <!-- 配置摘要 -->
        <el-card class="config-card summary-card">
          <template #header>
            <div class="card-header">
              <span class="card-title"><span class="title-icon" style="background: linear-gradient(135deg, #22c55e, #4ade80)"><el-icon><List /></el-icon></span> 配置摘要</span>
            </div>
          </template>

          <div class="summary-list">
            <div class="summary-item">
              <span class="summary-label">云账号</span>
              <span class="summary-value">{{ selectedAccount?.name || '未选择' }}</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">云厂商</span>
              <span class="summary-value">{{ getProviderLabel(form.provider) || '未选择' }}</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">地域</span>
              <span class="summary-value">{{ currentRegionLabel || '未选择' }}</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">可用区</span>
              <span class="summary-value">{{ form.zone || '未填写' }}</span>
            </div>
            <el-divider />
            <div class="summary-item">
              <span class="summary-label">实例规格</span>
              <span class="summary-value">{{ form.instance_type || '未选择' }}</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">镜像</span>
              <span class="summary-value">{{ currentImageLabel || '未选择' }}</span>
            </div>
            <el-divider />
            <div class="summary-item">
              <span class="summary-label">系统盘</span>
              <span class="summary-value">{{ form.system_disk_type || '-' }} / {{ form.system_disk_size }}GB</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">数据盘</span>
              <span class="summary-value">{{ form.data_disks.length }} 块</span>
            </div>
            <el-divider />
            <div class="summary-item">
              <span class="summary-label">VPC</span>
              <span class="summary-value">{{ currentVPCLabel || '未选择' }}</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">子网</span>
              <span class="summary-value">{{ currentSubnetLabel || '未选择' }}</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">安全组</span>
              <span class="summary-value">{{ form.security_group_ids.length }} 个</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">公网带宽</span>
              <span class="summary-value">{{ form.bandwidth_out }} Mbps</span>
            </div>
            <el-divider />
            <div class="summary-item">
              <span class="summary-label">计费方式</span>
              <span class="summary-value">{{ form.charge_type === 'PrePaid' ? '包年包月' : form.charge_type === 'PostPaid' ? '按量付费' : '未选择' }}</span>
            </div>
            <div class="summary-item highlight">
              <span class="summary-label">购买数量</span>
              <span class="summary-value">{{ form.count }} 台</span>
            </div>
          </div>

          <div class="summary-actions">
            <el-button style="flex:1" @click="handleSaveTemplate" :loading="saveTemplateLoading">
              <el-icon><FolderAdd /></el-icon> 保存为模板
            </el-button>
            <button class="btn-create" :disabled="submitting" @click="handleSubmit">
              <el-icon v-if="!submitting"><CircleCheck /></el-icon>
              <el-icon v-else class="is-loading"><Loading /></el-icon>
              立即创建
            </button>
          </div>
        </el-card>
      </div>
    </div>

    <!-- 保存模板对话框 -->
    <el-dialog v-model="showSaveTemplateDialog" title="保存为模板" width="420px">
      <el-form label-width="80px">
        <el-form-item label="模板名称">
          <el-input v-model="templateName" placeholder="请输入模板名称" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="templateDesc" type="textarea" :rows="2" placeholder="模板描述（可选）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showSaveTemplateDialog = false">取消</el-button>
        <el-button type="primary" :loading="saveTemplateLoading" @click="confirmSaveTemplate">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { listCloudAccountsApi } from '@/api/index'
import {
  createTemplateApi,
  directProvisionApi,
  listImagesApi,
  listInstanceTypesApi,
  listRegionsApi,
  listSecurityGroupsApi,
  listSubnetsApi,
  listTemplatesApi,
  listVPCsApi
} from '@/api/template'
import type { CloudAccount } from '@/api/types/account'
import type {
  DataDiskConfig,
  ImageInfo,
  InstanceTypeInfo,
  SecurityGroupInfo,
  SubnetInfo,
  VMTemplate,
  VPCInfo
} from '@/api/types/template'
import type { TagType } from '@/utils/constants'
import { getProviderLabel } from '@/utils/constants'
import {
  Box,
  Check,
  CircleCheck,
  Close,
  Connection,
  Cpu,
  Delete,
  Document,
  FolderAdd,
  List,
  Loading,
  Lock,
  Plus,
  Setting,
  UserFilled
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import InstanceTypeSelector from './components/InstanceTypeSelector.vue'

const router = useRouter()

// ==================== 状态 ====================

const cloudAccounts = ref<CloudAccount[]>([])
const showAccountPanel = ref(false)
const regionLoading = ref(false)
const specLoading = ref(false)
const subnetLoading = ref(false)
const submitting = ref(false)
const templateLoading = ref(false)
const saveTemplateLoading = ref(false)
const selectedTemplateId = ref<number | null>(null)
const showSaveTemplateDialog = ref(false)
const templateName = ref('')
const templateDesc = ref('')
const newTagKey = ref('')
const newTagValue = ref('')

// 云资源选项
const regionOptions = ref<Array<{ id: string; local_name: string }>>([])
const instanceTypes = ref<InstanceTypeInfo[]>([])
const images = ref<ImageInfo[]>([])
const vpcs = ref<VPCInfo[]>([])
const subnets = ref<SubnetInfo[]>([])
const securityGroups = ref<SecurityGroupInfo[]>([])
const templates = ref<VMTemplate[]>([])

// 表单
const form = reactive({
  cloud_account_id: undefined as number | undefined,
  provider: '',
  region: '',
  zone: '',
  instance_type: '',
  image_id: '',
  vpc_id: '',
  subnet_id: '',
  security_group_ids: [] as string[],
  count: 1,
  instance_name_prefix: '',
  host_name_prefix: '',
  system_disk_type: '',
  system_disk_size: 40,
  data_disks: [] as DataDiskConfig[],
  bandwidth_out: 0,
  charge_type: '',
  key_pair_name: '',
  tags: {} as Record<string, string>,
  description: ''
})

// ==================== 安全计算属性 ====================

const safeAccounts = computed(() =>
  (cloudAccounts.value || []).filter(item => item != null)
)
const safeRegions = computed(() =>
  (regionOptions.value || []).filter(item => item != null)
)
const safeInstanceTypes = computed(() =>
  (instanceTypes.value || []).filter(item => item != null)
)
const safeImages = computed(() =>
  (images.value || []).filter(item => item != null)
)
const safeVPCs = computed(() =>
  (vpcs.value || []).filter(item => item != null)
)
const safeSubnets = computed(() =>
  (subnets.value || []).filter(item => item != null)
)
const safeSecurityGroups = computed(() =>
  (securityGroups.value || []).filter(item => item != null)
)
const safeTemplates = computed(() =>
  (templates.value || []).filter(item => item != null)
)

const selectedAccount = computed(() =>
  safeAccounts.value.find(a => a?.id === form.cloud_account_id) || null
)

const currentRegionLabel = computed(() => {
  const r = safeRegions.value.find(r => r?.id === form.region)
  return r?.local_name || form.region || ''
})

const currentImageLabel = computed(() => {
  const img = safeImages.value.find(i => i?.image_id === form.image_id)
  return img?.name || form.image_id || ''
})

const currentVPCLabel = computed(() => {
  const vpc = safeVPCs.value.find(v => v?.vpc_id === form.vpc_id)
  return vpc?.vpc_name || form.vpc_id || ''
})

const currentSubnetLabel = computed(() => {
  const sn = safeSubnets.value.find(s => s?.subnet_id === form.subnet_id)
  return sn?.name || form.subnet_id || ''
})

// ==================== 工具函数 ====================

function getProviderColor(provider: string | undefined): string {
  if (!provider) return '#909399'
  const colors: Record<string, string> = {
    aliyun: '#ff6a00', aws: '#ff9900', huawei: '#c7000b',
    tencent: '#00a3ff', volcano: '#f53f3f', azure: '#0078d4'
  }
  return colors[provider] || '#909399'
}

function getProviderShort(provider: string | undefined): string {
  if (!provider) return '?'
  const shorts: Record<string, string> = {
    aliyun: '阿里', aws: 'AWS', huawei: '华为',
    tencent: '腾讯', volcano: '火山', azure: 'AZ'
  }
  return shorts[provider] || provider.slice(0, 2).toUpperCase()
}

function getProviderTagType(provider: string | undefined): TagType {
  if (!provider) return 'info'
  const map: Record<string, TagType> = {
    aliyun: 'warning', aws: 'warning', huawei: 'danger',
    tencent: 'primary', volcano: 'danger', azure: 'primary'
  }
  return map[provider] || 'info'
}

// ==================== 云账号选择 ====================

async function handleAccountSelect(acc: CloudAccount) {
  form.cloud_account_id = acc?.id
  form.provider = acc?.provider || ''
  form.region = ''
  form.zone = ''
  form.instance_type = ''
  form.image_id = ''
  form.vpc_id = ''
  form.subnet_id = ''
  form.security_group_ids = []
  showAccountPanel.value = false

  instanceTypes.value = []
  images.value = []
  vpcs.value = []
  subnets.value = []
  securityGroups.value = []

  if (!acc?.id) return
  regionLoading.value = true
  try {
    const res = await listRegionsApi(acc.id)
    const data = res?.data || []
    regionOptions.value = (Array.isArray(data) ? data : [])
      .filter(r => r != null)
      .map(r => ({ id: r?.id || '', local_name: r?.local_name || r?.name || r?.id || '' }))
  } catch {
    regionOptions.value = []
  } finally {
    regionLoading.value = false
  }
}

// ==================== 地域变更 ====================

async function handleRegionChange(region: string) {
  form.instance_type = ''
  form.image_id = ''
  form.vpc_id = ''
  form.subnet_id = ''
  form.security_group_ids = []
  subnets.value = []
  securityGroups.value = []

  if (!form.cloud_account_id || !region) return
  specLoading.value = true
  try {
    const [typesRes, imagesRes, vpcsRes] = await Promise.all([
      listInstanceTypesApi(form.cloud_account_id, region),
      listImagesApi(form.cloud_account_id, region),
      listVPCsApi(form.cloud_account_id, region)
    ])
    instanceTypes.value = typesRes?.data || []
    images.value = imagesRes?.data || []
    vpcs.value = vpcsRes?.data || []
  } catch {
    ElMessage.error('加载云资源失败')
    instanceTypes.value = []
    images.value = []
    vpcs.value = []
  } finally {
    specLoading.value = false
  }
}

// ==================== VPC 变更 ====================

async function handleVPCChange(vpcId: string) {
  form.subnet_id = ''
  form.security_group_ids = []
  if (!form.cloud_account_id || !form.region || !vpcId) return

  subnetLoading.value = true
  try {
    const [subnetsRes, sgRes] = await Promise.all([
      listSubnetsApi(form.cloud_account_id, form.region, vpcId),
      listSecurityGroupsApi(form.cloud_account_id, form.region, vpcId)
    ])
    subnets.value = subnetsRes?.data || []
    securityGroups.value = sgRes?.data || []
  } catch {
    ElMessage.error('加载子网和安全组失败')
    subnets.value = []
    securityGroups.value = []
  } finally {
    subnetLoading.value = false
  }
}

// ==================== 安全组多选 ====================

function toggleSecurityGroup(sgId: string) {
  if (!sgId) return
  const idx = form.security_group_ids.indexOf(sgId)
  if (idx >= 0) {
    form.security_group_ids.splice(idx, 1)
  } else {
    form.security_group_ids.push(sgId)
  }
}

// ==================== 数据盘 ====================

function addDataDisk() {
  form.data_disks.push({ category: 'cloud_ssd', size: 100 })
}

// ==================== 标签 ====================

function addTag() {
  const k = newTagKey.value.trim()
  const v = newTagValue.value.trim()
  if (!k) { ElMessage.warning('请输入标签键'); return }
  form.tags[k] = v
  newTagKey.value = ''
  newTagValue.value = ''
}

function removeTag(key: string) {
  delete form.tags[key]
}

// ==================== 模板操作 ====================

async function loadTemplates() {
  templateLoading.value = true
  try {
    const res = await listTemplatesApi({ limit: 50 })
    templates.value = res?.data?.items || []
  } catch {
    templates.value = []
  } finally {
    templateLoading.value = false
  }
}

function applyTemplate(tpl: VMTemplate | null) {
  if (!tpl) return
  selectedTemplateId.value = tpl.id

  // 找到对应账号并选择
  const acc = safeAccounts.value.find(a => a?.id === tpl.cloud_account_id)
  if (acc) {
    form.cloud_account_id = acc.id
    form.provider = acc.provider || ''
  }

  form.region = tpl.region || ''
  form.zone = tpl.zone || ''
  form.instance_type = tpl.instance_type || ''
  form.image_id = tpl.image_id || ''
  form.vpc_id = tpl.vpc_id || ''
  form.subnet_id = tpl.subnet_id || ''
  form.security_group_ids = tpl.security_group_ids || []
  form.instance_name_prefix = tpl.instance_name_prefix || ''
  form.host_name_prefix = tpl.host_name_prefix || ''
  form.system_disk_type = tpl.system_disk_type || ''
  form.system_disk_size = tpl.system_disk_size || 40
  form.data_disks = tpl.data_disks || []
  form.bandwidth_out = tpl.bandwidth_out || 0
  form.charge_type = tpl.charge_type || ''
  form.key_pair_name = tpl.key_pair_name || ''
  form.tags = tpl.tags || {}

  // 加载地域和资源
  if (form.cloud_account_id) {
    loadRegionsForTemplate(form.cloud_account_id, form.region, form.vpc_id)
  }

  ElMessage.success(`已应用模板: ${tpl.name}`)
}

async function loadRegionsForTemplate(accountId: number, region: string, vpcId: string) {
  regionLoading.value = true
  try {
    const res = await listRegionsApi(accountId)
    const data = res?.data || []
    regionOptions.value = (Array.isArray(data) ? data : [])
      .filter(r => r != null)
      .map(r => ({ id: r?.id || '', local_name: r?.local_name || r?.name || r?.id || '' }))
  } catch {
    regionOptions.value = []
  } finally {
    regionLoading.value = false
  }

  if (region && accountId) {
    specLoading.value = true
    try {
      const [typesRes, imagesRes, vpcsRes] = await Promise.all([
        listInstanceTypesApi(accountId, region),
        listImagesApi(accountId, region),
        listVPCsApi(accountId, region)
      ])
      instanceTypes.value = typesRes?.data || []
      images.value = imagesRes?.data || []
      vpcs.value = vpcsRes?.data || []
    } catch {
      instanceTypes.value = []
      images.value = []
      vpcs.value = []
    } finally {
      specLoading.value = false
    }

    if (vpcId) {
      subnetLoading.value = true
      try {
        const [subnetsRes, sgRes] = await Promise.all([
          listSubnetsApi(accountId, region, vpcId),
          listSecurityGroupsApi(accountId, region, vpcId)
        ])
        subnets.value = subnetsRes?.data || []
        securityGroups.value = sgRes?.data || []
      } catch {
        subnets.value = []
        securityGroups.value = []
      } finally {
        subnetLoading.value = false
      }
    }
  }
}

// ==================== 保存模板 ====================

function handleSaveTemplate() {
  templateName.value = ''
  templateDesc.value = ''
  showSaveTemplateDialog.value = true
}

async function confirmSaveTemplate() {
  if (!templateName.value.trim()) {
    ElMessage.warning('请输入模板名称')
    return
  }
  saveTemplateLoading.value = true
  try {
    await createTemplateApi({
      name: templateName.value.trim(),
      description: templateDesc.value.trim(),
      provider: form.provider,
      cloud_account_id: form.cloud_account_id!,
      region: form.region,
      zone: form.zone,
      instance_type: form.instance_type,
      image_id: form.image_id,
      vpc_id: form.vpc_id,
      subnet_id: form.subnet_id,
      security_group_ids: form.security_group_ids,
      instance_name_prefix: form.instance_name_prefix,
      host_name_prefix: form.host_name_prefix,
      system_disk_type: form.system_disk_type,
      system_disk_size: form.system_disk_size,
      data_disks: form.data_disks,
      bandwidth_out: form.bandwidth_out,
      charge_type: form.charge_type,
      key_pair_name: form.key_pair_name,
      tags: form.tags
    })
    ElMessage.success('模板保存成功')
    showSaveTemplateDialog.value = false
    loadTemplates()
  } catch {
    ElMessage.error('保存模板失败')
  } finally {
    saveTemplateLoading.value = false
  }
}

// ==================== 提交创建 ====================

async function handleSubmit() {
  if (!form.cloud_account_id) {
    ElMessage.error('请选择云账号')
    return
  }
  if (!form.region) {
    ElMessage.error('请选择地域')
    return
  }
  if (!form.instance_type) {
    ElMessage.error('请选择实例规格')
    return
  }

  submitting.value = true
  try {
    await directProvisionApi({
      provider: form.provider,
      cloud_account_id: form.cloud_account_id,
      region: form.region,
      zone: form.zone,
      instance_type: form.instance_type,
      image_id: form.image_id,
      vpc_id: form.vpc_id,
      subnet_id: form.subnet_id,
      security_group_ids: form.security_group_ids,
      count: form.count,
      instance_name_prefix: form.instance_name_prefix || undefined,
      host_name_prefix: form.host_name_prefix || undefined,
      system_disk_type: form.system_disk_type || undefined,
      system_disk_size: form.system_disk_size || undefined,
      data_disks: form.data_disks.length > 0 ? form.data_disks : undefined,
      bandwidth_out: form.bandwidth_out || undefined,
      charge_type: form.charge_type || undefined,
      key_pair_name: form.key_pair_name || undefined,
      tags: Object.keys(form.tags).length > 0 ? form.tags : undefined,
      description: form.description || undefined
    })
    ElMessage.success('创建任务已提交')
    router.push('/compute/template')
  } catch {
    ElMessage.error('提交创建任务失败')
  } finally {
    submitting.value = false
  }
}

// ==================== 加载数据 ====================

async function loadAccounts() {
  try {
    const res = await listCloudAccountsApi({ status: 'active', limit: 100 })
    const data = res?.data
    cloudAccounts.value = data?.accounts || []
  } catch {
    cloudAccounts.value = []
  }
}

onMounted(() => {
  loadAccounts()
  loadTemplates()
})
</script>

<style scoped>
.provision-page {
  padding: 24px;
}

.page-title-area {
  margin-bottom: 24px;
}

.page-title {
  font-size: 22px;
  font-weight: 700;
  margin: 0 0 4px 0;
  color: #303133;
}

.page-subtitle {
  color: #909399;
  font-size: 14px;
  margin: 0;
}

/* 两栏布局 */
.content-grid {
  display: grid;
  grid-template-columns: 1fr 400px;
  gap: 24px;
  align-items: start;
}

/* 卡片圆角 */
.config-card {
  margin-bottom: 20px;
}

.config-card :deep(.el-card) {
  border-radius: 16px;
}

.provision-page :deep(.el-card) {
  border-radius: 16px;
  overflow: hidden;
}

.provision-page :deep(.el-input__wrapper),
.provision-page :deep(.el-select .el-input__wrapper) {
  border-radius: 10px;
}

.provision-page :deep(.el-slider__runway) {
  border-radius: 6px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-title {
  font-size: 15px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 10px;
  color: #303133;
}

.title-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 16px;
  flex-shrink: 0;
}

.card-header-extra {
  font-size: 12px;
  color: #909399;
}

/* 云账号选择 */
.selected-account-banner {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  border-radius: 14px;
  background: #ecf5ff;
  border: 1px solid #d9ecff;
  margin-bottom: 16px;
}

.account-icon {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
}

.account-info {
  flex: 1;
}

.account-name {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 2px;
}

.account-meta {
  font-size: 12px;
  color: #909399;
}

.account-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
}

.account-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border-radius: 12px;
  border: 1px solid #e4e7ed;
  background: #fafafa;
  cursor: pointer;
  transition: all 0.2s;
}

.account-card:hover {
  border-color: #409eff;
  background: #ecf5ff;
}

.account-card.active {
  border-color: #409eff;
  background: #ecf5ff;
  box-shadow: 0 2px 12px rgba(64, 158, 255, 0.15);
  border-width: 2px;
}

.account-card-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
}

.account-card-info {
  flex: 1;
  min-width: 0;
}

.account-card-name {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.account-card-desc {
  font-size: 11px;
  color: #909399;
}

.account-card-check {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid #dcdfe6;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: transparent;
  flex-shrink: 0;
  transition: all 0.2s;
}

.account-card.active .account-card-check {
  background: #409eff;
  border-color: #409eff;
  color: #fff;
}

/* 表单区域 */
.form-section {
  margin-bottom: 20px;
}

.form-section:last-child {
  margin-bottom: 0;
}

.form-section-title {
  font-size: 13px;
  font-weight: 600;
  color: #606266;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.form-section-title::before {
  content: '';
  width: 3px;
  height: 14px;
  background: linear-gradient(180deg, #409eff, #67c23a);
  border-radius: 2px;
}

.form-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group.full {
  grid-column: 1 / -1;
}

.form-label {
  font-size: 13px;
  font-weight: 500;
  color: #606266;
}

.slider-hint {
  font-size: 11px;
  color: #c0c4cc;
  margin-top: 4px;
}

/* 实例规格网格 */
.instance-type-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.instance-type-card {
  padding: 12px;
  border-radius: 12px;
  border: 1px solid #e4e7ed;
  background: #fafafa;
  cursor: pointer;
  transition: all 0.2s;
}

.instance-type-card:hover {
  border-color: #409eff;
  background: #ecf5ff;
}

.instance-type-card.active {
  border-color: #409eff;
  background: #ecf5ff;
  border-width: 2px;
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.15);
}

.it-name {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 2px;
}

.it-spec {
  font-size: 11px;
  color: #909399;
}

/* 存储 */
.disk-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 12px;
  border: 1px solid #e4e7ed;
  background: #fafafa;
  margin-bottom: 8px;
}

.disk-icon {
  font-size: 20px;
}

.disk-info {
  flex: 1;
}

.disk-size {
  display: flex;
  align-items: center;
  gap: 6px;
}

.size-unit {
  font-size: 12px;
  color: #909399;
}

/* 安全组芯片 */
.sg-chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.sg-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 20px;
  border: 1px solid #e4e7ed;
  background: #fafafa;
  font-size: 13px;
  color: #606266;
  cursor: pointer;
  transition: all 0.2s;
  user-select: none;
}

.sg-chip:hover {
  border-color: #409eff;
  color: #409eff;
}

.sg-chip.active {
  border-color: #409eff;
  background: #ecf5ff;
  color: #409eff;
}

/* 标签输入 */
.tags-input-area {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.tag-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 4px;
  background: #ecf5ff;
  border: 1px solid #d9ecff;
  font-size: 12px;
  color: #409eff;
}

.tag-close {
  cursor: pointer;
  font-size: 12px;
}

.tag-close:hover {
  color: #f56c6c;
}

.tag-add-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* 购买数量 */
.quantity-selector {
  display: flex;
  align-items: center;
  gap: 16px;
}

.quantity-btn {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: 1px solid #dcdfe6;
  background: #fafafa;
  color: #303133;
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  user-select: none;
}

.quantity-btn:hover {
  border-color: #409eff;
  color: #409eff;
  background: #ecf5ff;
}

.quantity-value {
  font-size: 24px;
  font-weight: 600;
  color: #303133;
  min-width: 50px;
  text-align: center;
}

/* 右侧模板列表 */
.right-panel {
  align-self: start;
}

.template-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 320px;
  overflow-y: auto;
}

.template-item {
  padding: 14px;
  border-radius: 12px;
  border: 1px solid #e4e7ed;
  background: #fafafa;
  cursor: pointer;
  transition: all 0.2s;
}

.template-item:hover {
  border-color: #409eff;
  background: #ecf5ff;
}

.template-item.active {
  border-color: #409eff;
  background: #ecf5ff;
  border-width: 2px;
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.15);
}

.template-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.template-name {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.template-desc {
  font-size: 12px;
  color: #909399;
  margin-bottom: 8px;
}

.template-specs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

/* 配置摘要 */
.summary-card :deep(.el-card__body) {
  padding-bottom: 16px;
}

.summary-list {
  display: flex;
  flex-direction: column;
}

.summary-item {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  font-size: 13px;
}

.summary-label {
  color: #909399;
}

.summary-value {
  color: #303133;
  font-weight: 500;
  text-align: right;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.summary-item.highlight {
  padding: 10px 0;
}

.summary-item.highlight .summary-value {
  font-size: 18px;
  font-weight: 700;
  color: #409eff;
}

.summary-actions {
  display: flex;
  gap: 12px;
  margin-top: 16px;
}

.summary-actions :deep(.el-button) {
  height: 44px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
}

.btn-create {
  flex: 1;
  padding: 12px 24px;
  border-radius: 10px;
  border: none;
  background: linear-gradient(135deg, #409eff, #7c3aed);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(64, 158, 255, 0.3);
}

.btn-create:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(64, 158, 255, 0.4);
}

.btn-create:active {
  transform: translateY(0);
}

.btn-create:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

/* 占位 */
.loading-placeholder,
.empty-placeholder {
  padding: 20px;
  text-align: center;
  color: #c0c4cc;
  font-size: 13px;
}

.loading-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

/* 响应式 */
@media (max-width: 1200px) {
  .content-grid {
    grid-template-columns: 1fr;
  }
  .right-panel {
    position: static;
  }
}
</style>
