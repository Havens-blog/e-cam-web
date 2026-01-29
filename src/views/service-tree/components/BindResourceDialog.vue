<template>
  <el-dialog
    :model-value="visible"
    :title="`绑定资源到: ${node?.name || ''}`"
    width="720px"
    :close-on-click-modal="false"
    @update:model-value="$emit('update:visible', $event)"
  >
    <el-form :model="form" label-width="80px" label-position="right">
      <el-row :gutter="16">
        <el-col :span="8">
          <el-form-item label="环境" required>
            <el-select v-model="form.envId" placeholder="选择环境" style="width: 100%">
              <el-option
                v-for="env in environments"
                :key="env.id"
                :label="env.name"
                :value="env.id"
              >
                <span class="env-option">
                  <span class="env-dot" :style="{ background: env.color }"></span>
                  {{ env.name }}
                </span>
              </el-option>
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="资源类型" required>
            <el-select v-model="form.resourceType" placeholder="选择类型" style="width: 100%" @change="handleResourceTypeChange">
              <el-option label="CMDB实例" value="instance" />
              <el-option label="云资产" value="asset" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item v-if="form.resourceType === 'instance'" label="模型">
            <el-select v-model="form.modelUid" placeholder="全部模型" clearable style="width: 100%" @change="loadResources">
              <el-option
                v-for="model in modelList"
                :key="model.uid"
                :label="model.name"
                :value="model.uid"
              />
            </el-select>
          </el-form-item>
          <el-form-item v-else label="资产类型">
            <el-select v-model="form.assetType" placeholder="全部类型" clearable style="width: 100%" @change="loadResources">
              <el-option label="云服务器" value="ecs" />
              <el-option label="云数据库" value="rds" />
              <el-option label="对象存储" value="oss" />
              <el-option label="负载均衡" value="slb" />
              <el-option label="弹性IP" value="eip" />
              <el-option label="云硬盘" value="disk" />
              <el-option label="VPC" value="vpc" />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>
    </el-form>

    <div class="resource-section">
      <div class="section-header">
        <span class="section-title">可选资源 ({{ filteredResources.length }})</span>
        <el-input
          v-model="searchKeyword"
          placeholder="搜索资源名称"
          clearable
          size="small"
          style="width: 200px"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
      </div>

      <div class="resource-list">
        <el-table
          ref="tableRef"
          v-loading="loading"
          :data="filteredResources"
          max-height="320"
          size="small"
          @selection-change="handleSelectionChange"
        >
          <el-table-column type="selection" width="50" />
          <el-table-column prop="name" label="资源名称" min-width="150" show-overflow-tooltip />
          <el-table-column prop="resourceId" label="资源ID" width="180" show-overflow-tooltip />
          <el-table-column v-if="form.resourceType === 'instance'" prop="modelName" label="模型" width="100" />
          <el-table-column v-else prop="assetType" label="类型" width="100">
            <template #default="{ row }">
              {{ assetTypeMap[row.assetType] || row.assetType }}
            </template>
          </el-table-column>
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="getStatusType(row.status)" size="small">
                {{ getStatusText(row.status) }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <div class="selection-info">
        已选: <span class="count">{{ selectedResources.length }}</span> 个资源
      </div>
    </div>

    <template #footer>
      <el-button @click="$emit('update:visible', false)">取消</el-button>
      <el-button
        type="primary"
        :loading="submitting"
        :disabled="!canSubmit"
        @click="handleSubmit"
      >
        确认绑定
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { listAssetsApi, listCmdbInstancesApi, listCmdbModelsApi } from '@/api'
import { batchBindResourceApi } from '@/api/service-tree'
import type { Environment, ServiceTreeNode } from '@/api/types/service-tree'
import { Search } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, reactive, ref, watch } from 'vue'

interface Resource {
  id: number
  name: string
  resourceId: string
  modelName?: string
  assetType?: string
  status?: string
}

interface Model {
  uid: string
  name: string
}

const props = defineProps<{
  visible: boolean
  node: ServiceTreeNode | null
  environments: Environment[]
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  success: []
}>()

const form = reactive({
  envId: undefined as number | undefined,
  resourceType: 'asset' as 'instance' | 'asset',
  modelUid: '' as string,
  assetType: '' as string
})

const loading = ref(false)
const submitting = ref(false)
const searchKeyword = ref('')
const resources = ref<Resource[]>([])
const selectedResources = ref<Resource[]>([])
const modelList = ref<Model[]>([])

const assetTypeMap: Record<string, string> = {
  ecs: '云服务器',
  rds: '云数据库',
  oss: '对象存储',
  slb: '负载均衡',
  eip: '弹性IP',
  disk: '云硬盘',
  vpc: 'VPC'
}

