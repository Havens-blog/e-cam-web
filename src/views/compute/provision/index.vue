<template>
  <div class="provision-page">
    <div class="page-title-area">
      <h2 class="page-title">{{ isEditMode ? '编辑主机模板' : isTemplateMode ? '创建主机模板' : '创建云服务器' }}</h2>
      <p class="page-subtitle">{{ isEditMode ? '修改模板配置参数' : isTemplateMode ? '配置主机参数并保存为模板，方便后续快速创建' : '选择云账号和配置参数，快速创建云服务器实例' }}</p>
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

        <!-- 2. 网络配置（优先选择，决定地域和可用区） -->
        <el-card class="config-card">
          <template #header>
            <div class="card-header">
              <span class="card-title"><span class="title-icon" style="background: linear-gradient(135deg, #a855f7, #c084fc)"><el-icon><Connection /></el-icon></span> 网络配置</span>
              <span v-if="form.region" class="card-header-extra">
                地域: {{ currentRegionLabel }}{{ form.zone ? ' · ' + form.zone : '' }}
              </span>
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
                  :loading="vpcLoading"
                  style="width: 100%"
                  @change="handleVPCChange"
                >
                  <el-option
                    v-for="vpc in safeVPCs"
                    :key="vpc?.vpc_id"
                    :label="`${vpc?.vpc_name || vpc?.vpc_id} (${vpc?.region || ''} · ${vpc?.cidr_block || ''})`"
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
                  :teleported="true"
                  @change="handleSubnetChange"
                >
                  <el-option
                    v-for="sn in safeSubnets"
                    :key="sn?.subnet_id"
                    :label="`${sn?.name || sn?.subnet_id}${sn?.zone ? ' [' + sn.zone + ']' : ''}${sn?.cidr_block ? ' ' + sn.cidr_block : ''}`"
                    :value="sn?.subnet_id"
                  />
                </el-select>
              </div>
            </div>
          </div>

          <div class="form-section">
            <div class="form-section-title">地域 / 可用区 <span class="auto-fill-hint">(由 VPC / 子网自动填充)</span></div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">地域</label>
                <el-input v-model="currentRegionLabel" placeholder="选择 VPC 后自动填充" readonly />
              </div>
              <div class="form-group">
                <label class="form-label">可用区</label>
                <el-input v-model="form.zone" placeholder="选择子网后自动填充" readonly />
              </div>
            </div>
          </div>

          <div class="form-section">
            <div class="form-section-title">安全组 <span v-if="form.security_group_ids.length" class="sg-count-badge">{{ form.security_group_ids.length }} 已选</span></div>
            <div v-if="vpcLoading || subnetLoading" class="loading-placeholder">
              <el-icon class="is-loading"><Loading /></el-icon> 加载中...
            </div>
            <div v-else-if="safeSecurityGroups.length === 0" class="empty-placeholder">
              请先选择 VPC
            </div>
            <div v-else class="sg-selector">
              <!-- 已选安全组标签 -->
              <div v-if="selectedSecurityGroups.length > 0" class="sg-selected-tags">
                <div v-for="sg in selectedSecurityGroups" :key="sg.security_group_id" class="sg-selected-tag">
                  <el-icon class="sg-tag-icon"><Lock /></el-icon>
                  <span class="sg-tag-name">{{ sg.name || sg.security_group_id }}</span>
                  <el-icon class="sg-tag-remove" @click="toggleSecurityGroup(sg.security_group_id)"><Close /></el-icon>
                </div>
              </div>
              <!-- 搜索框 -->
              <div class="sg-search-bar">
                <el-input
                  v-model="sgSearchKey"
                  placeholder="搜索安全组名称或 ID..."
                  clearable
                  size="small"
                  :prefix-icon="Search"
                />
                <el-button size="small" type="primary" link @click="sgPanelExpanded = !sgPanelExpanded">
                  {{ sgPanelExpanded ? '收起' : `展开 (${filteredSecurityGroups.length})` }}
                </el-button>
              </div>
              <!-- 安全组列表面板 -->
              <div v-show="sgPanelExpanded" class="sg-panel">
                <div v-if="filteredSecurityGroups.length === 0" class="sg-panel-empty">无匹配安全组</div>
                <div
                  v-for="sg in filteredSecurityGroups"
                  :key="sg?.security_group_id"
                  class="sg-panel-item"
                  :class="{ selected: form.security_group_ids.includes(sg?.security_group_id || '') }"
                  @click="toggleSecurityGroup(sg?.security_group_id || '')"
                >
                  <div class="sg-panel-check">
                    <el-icon v-if="form.security_group_ids.includes(sg?.security_group_id || '')"><Check /></el-icon>
                  </div>
                  <div class="sg-panel-info">
                    <div class="sg-panel-name">{{ sg?.name || sg?.security_group_id }}</div>
                    <div v-if="sg?.description" class="sg-panel-desc">{{ sg.description }}</div>
                    <div v-if="sg?.name && sg?.security_group_id !== sg?.name" class="sg-panel-id">{{ sg.security_group_id }}</div>
                  </div>
                </div>
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
        </el-card>

        <!-- 3. 基础配置（实例规格/镜像，依赖地域） -->
        <el-card class="config-card">
          <template #header>
            <div class="card-header">
              <span class="card-title"><span class="title-icon" style="background: linear-gradient(135deg, #22c55e, #10b981)"><el-icon><Cpu /></el-icon></span> 基础配置</span>
            </div>
          </template>

          <div v-if="!form.region" class="empty-placeholder">
            请先选择 VPC 以确定地域，再选择实例规格和镜像
          </div>
          <template v-else>
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
                    <el-option-group v-if="customImages.length > 0" label="自定义镜像">
                      <el-option
                        v-for="img in customImages"
                        :key="img?.image_id"
                        :label="`${img?.name || ''} (${img?.os_type || ''})`"
                        :value="img?.image_id"
                      />
                    </el-option-group>
                    <el-option-group v-if="publicImages.length > 0" label="公共镜像">
                      <el-option
                        v-for="img in publicImages"
                        :key="img?.image_id"
                        :label="`${img?.name || ''} (${img?.os_type || ''})`"
                        :value="img?.image_id"
                      />
                    </el-option-group>
                    <el-option-group v-if="sharedImages.length > 0" label="共享镜像">
                      <el-option
                        v-for="img in sharedImages"
                        :key="img?.image_id"
                        :label="`${img?.name || ''} (${img?.os_type || ''})`"
                        :value="img?.image_id"
                      />
                    </el-option-group>
                  </el-select>
                </div>
              </div>
            </div>
          </template>
        </el-card>

        <!-- 4. 存储配置 -->
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
              <el-input
                v-model="templateSearchKey"
                placeholder="搜索模板"
                clearable
                size="small"
                style="width: 120px"
                :prefix-icon="Search"
              />
            </div>
          </template>
          <div v-if="templateLoading" class="loading-placeholder">
            <el-icon class="is-loading"><Loading /></el-icon> 加载中...
          </div>
          <div v-else-if="filteredTemplates.length === 0" class="empty-placeholder">{{ templateSearchKey ? '无匹配模板' : '暂无模板' }}</div>
          <div v-else class="template-list">
            <div
              v-for="tpl in filteredTemplates"
              :key="tpl?.id"
              class="template-item"
              :class="{ active: selectedTemplateId === tpl?.id }"
              @click="applyTemplate(tpl)"
            >
              <div class="template-header-row">
                <span class="tpl-icon" :style="{ background: getTemplateIconBg(tpl) }">{{ getTemplateIcon(tpl) }}</span>
                <div class="tpl-info">
                  <span class="template-name">{{ tpl?.name }}</span>
                  <div v-if="tpl?.description" class="template-desc">{{ tpl?.description }}</div>
                </div>
                <el-tag size="small" :type="getProviderTagType(tpl?.provider)">
                  {{ getProviderLabel(tpl?.provider) }}
                </el-tag>
              </div>
              <div class="template-specs">
                <el-tag v-if="tpl?.instance_type" size="small" type="info">{{ tpl?.instance_type }}</el-tag>
                <el-tag v-if="tpl?.region" size="small" type="info">{{ tpl?.region }}</el-tag>
                <el-tag v-if="tpl?.system_disk_size" size="small" type="info">{{ tpl?.system_disk_size }}GB {{ tpl?.system_disk_type === 'cloud_ssd' ? 'SSD' : tpl?.system_disk_type === 'cloud_essd' ? 'ESSD' : '' }}</el-tag>
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
              <span class="summary-label">地域</span>
              <span class="summary-value">{{ currentRegionLabel || '未选择' }}</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">可用区</span>
              <span class="summary-value">{{ form.zone || '未选择' }}</span>
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
              <span class="summary-label">计费方式</span>
              <span class="summary-value">{{ form.charge_type === 'PrePaid' ? '包年包月' : form.charge_type === 'PostPaid' ? '按量付费' : '未选择' }}</span>
            </div>
            <div class="summary-item highlight">
              <span class="summary-label">购买数量</span>
              <span class="summary-value">{{ form.count }} 台</span>
            </div>
          </div>

          <div class="summary-actions">
            <template v-if="isTemplateMode">
              <el-button style="flex:1" @click="$router.back()">返回</el-button>
              <button class="btn-create" :disabled="saveTemplateLoading" @click="handleSaveTemplate">
                <el-icon v-if="!saveTemplateLoading"><FolderAdd /></el-icon>
                <el-icon v-else class="is-loading"><Loading /></el-icon>
                {{ isEditMode ? '更新模板' : '保存模板' }}
              </button>
            </template>
            <template v-else>
              <el-button style="flex:1" @click="handleSaveTemplate" :loading="saveTemplateLoading">
                <el-icon><FolderAdd /></el-icon> 保存为模板
              </el-button>
              <button class="btn-create" :disabled="submitting" @click="handleSubmit">
                <el-icon v-if="!submitting"><CircleCheck /></el-icon>
                <el-icon v-else class="is-loading"><Loading /></el-icon>
                立即创建
              </button>
            </template>
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
import { listImageAssetsApi, listSecurityGroupAssetsApi, listVPCAssetsApi, listVSwitchAssetsApi } from '@/api/asset'
import { listCloudAccountsApi } from '@/api/index'
import {
  createTemplateApi,
  directProvisionApi,
  getTemplateApi,
  listImagesApi,
  listInstanceTypesApi,
  listTemplatesApi,
  updateTemplateApi
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
  Search,
  Setting,
  UserFilled
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import InstanceTypeSelector from './components/InstanceTypeSelector.vue'

const route = useRoute()
const router = useRouter()

// ==================== 模式判断 ====================
const isTemplateMode = computed(() => route.query.mode === 'template')
const editTemplateId = computed(() => route.query.edit ? Number(route.query.edit) : 0)
const isEditMode = computed(() => editTemplateId.value > 0)

// ==================== 状态 ====================
const cloudAccounts = ref<CloudAccount[]>([])
const showAccountPanel = ref(false)
const vpcLoading = ref(false)
const specLoading = ref(false)
const subnetLoading = ref(false)
const submitting = ref(false)
const templateLoading = ref(false)
const saveTemplateLoading = ref(false)
const selectedTemplateId = ref<number | null>(null)
const templateSearchKey = ref('')
const showSaveTemplateDialog = ref(false)
const templateName = ref('')
const templateDesc = ref('')
const newTagKey = ref('')
const newTagValue = ref('')

// 云资源选项
const instanceTypes = ref<InstanceTypeInfo[]>([])

// 镜像扩展类型（包含来源标识）
interface ImageWithOwner extends ImageInfo {
  owner_alias?: string // system, self, others
}
const images = ref<ImageWithOwner[]>([])
const vpcs = ref<VPCInfo[]>([])
const subnets = ref<SubnetInfo[]>([])
const securityGroups = ref<SecurityGroupInfo[]>([])
const templates = ref<VMTemplate[]>([])

// 扩展 VPC 类型，包含 region 信息
interface VPCWithRegion extends VPCInfo {
  region?: string
}
const vpcsWithRegion = ref<VPCWithRegion[]>([])

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
const safeAccounts = computed(() => (cloudAccounts.value || []).filter(item => item != null))
const safeInstanceTypes = computed(() => (instanceTypes.value || []).filter(item => item != null))
const safeImages = computed(() => (images.value || []).filter(item => item != null))
const customImages = computed(() => safeImages.value.filter(i => i?.owner_alias === 'self'))
const publicImages = computed(() => safeImages.value.filter(i => !i?.owner_alias || i?.owner_alias === 'system'))
const sharedImages = computed(() => safeImages.value.filter(i => i?.owner_alias === 'others'))
const safeVPCs = computed(() => (vpcsWithRegion.value || []).filter(item => item != null))
const safeSubnets = computed(() => (subnets.value || []).filter(item => item != null))
const safeSecurityGroups = computed(() => (securityGroups.value || []).filter(item => item != null))
const safeTemplates = computed(() => (templates.value || []).filter(item => item != null))

const filteredTemplates = computed(() => {
  const key = templateSearchKey.value.trim().toLowerCase()
  if (!key) return safeTemplates.value
  return safeTemplates.value.filter(t =>
    (t?.name || '').toLowerCase().includes(key) ||
    (t?.description || '').toLowerCase().includes(key) ||
    (t?.instance_type || '').toLowerCase().includes(key)
  )
})

const selectedAccount = computed(() =>
  safeAccounts.value.find(a => a?.id === form.cloud_account_id) || null
)

const currentRegionLabel = computed(() => form.region || '')

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

function getTemplateIcon(tpl: VMTemplate | null): string {
  if (!tpl) return '📋'
  const name = (tpl.name || '').toLowerCase()
  if (name.includes('web') || name.includes('nginx')) return '🖥️'
  if (name.includes('mysql') || name.includes('数据库') || name.includes('db')) return '🗄️'
  if (name.includes('gpu') || name.includes('训练') || name.includes('ai')) return '⚡'
  if (name.includes('k8s') || name.includes('kubernetes') || name.includes('容器')) return '🐳'
  if (name.includes('测试') || name.includes('test') || name.includes('dev')) return '✏️'
  if (name.includes('海外') || name.includes('overseas')) return '🌍'
  return '📋'
}

function getTemplateIconBg(tpl: VMTemplate | null): string {
  if (!tpl) return 'linear-gradient(135deg, #64748b, #94a3b8)'
  const name = (tpl.name || '').toLowerCase()
  if (name.includes('web') || name.includes('nginx')) return 'linear-gradient(135deg, #3b82f6, #60a5fa)'
  if (name.includes('mysql') || name.includes('数据库') || name.includes('db')) return 'linear-gradient(135deg, #f59e0b, #fbbf24)'
  if (name.includes('gpu') || name.includes('训练') || name.includes('ai')) return 'linear-gradient(135deg, #8b5cf6, #a78bfa)'
  if (name.includes('k8s') || name.includes('kubernetes') || name.includes('容器')) return 'linear-gradient(135deg, #06b6d4, #22d3ee)'
  if (name.includes('测试') || name.includes('test') || name.includes('dev')) return 'linear-gradient(135deg, #22c55e, #4ade80)'
  if (name.includes('海外') || name.includes('overseas')) return 'linear-gradient(135deg, #ec4899, #f472b6)'
  return 'linear-gradient(135deg, #64748b, #94a3b8)'
}

// ==================== 资产数据映射工具 ====================
function mapVPCAssets(items: any[]): VPCWithRegion[] {
  return (Array.isArray(items) ? items : []).filter((v: any) => v != null).map((v: any) => ({
    vpc_id: v?.asset_id || v?.attributes?.vpc_id || '',
    vpc_name: v?.asset_name || v?.attributes?.vpc_name || '',
    cidr_block: v?.attributes?.cidr_block || '',
    status: v?.attributes?.status || 'Available',
    region: v?.region || v?.attributes?.region || ''
  }))
}

function mapSubnetAssets(items: any[]): SubnetInfo[] {
  return (Array.isArray(items) ? items : []).filter((s: any) => s != null).map((s: any) => ({
    subnet_id: s?.asset_id || s?.attributes?.vswitch_id || s?.attributes?.subnet_id || '',
    name: s?.asset_name || s?.attributes?.vswitch_name || s?.attributes?.subnet_name || '',
    cidr_block: s?.attributes?.cidr_block || '',
    zone: s?.attributes?.zone || s?.attributes?.zone_id || '',
    vpc_id: s?.attributes?.vpc_id || ''
  }))
}

function mapSecurityGroupAssets(items: any[]): SecurityGroupInfo[] {
  return (Array.isArray(items) ? items : []).filter((s: any) => s != null).map((s: any) => ({
    security_group_id: s?.asset_id || s?.attributes?.security_group_id || '',
    name: s?.asset_name || s?.attributes?.security_group_name || '',
    description: s?.attributes?.description || '',
    vpc_id: s?.attributes?.vpc_id || ''
  }))
}

function mapImageAssets(items: any[]): ImageWithOwner[] {
  return (Array.isArray(items) ? items : []).filter((i: any) => i != null).map((i: any) => {
    const ownerAlias = i?.attributes?.image_owner_alias || i?.attributes?.owner_alias || 'self'
    return {
      image_id: i?.asset_id || i?.attributes?.image_id || '',
      name: i?.asset_name || i?.attributes?.image_name || i?.attributes?.name || '',
      os_type: i?.attributes?.os_type || '',
      platform: i?.attributes?.platform || '',
      owner_alias: ownerAlias
    }
  })
}

// ==================== 云账号选择 → 加载 VPC 列表 ====================
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
  vpcsWithRegion.value = []
  subnets.value = []
  securityGroups.value = []

  if (!acc?.id) return

  // 选择云账号后，直接加载该账号下所有 VPC（不限地域）
  vpcLoading.value = true
  try {
    const res = await listVPCAssetsApi({ account_id: acc.id, limit: 200 })
    const vpcItems = res?.data?.items || res?.data || []
    vpcsWithRegion.value = mapVPCAssets(vpcItems)

    // 自动选择第一个 VPC 并级联
    if (vpcsWithRegion.value.length > 0) {
      form.vpc_id = vpcsWithRegion.value[0]?.vpc_id || ''
      if (form.vpc_id) {
        await handleVPCChange(form.vpc_id)
      }
    }
  } catch {
    vpcsWithRegion.value = []
  } finally {
    vpcLoading.value = false
  }
}

