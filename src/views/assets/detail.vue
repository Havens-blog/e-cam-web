<template>
  <PageContainer>
    <ManagerHeader
      title="资产详情"
      :subtitle="asset?.asset_name || ''"
      :show-refresh-button="false"
      :show-back-button="true"
      @back="router.back()"
    >
      <template #actions>
        <el-button @click="handleEdit">
          <el-icon><Edit /></el-icon>
          编辑
        </el-button>
        <el-button type="danger" @click="handleDelete">
          <el-icon><Delete /></el-icon>
          删除
        </el-button>
      </template>
    </ManagerHeader>

    <div v-loading="loading" class="detail-content">
      <el-row :gutter="20">
        <!-- 基本信息卡片 -->
        <el-col :span="12">
          <el-card class="info-card">
            <template #header>
              <div class="card-header">
                <span>基本信息</span>
              </div>
            </template>
            <div class="info-list">
              <div class="info-item">
                <span class="label">资产ID:</span>
                <span class="value">{{ asset?.asset_id }}</span>
              </div>
              <div class="info-item">
                <span class="label">资产名称:</span>
                <span class="value">{{ asset?.asset_name }}</span>
              </div>
              <div class="info-item">
                <span class="label">云厂商:</span>
                <el-tag size="small">{{
                  getProviderLabel(asset?.provider || '')
                }}</el-tag>
              </div>
              <div class="info-item">
                <span class="label">资产类型:</span>
                <span class="value">{{
                  getAssetTypeLabel(asset?.asset_type || '')
                }}</span>
              </div>
              <div class="info-item">
                <span class="label">区域:</span>
                <span class="value">{{ asset?.region }}</span>
              </div>
              <div class="info-item">
                <span class="label">可用区:</span>
                <span class="value">{{ asset?.zone || '-' }}</span>
              </div>
              <div class="info-item">
                <span class="label">状态:</span>
                <AssetStatusBadge v-if="asset" :status="asset.status" />
              </div>
              <div class="info-item">
                <span class="label">成本:</span>
                <span class="value cost">{{ formatCost(asset?.cost || 0) }}/月</span>
              </div>
            </div>
          </el-card>
        </el-col>

        <!-- 时间信息卡片 -->
        <el-col :span="12">
          <el-card class="info-card">
            <template #header>
              <span>时间信息</span>
            </template>
            <div class="info-list">
              <div class="info-item">
                <span class="label">创建时间:</span>
                <span class="value">{{ formatTime(asset?.create_time) }}</span>
              </div>
              <div class="info-item">
                <span class="label">更新时间:</span>
                <span class="value">{{ formatTime(asset?.update_time) }}</span>
              </div>
              <div class="info-item">
                <span class="label">发现时间:</span>
                <span class="value">{{ formatTime(asset?.discover_time) }}</span>
              </div>
            </div>
          </el-card>
        </el-col>

        <!-- 标签卡片 -->
        <el-col :span="24">
          <el-card class="info-card">
            <template #header>
              <div class="card-header">
                <span>标签</span>
              </div>
            </template>
            <div class="tags-container">
              <el-tag v-for="tag in asset?.tags" :key="tag.key" class="tag-item">
                {{ tag.key }}: {{ tag.value }}
              </el-tag>
              <el-empty
                v-if="!asset?.tags || asset.tags.length === 0"
                description="暂无标签"
              />
            </div>
          </el-card>
        </el-col>

        <!-- 元数据卡片 -->
        <el-col :span="24">
          <el-card class="info-card">
            <template #header>
              <span>元数据</span>
            </template>
            <div class="metadata-container">
              <pre v-if="asset?.metadata" class="metadata-content">{{
                formatJSON(asset.metadata)
              }}</pre>
              <el-empty v-else description="暂无元数据" />
            </div>
          </el-card>
        </el-col>
      </el-row>
    </div>

    <!-- 编辑对话框 -->
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
import { deleteAssetApi, getAssetDetailApi, updateAssetApi } from '@/api'
import type { AssetDetail } from '@/api/types/asset'
import ManagerHeader from '@/components/ManagerHeader/index.vue'
import PageContainer from '@/components/PageContainer/index.vue'
import {
  ASSET_STATUS,
  getAssetTypeLabel,
  getProviderLabel,
} from '@/utils/constants'
import { formatCost, formatJSON, formatTime } from '@/utils/formatters'
import { Delete, Edit } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AssetStatusBadge from './components/AssetStatusBadge.vue'

