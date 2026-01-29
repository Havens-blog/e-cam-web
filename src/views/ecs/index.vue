<template>
  <PageContainer>
    <ManagerHeader
      title="云虚拟机"
      subtitle="查看和管理所有云平台的虚拟机实例"
      @refresh="fetchAssets"
    >
      <template #actions>
        <el-button type="primary" @click="handleSync">
          <el-icon><Refresh /></el-icon>
          同步虚拟机
        </el-button>
      </template>
    </ManagerHeader>

    <!-- 筛选器 -->
    <EcsFilters v-model="filters" @search="handleSearch" />

    <!-- 虚拟机表格 -->
    <EcsTable
      :assets="assets"
      :loading="loading"
      @view="handleView"
      @edit="handleEdit"
      @delete="handleDelete"
    />

    <!-- 固定分页 -->
    <div v-if="pagination.total > 0" class="pagination-fixed">
      <div class="pagination-content">
        <div class="pagination-info">
          <div class="page-display">
            <el-button 
              size="small" 
              :disabled="pagination.page === 1"
              @click="handleCurrentChange(1)"
              title="第一页"
            >
              首页
            </el-button>
            <span class="page-info">{{ pagination.page }}/{{ totalPages }}</span>
            <el-button 
              size="small" 
              :disabled="pagination.page === totalPages"
              @click="handleCurrentChange(totalPages)"
              title="最后一页"
            >
              末页
            </el-button>
          </div>
          <span class="total-info">共 {{ pagination.total }} 条</span>
        </div>
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.size"
          :total="pagination.total"
          :page-sizes="[10, 20, 50, 100]"
          layout="sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </div>

    <!-- 同步虚拟机对话框 -->
    <el-dialog v-model="syncDialogVisible" title="同步虚拟机" width="600px">
      <el-form :model="syncForm" label-width="100px">
        <el-form-item label="云厂商" required>
          <el-select
            v-model="syncForm.provider"
            placeholder="请选择云厂商"
            style="width: 100%"
          >
            <el-option
              v-for="p in CLOUD_PROVIDERS"
              :key="p.value"
              :label="p.label"
              :value="p.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="区域">
          <el-select
            v-model="syncForm.regions"
            multiple
            placeholder="留空表示同步所有区域"
            style="width: 100%"
            clearable
            allow-create
            filterable
          >
            <el-option label="北京" value="cn-beijing" />
            <el-option label="上海" value="cn-shanghai" />
            <el-option label="广州" value="cn-guangzhou" />
            <el-option label="深圳" value="cn-shenzhen" />
          </el-select>
        </el-form-item>
        <el-alert
          title="提示"
          type="info"
          :closable="false"
          show-icon
          style="margin-top: 16px"
        >
          同步操作将更新现有虚拟机信息并发现新实例。
        </el-alert>
      </el-form>
      <template #footer>
        <el-button @click="syncDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="syncing" @click="submitSync">
          开始同步
        </el-button>
      </template>
    </el-dialog>

    <!-- 编辑虚拟机对话框 -->
    <el-dialog v-model="editDialogVisible" title="编辑虚拟机" width="500px">
      <el-form :model="editForm" label-width="100px">
        <el-form-item label="实例名称">
          <el-input v-model="editForm.asset_name" placeholder="请输入实例名称" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select
            v-model="editForm.status"
            placeholder="请选择状态"
            style="width: 100%"
          >
            <el-option
              v-for="s in ASSET_STATUS"
              :key="s.value"
              :label="s.label"
              :value="s.value"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="updating" @click="submitEdit">
          保存
        </el-button>
      </template>
    </el-dialog>

    <!-- 虚拟机详情抽屉 -->
    <DetailDrawer
      v-model:visible="detailDrawerVisible"
      v-model:active-tab-name="detailActiveTab"
      :title="detailAsset?.asset_name || '虚拟机详情'"
      size="65%"
      :tabs="[
        { name: 'basic', label: '基本信息' },
        { name: 'config', label: '配置详情' },
        { name: 'monitor', label: '监控数据' }
      ]"
    >
      <template #header-actions>
        <el-button size="small" @click="handleEdit(detailAsset!)">
          <el-icon><Edit /></el-icon>
          编辑
        </el-button>
        <el-button size="small" type="danger" @click="handleDelete(detailAsset!)">
          <el-icon><Delete /></el-icon>
          删除
        </el-button>
      </template>

      <template #tab-basic>
        <el-descriptions :column="2" border>
          <el-descriptions-item label="实例名称">
            {{ detailAsset?.asset_name || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="实例类型">
            <el-tag size="small">ECS</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="云平台">
            <el-tag size="small">{{ detailAsset?.provider || '-' }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="区域">
            {{ detailAsset?.region || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="detailAsset?.status === 'running' ? 'success' : 'info'" size="small">
              {{ detailAsset?.status || '-' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="标签">
            <span v-if="detailAsset?.attributes?.tags && detailAsset.attributes.tags.length > 0">
              <el-tag v-for="tag in detailAsset.attributes.tags" :key="tag.key" size="small" style="margin-right: 4px">
                {{ tag.key }}: {{ tag.value }}
              </el-tag>
            </span>
            <span v-else>-</span>
          </el-descriptions-item>
          <el-descriptions-item label="实例ID" :span="2">
            {{ detailAsset?.asset_id || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="创建时间">
            {{ detailAsset?.create_time || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="更新时间">
            {{ detailAsset?.update_time || '-' }}
          </el-descriptions-item>
        </el-descriptions>
      </template>

      <template #tab-config>
        <el-card shadow="never">
          <template #header>
            <span>配置信息</span>
          </template>
          <pre class="config-content">{{ detailAsset?.attributes || '暂无配置信息' }}</pre>
        </el-card>
      </template>

      <template #tab-monitor>
        <el-empty description="监控数据功能开发中" :image-size="100">
          <el-button type="primary">敬请期待</el-button>
        </el-empty>
      </template>
    </DetailDrawer>
  </PageContainer>
</template>

<script setup lang="ts">
import {
  deleteAssetApi,
  listAssetsApi,
  submitSyncAssetsTaskApi,
  updateAssetApi,
} from '@/api'
import type { Asset } from '@/api/types/asset'
import DetailDrawer from '@/components/DetailDrawer/index.vue'
import ManagerHeader from '@/components/ManagerHeader/index.vue'
import PageContainer from '@/components/PageContainer/index.vue'
import { ASSET_STATUS, CLOUD_PROVIDERS } from '@/utils/constants'
import { Delete, Edit, Refresh } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import EcsFilters from './components/EcsFilters.vue'
import EcsTable from './components/EcsTable.vue'

const router = useRouter()

// 计算属性
const totalPages = computed(() => Math.ceil(pagination.total / pagination.size))

// 状态
const loading = ref(false)
const updating = ref(false)
const editDialogVisible = ref(false)

// 数据
const assets = ref<Asset[]>([])
const filters = reactive({
  provider: '',
  region: '',
  status: '',
  asset_name: '',
})
const pagination = reactive({
  page: 1,
  size: 20,
  total: 0,
})

// 编辑表单
const editForm = reactive({
  id: 0,
  asset_name: '',
  status: '',
})

// 获取虚拟机列表
const fetchAssets = async () => {
  loading.value = true
  try {
    const params: any = {
      provider: filters.provider || undefined,
      asset_type: 'ecs', // 固定为 ecs 类型
      region: filters.region || undefined,
      status: filters.status || undefined,
      name: filters.asset_name || undefined,
      offset: (pagination.page - 1) * pagination.size,
      limit: pagination.size,
    }
    const { data } = await listAssetsApi(params)
    assets.value = data.assets || []
    pagination.total = data.total || 0
  } catch (error: any) {
    ElMessage.error(error.message || '获取虚拟机列表失败')
  } finally {
    loading.value = false
  }
}

// 搜索
const handleSearch = () => {
  pagination.page = 1
  fetchAssets()
}

// 分页大小变化
const handleSizeChange = (newSize: number) => {
  pagination.size = newSize
  pagination.page = 1
  fetchAssets()
}

// 当前页变化
const handleCurrentChange = (newPage: number) => {
  pagination.page = newPage
  fetchAssets()
}

// 详情抽屉
const detailDrawerVisible = ref(false)
const detailAsset = ref<Asset | null>(null)
const detailActiveTab = ref('basic')

// 查看虚拟机详情
const handleView = (asset: Asset) => {
  detailAsset.value = asset
  detailDrawerVisible.value = true
}

// 编辑虚拟机
const handleEdit = (asset: Asset) => {
  editForm.id = asset.id
  editForm.asset_name = asset.asset_name
  editForm.status = asset.status
  editDialogVisible.value = true
}

// 提交编辑
const submitEdit = async () => {
  if (!editForm.asset_name) {
    ElMessage.warning('请输入实例名称')
    return
  }

  updating.value = true
  try {
    await updateAssetApi({
      id: editForm.id,
      asset_name: editForm.asset_name,
      status: editForm.status,
    })
    ElMessage.success('更新成功')
    editDialogVisible.value = false
    fetchAssets()
  } catch (error: any) {
    ElMessage.error(error.message || '更新失败')
  } finally {
    updating.value = false
  }
}

// 删除虚拟机
const handleDelete = async (asset: Asset) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除虚拟机"${asset.asset_name}"吗？删除后将无法恢复。`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )

    await deleteAssetApi(asset.id)
    ElMessage.success('删除成功')
    fetchAssets()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '删除失败')
    }
  }
}

// 同步虚拟机对话框
const syncDialogVisible = ref(false)
const syncForm = reactive({
  provider: '',
  regions: [] as string[],
})
const syncing = ref(false)

// 同步虚拟机
const handleSync = () => {
  syncForm.provider = ''
  syncForm.regions = []
  syncDialogVisible.value = true
}

// 提交同步
const submitSync = async () => {
  if (!syncForm.provider) {
    ElMessage.warning('请选择云厂商')
    return
  }

  syncing.value = true
  try {
    const { data } = await submitSyncAssetsTaskApi({
      provider: syncForm.provider,
      asset_types: ['ecs'], // 只同步 ecs 类型
      regions: syncForm.regions.length > 0 ? syncForm.regions : undefined,
    })
    ElMessage.success(`同步任务已提交，任务ID: ${data.task_id}`)
    syncDialogVisible.value = false
    router.push(`/tasks/${data.task_id}`)
  } catch (error: any) {
    ElMessage.error(error.message || '提交同步任务失败')
  } finally {
    syncing.value = false
  }
}

// 初始化
onMounted(() => {
  fetchAssets()
})
</script>

<style scoped lang="scss">
.pagination-fixed {
  position: sticky;
  bottom: 0;
  z-index: 100;
  background: var(--bg-elevated);
  border-top: 1px solid var(--border-subtle);
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.1);
  transition: background-color 0.3s ease, border-color 0.3s ease;
  
  .pagination-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 24px;
    
    @media (max-width: 768px) {
      flex-direction: column;
      gap: 12px;
      padding: 12px 16px;
    }
  }
  
  .pagination-info {
    display: flex;
    align-items: center;
    gap: 16px;
    
    .page-display {
      display: flex;
      align-items: center;
      gap: 8px;
      
      .page-info {
        font-size: 16px;
        font-weight: 600;
        color: var(--text-primary);
        background: var(--bg-hover);
        padding: 6px 12px;
        border-radius: 6px;
        min-width: 60px;
        text-align: center;
      }
    }
    
    .total-info {
      font-size: 14px;
      color: var(--text-secondary);
    }
  }
  
  :deep(.el-pagination) {
    .el-pagination__total {
      display: none;
    }
  }
}

.config-content {
  background: var(--bg-elevated);
  padding: 16px;
  border-radius: 8px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-secondary);
  overflow-x: auto;
  max-height: 500px;
  border: 1px solid var(--border-subtle);
}
</style>