// ==================== VPC 变更 → 自动填充地域，加载子网/安全组/实例规格/镜像 ====================
async function handleVPCChange(vpcId: string) {
  form.subnet_id = ''
  form.zone = ''
  form.instance_type = ''
  form.image_id = ''
  form.security_group_ids = []
  subnets.value = []
  securityGroups.value = []
  sgSearchKey.value = ''
  sgPanelExpanded.value = false
  instanceTypes.value = []
  images.value = []

  if (!form.cloud_account_id || !vpcId) return

  // 从 VPC 数据中提取地域并自动填充
  const selectedVPC = safeVPCs.value.find(v => v?.vpc_id === vpcId)
  const vpcRegion = selectedVPC?.region || ''
  console.log('[Provision] VPC region extraction:', { vpcId, vpcRegion, selectedVPC })
  if (vpcRegion) {
    form.region = vpcRegion
  }

  // 并行加载：子网 + 安全组 + 实例规格 + 镜像
  subnetLoading.value = true
  specLoading.value = true
  const accountId = form.cloud_account_id!
  const region = form.region
  console.log('[Provision] handleVPCChange loading resources:', { accountId, region, vpcId })
  try {
    const results = await Promise.allSettled([
      listVSwitchAssetsApi({ account_id: accountId, region, vpc_id: vpcId, limit: 200 }),
      listSecurityGroupAssetsApi({ account_id: accountId, region, vpc_id: vpcId, limit: 200 }),
      region ? listInstanceTypesApi(accountId, region) : Promise.resolve(null),
      region ? listImageAssetsApi({ account_id: accountId, region, limit: 200 }) : Promise.resolve(null),
      region ? listImagesApi(accountId, region) : Promise.resolve(null)
    ])

    // 子网
    if (results[0].status === 'fulfilled' && results[0].value) {
      const snItems = results[0].value?.data?.items || results[0].value?.data || []
      subnets.value = mapSubnetAssets(snItems)
    }
    // 安全组
    if (results[1].status === 'fulfilled' && results[1].value) {
      const sgItems = results[1].value?.data?.items || results[1].value?.data || []
      securityGroups.value = mapSecurityGroupAssets(sgItems)
    }
    // 实例规格
    if (results[2].status === 'fulfilled' && results[2].value) {
      instanceTypes.value = (results[2].value as any)?.data || []
    } else if (results[2].status === 'rejected') {
      console.error('[Provision] 加载实例规格失败:', results[2].reason)
    }
    // 镜像（合并：数据库自定义镜像 + 云 API 公共镜像）
    const mergedImages: ImageWithOwner[] = []
    // 数据库镜像（自定义/共享）
    if (results[3].status === 'fulfilled' && results[3].value) {
      const imgItems = (results[3].value as any)?.data?.items || (results[3].value as any)?.data || []
      mergedImages.push(...mapImageAssets(imgItems))
    } else if (results[3].status === 'rejected') {
      console.error('[Provision] 加载数据库镜像失败:', results[3].reason)
    }
    // 云 API 公共镜像
    if (results[4]?.status === 'fulfilled' && results[4].value) {
      const publicImgs = (results[4].value as any)?.data || []
      const mapped: ImageWithOwner[] = (Array.isArray(publicImgs) ? publicImgs : [])
        .filter((i: any) => i != null)
        .map((i: any) => ({ ...i, owner_alias: 'system' }))
      // 去重（数据库可能也有公共镜像）
      const existingIds = new Set(mergedImages.map(i => i.image_id))
      for (const img of mapped) {
        if (!existingIds.has(img.image_id)) {
          mergedImages.push(img)
        }
      }
    }
    images.value = mergedImages

    // 自动选择默认值
    const safeSubs = safeSubnets.value
    if (safeSubs.length > 0 && !form.subnet_id) {
      form.subnet_id = safeSubs[0]?.subnet_id || ''
      // 自动填充可用区
      const firstZone = safeSubs[0]?.zone || ''
      if (firstZone) form.zone = firstZone
    }
    const safeSgs = safeSecurityGroups.value
    if (safeSgs.length > 0 && form.security_group_ids.length === 0) {
      form.security_group_ids = [safeSgs[0]?.security_group_id || ''].filter(Boolean)
    }
    const safeTypes = safeInstanceTypes.value
    if (safeTypes.length > 0 && !form.instance_type) {
      form.instance_type = safeTypes[0]?.instance_type || ''
    }
    const safeImgs = safeImages.value
    if (safeImgs.length > 0 && !form.image_id) {
      form.image_id = safeImgs[0]?.image_id || ''
    }
  } catch (e: any) {
    console.error('加载云资源失败', e)
  } finally {
    subnetLoading.value = false
    specLoading.value = false
  }
}

