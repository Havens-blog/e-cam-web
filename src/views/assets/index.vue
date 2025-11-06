<template>
  <PageContainer>
    <ManagerHeader
      title="资产管理"
      subtitle="查看和管理所有云平台的资产"
      @refresh="fetchAssets"
    >
      <template #actions>
        <el-button type="primary" @click="handleDiscover">
          <el-icon><Search /></el-icon>
          发现资产
        </el-button>
        <el-button type="primary" @click="handleSync">
          <el-icon><Refresh /></el-icon>
          同步资产
        </el-button>
      </template>
    </ManagerHeader>

    <!-- 筛选器 -->
    <AssetFilters v-model="filters" @search="handleSearch" />

    <!-- 资产表格 -->
    <AssetTable
      :assets="assets"
      :loading="loading"
      @view="handleView"
      @edit="handleEdit"
      @delete="handleDelete"
    />

    <!-- 分页 -->
    <div v-if="pagination.total > 0" class="pagination-container">
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.size"
        :total="pagination.total"
        :page-sizes="[20, 50, 100, 200]"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="fetchAssets"
        @current-change="fetchAssets"
      />
    </div>

    <!-- 发现资产对话框 -->
    <el-dialog v-model="discoverDialogVisible" title="发现资产" width="500px">
      <el-form :model="discoverForm" label-width="100px">
        <el-form-item label="云厂商" required>
          <el-select
            v-model="discoverForm.provider"
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
        <el-form-item label="区域" required>
          <el-input v-model="discoverForm.region" placeholder="例如: cn-beijing" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="discoverDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="discovering" @click="submitDiscover">
          开始发现
        </el-button>
      </template>
    </el-dialog>

    <!-- 同步资产对话框 -->
    <el-dialog v-model="syncDialogVisible" title="同步资产" width="600px">
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
        <el-form-item label="资产类型">
          <el-select
            v-model="syncForm.asset_types"
            multiple
            placeholder="留空表示同步所有类型"
            style="width: 100%"
            clearable
          >
            <el-option label="虚拟机" value="vm" />
            <el-option label="存储" value="storage" />
            <el-option label="网络" value="network" />
            <el-option label="数据库" value="database" />
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
          同步操作将更新现有资产信息并发现新资产。如果不指定资产类型和区域，将同步该云厂商下的所有资产。
        </el-alert>
      </el-form>
      <template #footer>
        <el-button @click="syncDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="syncing" @click="submitSync">
          开始同步
        </el-button>
      </template>
    </el-dialog>

    <!-- 编辑资产对话框 -->
    <el-dialog v-model="editDialogVisible" title="编辑资产" width="500px">
      <el-form :model="editForm" label-width="100px">
        <el-form-item label="资产名称">
          <el-input v-model="editForm.asset_name" placeholder="请输入资产名称" />
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
        <el-form-item label="成本">
          <el-input-number
            v-model="editForm.cost"
            :min="0"
            :precision="2"
            controls-position="right"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="updating" @click="submitEdit">
          保存
        </el-button>
      </template>
    </el-dialog>
  </PageContainer>
</template>

<script setup lang="ts">
import {
    deleteAssetApi,
    listAssetsApi,
    submitDiscoverAssetsTaskApi,
    submitSyncAssetsTaskApi,
    updateAssetApi,
} from '@/api'
import type { Asset } from '@/api/types/asset'
import ManagerHeader from '@/components/ManagerHeader/index.vue'
import PageContainer from '@/components/PageContainer/index.vue'
import { ASSET_STATUS, CLOUD_PROVIDERS } from '@/utils/constants'
import { Refresh, Search } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import AssetFilters from './components/AssetFilters.vue'
import AssetTable from './components/AssetTable.vue'

const router = useRouter()

// 状态
const loading = ref(false)
const discovering = ref(false)
const updating = ref(false)
const discoverDialogVisible = ref(false)
const editDialogVisible = ref(false)

