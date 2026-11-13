<template>
  <el-drawer
    v-model="visible"
    title="关联资源"
    size="680px"
    :destroy-on-close="true"
    @close="handleClose"
  >
    <template #header>
      <div>
        <h2 style="font-size: 18px; font-weight: 600; margin: 0">关联资源</h2>
        <div style="font-size: 13px; color: var(--text-secondary); margin-top: 4px">
          标签：<el-tag size="small" type="primary" style="margin: 0 4px">{{ tagKey }} = {{ tagValue }}</el-tag>
          共 {{ total }} 个资源
        </div>
      </div>
    </template>

    <div style="display: flex; gap: 10px; margin-bottom: 16px">
      <el-select v-model="drawerFilter.resource_type" placeholder="全部资源类型" clearable style="width: 130px" @change="loadResources">
        <el-option label="ECS" value="ecs" />
        <el-option label="RDS" value="rds" />
        <el-option label="Redis" value="redis" />
        <el-option label="MongoDB" value="mongodb" />
        <el-option label="VPC" value="vpc" />
      </el-select>
      <el-select v-model="drawerFilter.provider" placeholder="全部云厂商" clearable style="width: 130px" @change="loadResources">
        <el-option label="阿里云" value="aliyun" />
        <el-option label="AWS" value="aws" />
        <el-option label="华为云" value="huawei" />
        <el-option label="腾讯云" value="tencent" />
        <el-option label="火山引擎" value="volcano" />
      </el-select>
      <div style="flex: 1"></div>
      <el-button type="primary" size="small" :disabled="selectedRows.length === 0" @click="handleBatchBind">
        🏷 批量打标
      </el-button>
      <el-button type="danger" size="small" :disabled="selectedRows.length === 0" @click="handleBatchUnbind">
        🗑 批量解绑
      </el-button>
    </div>

    <el-table
      :data="resources"
      v-loading="loading"
      style="width: 100%"
      @selection-change="handleSelectionChange"
    >
      <el-table-column type="selection" width="40" />
      <el-table-column prop="asset_id" label="资源ID" min-width="130">
        <template #default="{ row }">
          <span style="font-family: var(--font-mono); font-size: 13px; color: var(--text-secondary)">{{ row?.asset_id }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="asset_name" label="资源名称" min-width="130">
        <template #default="{ row }">
          <span class="cell-link">{{ row?.asset_name }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="resource_type" label="类型" width="80">
        <template #default="{ row }">
          <el-tag size="small" :type="getResourceTypeTag(row?.resource_type)">{{ row?.resource_type?.toUpperCase() }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="provider" label="云厂商" width="80">
        <template #default="{ row }">
          <el-tag size="small" :type="getProviderTag(row?.provider)">{{ getProviderLabel(row?.provider) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="region" label="区域" width="110">
        <template #default="{ row }">
          <span style="font-size: 13px">{{ row?.region }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="account_name" label="云账号" width="100">
        <template #default="{ row }">
          <span style="font-size: 13px">{{ row?.account_name }}</span>
        </template>
      </el-table-column>
    </el-table>

    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 12px; padding: 0 4px">
      <span style="font-size: 13px; color: var(--text-secondary)">共 {{ total }} 条</span>
      <el-pagination
        v-model:current-page="currentPage"
        :page-size="pageSize"
        :total="total"
        layout="prev, pager, next"
        small
        @current-change="loadResources"
      />
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import { listTagResourcesApi, unbindTagsApi } from '@/api/tag'
import type { TagResource } from '@/api/types/tag'
import { getProviderLabel } from '@/utils/constants'
import { ElMessage, ElMessageBox } from 'element-plus'
import { onUnmounted, reactive, ref, watch } from 'vue'
import { useLatestRequest } from '@/composables/useLatestRequest'

const props = defineProps<{
  modelValue: boolean
  tagKey: string
  tagValue: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void
  (e: 'unbind'): void
  (e: 'batchBind', resources: TagResource[]): void
}>()

const visible = ref(props.modelValue)
const loading = ref(false)
const resources = ref<TagResource[]>([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = 20

// 列表请求竞态守卫（iter279）：翻页连点时只认最后一次请求的结果
const latestRequest = useLatestRequest()
const selectedRows = ref<TagResource[]>([])

const drawerFilter = reactive({ resource_type: '', provider: '' })

watch(() => props.modelValue, (val) => { visible.value = val })
watch(visible, (val) => { emit('update:modelValue', val) })

// 卸载时作废在途请求，避免组件已销毁还写状态
onUnmounted(() => latestRequest.reset())

watch(() => props.modelValue, (val) => {
  if (val && props.tagKey) {
    currentPage.value = 1
    drawerFilter.resource_type = ''
    drawerFilter.provider = ''
    loadResources()
  }
})

const loadResources = async () => {
  // 竞态守卫（iter279）：翻页连点时，第 2 页的慢响应会晚于第 3 页返回，
  // 若不判断就会把列表覆盖回第 2 页的数据 —— 表现为「页码是 3、数据是第 2 页」。
  const seq = latestRequest.begin()
  loading.value = true
  try {
    const res = await listTagResourcesApi({
      key: props.tagKey,
      value: props.tagValue,
      provider: drawerFilter.provider || undefined,
      resource_type: drawerFilter.resource_type || undefined,
      offset: (currentPage.value - 1) * pageSize,
      limit: pageSize,
    })
    // 已有更新的请求发出：本次结果作废，不写任何状态（含 loading，交给最新那次收尾）
    if (!latestRequest.isCurrent(seq)) return
    resources.value = res.data?.items || []
    total.value = res.data?.total || 0
  } catch {
    if (!latestRequest.isCurrent(seq)) return
    ElMessage.error('获取关联资源失败')
    resources.value = []
  } finally {
    if (latestRequest.isCurrent(seq)) loading.value = false
  }
}

const handleSelectionChange = (rows: TagResource[]) => {
  selectedRows.value = rows
}

const handleBatchUnbind = async () => {
  if (selectedRows.value.length === 0) return
  try {
    await ElMessageBox.confirm(
      `确定要为选中的 ${selectedRows.value.length} 个资源解绑标签「${props.tagKey}」吗？\n\n` +
        '只移除这一个标签键，这些资源上的「其他标签」不受影响。\n' +
        '解绑会同步到云平台，之后可用「绑定」重新加回。',
      '批量解绑标签',
      { type: 'warning', confirmButtonText: '解绑', cancelButtonText: '取消' },
    )
  } catch {
    // user cancelled
    return
  }
  try {
    await unbindTagsApi({
      resources: selectedRows.value.map(r => ({
        account_id: r.account_id,
        region: r.region,
        resource_type: r.resource_type,
        resource_id: r.asset_id,
      })),
      tag_keys: [props.tagKey],
    })
    ElMessage.success('解绑成功')
    emit('unbind')
    loadResources()
  } catch (err: any) {
    ElMessage.error(err?.message || '批量解绑失败')
  }
}

const handleBatchBind = () => {
  if (selectedRows.value.length === 0) return
  emit('batchBind', selectedRows.value)
}

const handleClose = () => {
  emit('update:modelValue', false)
}

const getResourceTypeTag = (type?: string): 'primary' | 'success' | 'warning' | 'danger' | 'info' => {
  const map: Record<string, 'primary' | 'success' | 'warning' | 'danger' | 'info'> = { ecs: 'primary', rds: 'success', redis: 'warning', mongodb: 'info' }
  return map[type || ''] || 'info'
}

const getProviderTag = (provider?: string): 'primary' | 'success' | 'warning' | 'danger' | 'info' => {
  const map: Record<string, 'primary' | 'success' | 'warning' | 'danger' | 'info'> = { aliyun: 'warning', aws: 'primary', huawei: 'danger', tencent: 'info', volcano: 'success' }
  return map[provider || ''] || 'info'
}
</script>

<style scoped lang="scss">
.cell-link {
  color: var(--accent-text);
  cursor: pointer;
  &:hover { text-decoration: underline; }
}
</style>