// ==================== 子网变更 → 自动设置可用区 ====================
function handleSubnetChange(subnetId: string) {
  const sn = safeSubnets.value.find(s => s?.subnet_id === subnetId)
  if (sn?.zone) {
    form.zone = sn.zone
  }
}

// ==================== 安全组多选 ====================
const sgSearchKey = ref('')
const sgPanelExpanded = ref(false)

const filteredSecurityGroups = computed(() => {
  const key = sgSearchKey.value.trim().toLowerCase()
  if (!key) return safeSecurityGroups.value
  return safeSecurityGroups.value.filter(sg =>
    (sg?.name || '').toLowerCase().includes(key) ||
    (sg?.security_group_id || '').toLowerCase().includes(key) ||
    (sg?.description || '').toLowerCase().includes(key)
  )
})

const selectedSecurityGroups = computed(() =>
  safeSecurityGroups.value.filter(sg =>
    form.security_group_ids.includes(sg?.security_group_id || '')
  )
)

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

  if (form.cloud_account_id) {
    loadResourcesForTemplate(form.cloud_account_id, form.region, form.vpc_id)
  }
  ElMessage.success(`已应用模板: ${tpl.name}`)
}

async function loadResourcesForTemplate(accountId: number, region: string, vpcId: string) {
  // 加载 VPC 列表
  vpcLoading.value = true
  try {
    const res = await listVPCAssetsApi({ account_id: accountId, limit: 200 })
    const vpcItems = res?.data?.items || res?.data || []
    vpcsWithRegion.value = mapVPCAssets(vpcItems)
  } catch { vpcsWithRegion.value = [] }
  finally { vpcLoading.value = false }

  // 加载实例规格 + 镜像（双数据源）
  if (region && accountId) {
    specLoading.value = true
    try {
      const [typesRes, dbImagesRes, apiImagesRes] = await Promise.allSettled([
        listInstanceTypesApi(accountId, region),
        listImageAssetsApi({ account_id: accountId, region, limit: 200 }),
        listImagesApi(accountId, region)
      ])
      if (typesRes.status === 'fulfilled') instanceTypes.value = typesRes.value?.data || []
      // 合并镜像
      const merged: ImageWithOwner[] = []
      if (dbImagesRes.status === 'fulfilled') {
        const imgItems = dbImagesRes.value?.data?.items || dbImagesRes.value?.data || []
        merged.push(...mapImageAssets(imgItems))
      }
      if (apiImagesRes.status === 'fulfilled') {
        const publicImgs = (apiImagesRes.value as any)?.data || []
        const existingIds = new Set(merged.map(i => i.image_id))
        for (const img of (Array.isArray(publicImgs) ? publicImgs : []).filter((i: any) => i != null)) {
          if (!existingIds.has(img.image_id)) {
            merged.push({ ...img, owner_alias: 'system' })
          }
        }
      }
      images.value = merged
    } catch { /* ignore */ }
    finally { specLoading.value = false }
  }

  // 加载子网 + 安全组
  if (vpcId && accountId && region) {
    subnetLoading.value = true
    try {
      const [subnetsRes, sgRes] = await Promise.allSettled([
        listVSwitchAssetsApi({ account_id: accountId, region, vpc_id: vpcId, limit: 200 }),
        listSecurityGroupAssetsApi({ account_id: accountId, region, vpc_id: vpcId, limit: 200 })
      ])
      if (subnetsRes.status === 'fulfilled') {
        const snItems = subnetsRes.value?.data?.items || subnetsRes.value?.data || []
        subnets.value = mapSubnetAssets(snItems)
      }
      if (sgRes.status === 'fulfilled') {
        const sgItems = sgRes.value?.data?.items || sgRes.value?.data || []
        securityGroups.value = mapSecurityGroupAssets(sgItems)
      }
    } catch { /* ignore */ }
    finally { subnetLoading.value = false }
  }
}