// 数据
const assets = ref<Asset[]>([])
const filters = reactive({
  provider: '',
  asset_type: '',
  region: '',
  status: '',
  asset_name: '',
})
const pagination = reactive({
  page: 1,
  size: 20,
  total: 0,
})

// 发现表单
const discoverForm = reactive({
  provider: '',
  region: '',
})

// 编辑表单
const editForm = reactive({
  id: 0,
  asset_name: '',
  status: '',
  cost: 0,
})

// 获取资产列表
const fetchAssets = async () => {
  loading.value = true
  try {
    const params = {
      provider: filters.provider || undefined,
      asset_type: filters.asset_type || undefined,
      region: filters.region || undefined,
      status: filters.status || undefined,
      asset_name: filters.asset_name || undefined,
      offset: (pagination.page - 1) * pagination.size,
      limit: pagination.size,
    }
    const { data } = await listAssetsApi(params)
    assets.value = data.assets
    pagination.total = data.total
  } catch (error: any) {
    ElMessage.error(error.message || '获取资产列表失败')
  } finally {
    loading.value = false
  }
}

// 搜索
const handleSearch = () => {
  pagination.page = 1
  fetchAssets()
}

// 查看资产详情
const handleView = (asset: Asset) => {
  router.push(`/assets/${asset.id}`)
}

// 编辑资产
const handleEdit = (asset: Asset) => {
  editForm.id = asset.id
  editForm.asset_name = asset.asset_name
  editForm.status = asset.status
  editForm.cost = asset.cost
  editDialogVisible.value = true
}

// 提交编辑
const submitEdit = async () => {
  if (!editForm.asset_name) {
    ElMessage.warning('请输入资产名称')
    return
  }

  updating.value = true
  try {
    await updateAssetApi({
      id: editForm.id,
      asset_name: editForm.asset_name,
      status: editForm.status,
      cost: editForm.cost,
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

// 删除资产
const handleDelete = async (asset: Asset) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除资产"${asset.asset_name}"吗？删除后将无法恢复。`,
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

// 发现资产
const handleDiscover = () => {
  discoverForm.provider = ''
  discoverForm.region = ''
  discoverDialogVisible.value = true
}

// 提交发现
const submitDiscover = async () => {
  if (!discoverForm.provider || !discoverForm.region) {
    ElMessage.warning('请填写完整信息')
    return
  }

  discovering.value = true
  try {
    const { data } = await submitDiscoverAssetsTaskApi({
      provider: discoverForm.provider,
      region: discoverForm.region,
    })
    ElMessage.success(`任务已提交，任务ID: ${data.task_id}`)
    discoverDialogVisible.value = false
    // 跳转到任务详情页面
    router.push(`/tasks/${data.task_id}`)
  } catch (error: any) {
    ElMessage.error(error.message || '提交任务失败')
  } finally {
    discovering.value = false
  }
}

// 同步资产对话框
const syncDialogVisible = ref(false)
const syncForm = reactive({
  provider: '',
  asset_types: [] as string[],
  regions: [] as string[],
})
const syncing = ref(false)

// 同步资产
const handleSync = () => {
  syncForm.provider = ''
  syncForm.asset_types = []
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
      asset_types: syncForm.asset_types.length > 0 ? syncForm.asset_types : undefined,
      regions: syncForm.regions.length > 0 ? syncForm.regions : undefined,
    })
    ElMessage.success(`同步任务已提交，任务ID: ${data.task_id}`)
    syncDialogVisible.value = false
    // 跳转到任务详情页面
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
.pagination-container {
  display: flex;
  justify-content: center;
  padding: calc(1rem + 0.2vw);
  margin-top: calc(1rem + 0.2vw);
  background: white;
  border-radius: calc(0.4rem + 0.1vw);
  box-shadow:
    0 1px 3px 0 rgba(0, 0, 0, 0.1),
    0 1px 2px 0 rgba(0, 0, 0, 0.06);
}
</style>