// 过滤后的资源
const filteredResources = computed(() => {
  if (!searchKeyword.value) return resources.value
  const keyword = searchKeyword.value.toLowerCase()
  return resources.value.filter(r =>
    r.name.toLowerCase().includes(keyword) ||
    r.resourceId?.toLowerCase().includes(keyword)
  )
})

// 是否可提交
const canSubmit = computed(() => {
  return form.envId && form.resourceType && selectedResources.value.length > 0
})

// 获取状态类型
const getStatusType = (status: string): 'success' | 'info' | 'warning' | 'danger' | 'primary' => {
  const map: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'primary'> = {
    running: 'success',
    active: 'success',
    stopped: 'info',
    inactive: 'info',
    error: 'danger',
    terminated: 'danger'
  }
  return map[status] || 'info'
}

// 获取状态文本
const getStatusText = (status: string) => {
  const map: Record<string, string> = {
    running: '运行中',
    active: '活跃',
    stopped: '已停止',
    inactive: '未激活',
    error: '错误',
    terminated: '已终止'
  }
  return map[status] || status
}

// 加载 CMDB 模型列表
const loadModels = async () => {
  try {
    const res = await listCmdbModelsApi({ offset: 0, limit: 100 })
    const data = res.data as any
    modelList.value = data?.list || data?.models || []
  } catch (error) {
    console.error('加载模型列表失败:', error)
  }
}

// 资源类型变化
const handleResourceTypeChange = () => {
  form.modelUid = ''
  form.assetType = ''
  resources.value = []
  selectedResources.value = []
  loadResources()
}

// 加载资源列表
const loadResources = async () => {
  if (!form.resourceType) return
  loading.value = true
  resources.value = []
  
  try {
    if (form.resourceType === 'instance') {
      // 加载 CMDB 实例
      const params: any = { offset: 0, limit: 500 }
      if (form.modelUid) {
        params.model_uid = form.modelUid
      }
      const res = await listCmdbInstancesApi(params)
      const data = res.data as any
      const list = data?.list || data?.instances || []
      
      resources.value = list.map((item: any) => ({
        id: item.id,
        name: item.name || item.inst_name || `实例-${item.id}`,
        resourceId: item.inst_id || item.uid || String(item.id),
        modelName: item.model_name || item.model_uid,
        status: item.status || 'active'
      }))
    } else {
      // 加载云资产
      const params: any = { offset: 0, limit: 500 }
      if (form.assetType) {
        params.asset_type = form.assetType
      }
      const res = await listAssetsApi(params)
      const data = res.data as any
      const list = data?.assets || data?.list || []
      
      resources.value = list.map((item: any) => ({
        id: item.id,
        name: item.asset_name || item.name,
        resourceId: item.asset_id,
        assetType: item.asset_type,
        status: item.status || 'running'
      }))
    }
  } catch (error) {
    console.error('加载资源失败:', error)
  } finally {
    loading.value = false
  }
}

// 选择变化
const handleSelectionChange = (selection: Resource[]) => {
  selectedResources.value = selection
}

// 提交
const handleSubmit = async () => {
  if (!props.node || !form.envId || !form.resourceType) return

  try {
    submitting.value = true
    await batchBindResourceApi(props.node.id, {
      env_id: form.envId,
      resource_type: form.resourceType,
      resource_ids: selectedResources.value.map(r => r.id)
    })
    ElMessage.success(`成功绑定 ${selectedResources.value.length} 个资源`)
    emit('success')
  } catch (error: any) {
    ElMessage.error(error.message || '绑定失败')
  } finally {
    submitting.value = false
  }
}

watch(() => props.visible, (val) => {
  if (val) {
    form.envId = props.environments[0]?.id
    form.resourceType = 'asset'
    form.modelUid = ''
    form.assetType = ''
    searchKeyword.value = ''
    selectedResources.value = []
    loadModels()
    loadResources()
  }
})
</script>

<style scoped lang="scss">
.env-option {
  display: flex;
  align-items: center;
  gap: 8px;

  .env-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }
}

.resource-section {
  margin-top: 16px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  overflow: hidden;

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: var(--bg-hover);
    border-bottom: 1px solid var(--border-subtle);

    .section-title {
      font-size: 14px;
      font-weight: 500;
      color: var(--text-secondary);
    }
  }

  .resource-list {
    padding: 8px;
  }

  .selection-info {
    padding: 12px 16px;
    border-top: 1px solid var(--border-subtle);
    font-size: 13px;
    color: var(--text-tertiary);

    .count {
      color: var(--accent-blue);
      font-weight: 600;
    }
  }
}
</style>