// ==================== 保存模板 ====================
function handleSaveTemplate() {
  if (isEditMode.value) {
    confirmSaveTemplate()
    return
  }
  templateName.value = ''
  templateDesc.value = ''
  showSaveTemplateDialog.value = true
}

async function confirmSaveTemplate() {
  if (!isEditMode.value && !templateName.value.trim()) {
    ElMessage.warning('请输入模板名称')
    return
  }
  if (!form.cloud_account_id) {
    ElMessage.warning('请先选择云账号')
    return
  }
  saveTemplateLoading.value = true
  try {
    const templateData = {
      name: templateName.value.trim(),
      description: templateDesc.value.trim(),
      provider: form.provider,
      cloud_account_id: form.cloud_account_id || 0,
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
    }

    if (isEditMode.value) {
      await updateTemplateApi(editTemplateId.value, templateData)
      ElMessage.success('模板更新成功')
      router.push('/compute/template')
    } else {
      await createTemplateApi(templateData)
      ElMessage.success('模板保存成功')
      showSaveTemplateDialog.value = false
      loadTemplates()
    }
  } catch (e: any) {
    const msg = e?.response?.data?.msg || e?.message || '保存模板失败'
    ElMessage.error(msg)
  } finally {
    saveTemplateLoading.value = false
  }
}

