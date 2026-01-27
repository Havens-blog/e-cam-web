<template>
  <el-dialog
    :model-value="visible"
    :title="`绑定资源到: ${node?.name || ''}`"
    width="640px"
    :close-on-click-modal="false"
    @update:model-value="$emit('update:visible', $event)"
  >
    <el-form :model="form" label-width="80px" label-position="right">
      <el-form-item label="环境" required>
        <el-select v-model="form.envId" placeholder="选择环境" style="width: 200px">
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
      <el-form-item label="资源类型" required>
        <el-select v-model="form.resourceType" placeholder="选择类型" style="width: 200px" @change="loadResources">
          <el-option label="CMDB实例" value="instance" />
          <el-option label="云资产" value="asset" />
        </el-select>
      </el-form-item>
    </el-form>

    <div class="resource-section">
      <div class="section-header">
        <span class="section-title">可选资源</span>
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
          max-height="300"
          size="small"
          @selection-change="handleSelectionChange"
        >
          <el-table-column type="selection" width="50" />
          <el-table-column prop="name" label="资源名称" min-width="150" show-overflow-tooltip />
          <el-table-column prop="asset_id" label="资产ID" width="150" show-overflow-tooltip />
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="row.status === 'running' ? 'success' : 'info'" size="small">
                {{ row.status === 'running' ? '运行中' : row.status }}
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
import { batchBindResourceApi } from '@/api/service-tree'
import type { Environment, ServiceTreeNode } from '@/api/types/service-tree'
import { Search } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, reactive, ref, watch } from 'vue'

interface Resource {
  id: number
  name: string
  asset_id?: string
  status?: string
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
  resourceType: 'instance' as 'instance' | 'asset'
})

const loading = ref(false)
const submitting = ref(false)
const searchKeyword = ref('')
const resources = ref<Resource[]>([])
const selectedResources = ref<Resource[]>([])

// 过滤后的资源
const filteredResources = computed(() => {
  if (!searchKeyword.value) return resources.value
  const keyword = searchKeyword.value.toLowerCase()
  return resources.value.filter(r =>
    r.name.toLowerCase().includes(keyword) ||
    r.asset_id?.toLowerCase().includes(keyword)
  )
})

// 是否可提交
const canSubmit = computed(() => {
  return form.envId && form.resourceType && selectedResources.value.length > 0
})

// 加载资源列表（模拟数据，实际需要调用对应 API）
const loadResources = async () => {
  if (!form.resourceType) return
  loading.value = true
  try {
    // TODO: 根据 resourceType 调用不同的 API
    // 这里使用模拟数据
    await new Promise(resolve => setTimeout(resolve, 500))
    resources.value = [
      { id: 1, name: 'web-server-01', asset_id: 'i-xxx001', status: 'running' },
      { id: 2, name: 'web-server-02', asset_id: 'i-xxx002', status: 'running' },
      { id: 3, name: 'db-master-01', asset_id: 'i-xxx003', status: 'running' },
      { id: 4, name: 'db-slave-01', asset_id: 'i-xxx004', status: 'stopped' },
      { id: 5, name: 'cache-01', asset_id: 'i-xxx005', status: 'running' }
    ]
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
    form.resourceType = 'instance'
    searchKeyword.value = ''
    selectedResources.value = []
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