const router = useRouter()
const route = useRoute()

// 状态
const loading = ref(false)
const updating = ref(false)
const editDialogVisible = ref(false)

// 数据
const asset = ref<AssetDetail | null>(null)

// 编辑表单
const editForm = reactive({
  asset_name: '',
  status: '',
  cost: 0,
})

// 获取资产详情
const fetchAssetDetail = async () => {
  const id = Number(route.params.id)
  if (!id) {
    ElMessage.error('资产ID无效')
    router.back()
    return
  }

  loading.value = true
  try {
    const { data } = await getAssetDetailApi(id)
    asset.value = data
  } catch (error: any) {
    ElMessage.error(error.message || '获取资产详情失败')
    router.back()
  } finally {
    loading.value = false
  }
}

// 编辑资产
const handleEdit = () => {
  if (!asset.value) return

  editForm.asset_name = asset.value.asset_name
  editForm.status = asset.value.status
  editForm.cost = asset.value.cost
  editDialogVisible.value = true
}

// 提交编辑
const submitEdit = async () => {
  if (!asset.value || !editForm.asset_name) {
    ElMessage.warning('请输入资产名称')
    return
  }

  updating.value = true
  try {
    await updateAssetApi({
      id: asset.value.id,
      asset_name: editForm.asset_name,
      status: editForm.status,
      cost: editForm.cost,
    })
    ElMessage.success('更新成功')
    editDialogVisible.value = false
    fetchAssetDetail()
  } catch (error: any) {
    ElMessage.error(error.message || '更新失败')
  } finally {
    updating.value = false
  }
}

// 删除资产
const handleDelete = async () => {
  if (!asset.value) return

  try {
    await ElMessageBox.confirm(
      `确定要删除资产"${asset.value.asset_name}"吗？删除后将无法恢复。`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )

    await deleteAssetApi(asset.value.id)
    ElMessage.success('删除成功')
    router.push('/assets')
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '删除失败')
    }
  }
}

// 初始化
onMounted(() => {
  fetchAssetDetail()
})
</script>

<style scoped lang="scss">
.detail-content {
  .info-card {
    margin-bottom: calc(1rem + 0.2vw);

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 600;
    }

    .info-list {
      .info-item {
        display: flex;
        justify-content: space-between;
        padding: calc(0.6rem + 0.1vw) 0;
        border-bottom: 1px solid #f3f4f6;
        font-size: calc(0.75rem + 0.1vw);

        &:last-child {
          border-bottom: none;
        }

        .label {
          color: #6b7280;
          font-weight: 500;
        }

        .value {
          color: #1f2937;
          font-weight: 400;
          text-align: right;

          &.cost {
            color: #10b981;
            font-weight: 600;
            font-size: calc(0.85rem + 0.1vw);
          }
        }
      }
    }

    .tags-container {
      display: flex;
      flex-wrap: wrap;
      gap: calc(0.5rem + 0.1vw);
      min-height: 50px;

      .tag-item {
        font-size: calc(0.7rem + 0.1vw);
      }
    }

    .metadata-container {
      min-height: 100px;

      .metadata-content {
        background: #f9fafb;
        padding: calc(1rem + 0.2vw);
        border-radius: calc(0.3rem + 0.1vw);
        font-size: calc(0.7rem + 0.1vw);
        line-height: 1.6;
        overflow-x: auto;
        margin: 0;
      }
    }
  }
}
</style>