// ==================== 提交创建 ====================
async function handleSubmit() {
  const missing: string[] = []
  if (!form.cloud_account_id) missing.push('云账号')
  if (!form.vpc_id) missing.push('VPC')
  if (!form.subnet_id) missing.push('子网')
  if (!form.region) missing.push('地域')
  if (!form.instance_type) missing.push('实例规格')
  if (!form.image_id) missing.push('镜像')

  if (missing.length > 0) {
    ElMessage.error(`请填写以下必填项: ${missing.join('、')}`)
    return
  }

  submitting.value = true
  try {
    await directProvisionApi({
      provider: form.provider,
      cloud_account_id: form.cloud_account_id!,
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
  } catch (e: any) {
    const msg = e?.response?.data?.msg || e?.message || '提交创建任务失败'
    ElMessage.error(msg)
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

  // 自动选择第一个云账号（编辑模式跳过）
  if (!editTemplateId.value) {
    const firstAccount = (cloudAccounts.value || []).find(a => a != null)
    if (firstAccount && !form.cloud_account_id) {
      await handleAccountSelect(firstAccount)
    }
  }
}

// ==================== 编辑模板加载 ====================
async function loadEditTemplate() {
  if (!editTemplateId.value) return
  try {
    const res = await getTemplateApi(editTemplateId.value)
    const tpl = (res?.data as any) || res
    if (!tpl || !tpl.id) {
      ElMessage.error('模板不存在')
      return
    }

    templateName.value = tpl.name || ''
    templateDesc.value = tpl.description || ''

    const acc = (cloudAccounts.value || []).find(a => a?.id === tpl.cloud_account_id)
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

    if (form.cloud_account_id) {
      await loadResourcesForTemplate(form.cloud_account_id, form.region, form.vpc_id)
    }
  } catch (e: any) {
    const msg = e?.response?.data?.msg || e?.message || '加载模板数据失败'
    ElMessage.error(msg)
  }
}

onMounted(async () => {
  // 并行加载账号和模板
  const accountsPromise = loadAccounts()
  loadTemplates()
  await accountsPromise

  if (editTemplateId.value) {
    await loadEditTemplate()
  }
})
</script>

<style scoped>
.provision-page { padding: 24px; }
.page-title-area { margin-bottom: 24px; }
.page-title { font-size: 22px; font-weight: 700; margin: 0 0 4px 0; color: #303133; }
.page-subtitle { color: #909399; font-size: 14px; margin: 0; }
.content-grid { display: grid; grid-template-columns: 1fr 400px; gap: 24px; align-items: start; }
.config-card { margin-bottom: 20px; }
.provision-page :deep(.el-card) { border-radius: 16px; overflow: hidden; }
.provision-page :deep(.el-input__wrapper),
.provision-page :deep(.el-select .el-input__wrapper) { border-radius: 10px; }
.provision-page :deep(.el-slider__runway) { border-radius: 6px; }
.card-header { display: flex; justify-content: space-between; align-items: center; }
.card-title { font-size: 15px; font-weight: 600; display: flex; align-items: center; gap: 10px; color: #303133; }
.title-icon { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 16px; flex-shrink: 0; }
.card-header-extra { font-size: 12px; color: #909399; }
.auto-fill-hint { font-size: 11px; color: #c0c4cc; font-weight: 400; }

.selected-account-banner { display: flex; align-items: center; gap: 14px; padding: 16px; border-radius: 14px; background: #ecf5ff; border: 1px solid #d9ecff; margin-bottom: 16px; }
.account-icon { width: 48px; height: 48px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; color: #fff; flex-shrink: 0; }
.account-info { flex: 1; }
.account-name { font-size: 15px; font-weight: 600; color: #303133; margin-bottom: 2px; }
.account-meta { font-size: 12px; color: #909399; }
.account-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
.account-card { display: flex; align-items: center; gap: 12px; padding: 14px; border-radius: 12px; border: 1px solid #e4e7ed; background: #fafafa; cursor: pointer; transition: all 0.2s; }
.account-card:hover { border-color: #409eff; background: #ecf5ff; }
.account-card.active { border-color: #409eff; background: #ecf5ff; box-shadow: 0 2px 12px rgba(64, 158, 255, 0.15); border-width: 2px; }
.account-card-icon { width: 40px; height: 40px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: #fff; flex-shrink: 0; }
.account-card-info { flex: 1; min-width: 0; }
.account-card-name { font-size: 13px; font-weight: 600; color: #303133; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.account-card-desc { font-size: 11px; color: #909399; }
.account-card-check { width: 22px; height: 22px; border-radius: 50%; border: 2px solid #dcdfe6; display: flex; align-items: center; justify-content: center; font-size: 12px; color: transparent; flex-shrink: 0; transition: all 0.2s; }
.account-card.active .account-card-check { background: #409eff; border-color: #409eff; color: #fff; }

.form-section { margin-bottom: 20px; }
.form-section:last-child { margin-bottom: 0; }
.form-section-title { font-size: 13px; font-weight: 600; color: #606266; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
.form-section-title::before { content: ''; width: 3px; height: 14px; background: linear-gradient(180deg, #409eff, #67c23a); border-radius: 2px; }
.form-row { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
.form-group { display: flex; flex-direction: column; gap: 6px; }
.form-group.full { grid-column: 1 / -1; }
.form-label { font-size: 13px; font-weight: 500; color: #606266; }
.slider-hint { font-size: 11px; color: #c0c4cc; margin-top: 4px; }

.disk-item { display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 12px; border: 1px solid #e4e7ed; background: #fafafa; margin-bottom: 8px; }
.disk-icon { font-size: 20px; }
.disk-info { flex: 1; }
.disk-size { display: flex; align-items: center; gap: 6px; }
.size-unit { font-size: 12px; color: #909399; }

.sg-count-badge { font-size: 11px; font-weight: 500; color: #409eff; background: #ecf5ff; padding: 1px 8px; border-radius: 10px; }

.sg-selector { display: flex; flex-direction: column; gap: 10px; }
.sg-selected-tags { display: flex; flex-wrap: wrap; gap: 6px; }
.sg-selected-tag { display: flex; align-items: center; gap: 4px; padding: 4px 8px 4px 6px; border-radius: 6px; background: #ecf5ff; border: 1px solid #d9ecff; font-size: 12px; color: #409eff; }
.sg-tag-icon { font-size: 12px; color: #a0cfff; }
.sg-tag-name { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sg-tag-remove { font-size: 12px; cursor: pointer; color: #a0cfff; transition: color 0.2s; }
.sg-tag-remove:hover { color: #f56c6c; }

.sg-search-bar { display: flex; align-items: center; gap: 8px; }
.sg-search-bar :deep(.el-input) { flex: 1; }

.sg-panel { max-height: 280px; overflow-y: auto; border: 1px solid #e4e7ed; border-radius: 10px; background: #fafafa; }
.sg-panel-empty { padding: 20px; text-align: center; color: #c0c4cc; font-size: 13px; }
.sg-panel-item { display: flex; align-items: flex-start; gap: 10px; padding: 10px 14px; cursor: pointer; transition: background 0.15s; border-bottom: 1px solid #f0f0f0; }
.sg-panel-item:last-child { border-bottom: none; }
.sg-panel-item:hover { background: #f5f7fa; }
.sg-panel-item.selected { background: #ecf5ff; }
.sg-panel-check { width: 20px; height: 20px; border-radius: 4px; border: 2px solid #dcdfe6; display: flex; align-items: center; justify-content: center; font-size: 12px; color: transparent; flex-shrink: 0; margin-top: 1px; transition: all 0.15s; }
.sg-panel-item.selected .sg-panel-check { background: #409eff; border-color: #409eff; color: #fff; }
.sg-panel-info { flex: 1; min-width: 0; }
.sg-panel-name { font-size: 13px; font-weight: 500; color: #303133; word-break: break-all; }
.sg-panel-desc { font-size: 11px; color: #909399; margin-top: 2px; word-break: break-all; }
.sg-panel-id { font-size: 11px; color: #c0c4cc; margin-top: 1px; font-family: monospace; }

.tags-input-area { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.tag-chip { display: flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 4px; background: #ecf5ff; border: 1px solid #d9ecff; font-size: 12px; color: #409eff; }
.tag-close { cursor: pointer; font-size: 12px; }
.tag-close:hover { color: #f56c6c; }
.tag-add-row { display: flex; align-items: center; gap: 6px; }

.quantity-selector { display: flex; align-items: center; gap: 16px; }
.quantity-btn { width: 36px; height: 36px; border-radius: 10px; border: 1px solid #dcdfe6; background: #fafafa; color: #303133; font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; user-select: none; }
.quantity-btn:hover { border-color: #409eff; color: #409eff; background: #ecf5ff; }
.quantity-value { font-size: 24px; font-weight: 600; color: #303133; min-width: 50px; text-align: center; }

.right-panel { align-self: start; }
.template-list { display: flex; flex-direction: column; gap: 10px; max-height: 320px; overflow-y: auto; }
.template-item { padding: 14px; border-radius: 12px; border: 1px solid var(--el-border-color-lighter); background: var(--el-fill-color-lighter); cursor: pointer; transition: all 0.2s; }
.template-item:hover { border-color: #8b5cf6; background: rgba(139, 92, 246, 0.05); }
.template-item.active { border-color: #8b5cf6; background: rgba(139, 92, 246, 0.08); border-width: 2px; box-shadow: 0 2px 8px rgba(139, 92, 246, 0.15); }
.template-header-row { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.tpl-icon { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; }
.tpl-info { flex: 1; min-width: 0; }
.template-name { font-size: 14px; font-weight: 600; color: var(--el-text-color-primary); display: block; }
.template-desc { font-size: 12px; color: var(--el-text-color-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.template-specs { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }

.summary-card :deep(.el-card__body) { padding-bottom: 16px; }
.summary-list { display: flex; flex-direction: column; }
.summary-item { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
.summary-label { color: #909399; }
.summary-value { color: #303133; font-weight: 500; text-align: right; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.summary-item.highlight { padding: 10px 0; }
.summary-item.highlight .summary-value { font-size: 18px; font-weight: 700; color: #409eff; }
.summary-actions { display: flex; gap: 12px; margin-top: 16px; }
.summary-actions :deep(.el-button) { height: 44px; border-radius: 10px; font-size: 14px; font-weight: 600; }

.btn-create { flex: 1; padding: 12px 24px; border-radius: 10px; border: none; background: linear-gradient(135deg, #409eff, #7c3aed); color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; transition: all 0.3s ease; box-shadow: 0 4px 15px rgba(64, 158, 255, 0.3); }
.btn-create:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(64, 158, 255, 0.4); }
.btn-create:active { transform: translateY(0); }
.btn-create:disabled { opacity: 0.6; cursor: not-allowed; transform: none; box-shadow: none; }

.loading-placeholder, .empty-placeholder { padding: 20px; text-align: center; color: #c0c4cc; font-size: 13px; }
.loading-placeholder { display: flex; align-items: center; justify-content: center; gap: 8px; }

@media (max-width: 1200px) {
  .content-grid { grid-template-columns: 1fr; }
  .right-panel { position: static; }
}
</style>
