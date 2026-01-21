<template>
  <div class="topology-page">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-content">
        <div class="header-info">
          <h1 class="page-title">拓扑视图</h1>
          <p class="page-subtitle">可视化展示资源模型和实例之间的关联关系</p>
        </div>
        <div class="header-actions">
          <el-radio-group v-model="viewMode" class="view-toggle">
            <el-radio-button value="model">模型拓扑</el-radio-button>
            <el-radio-button value="instance">实例拓扑</el-radio-button>
          </el-radio-group>
        </div>
      </div>
    </div>

    <!-- 模型拓扑视图 -->
    <div v-if="viewMode === 'model'" class="topology-container">
      <div class="topology-toolbar">
        <div class="toolbar-left">
          <div class="filter-item">
            <span class="filter-label">云厂商</span>
            <el-select v-model="modelFilter.provider" placeholder="全部" clearable class="filter-select" @change="fetchModelTopology">
              <el-option label="阿里云" value="aliyun" />
              <el-option label="AWS" value="aws" />
              <el-option label="Azure" value="azure" />
            </el-select>
          </div>
        </div>
        <div class="toolbar-right">
          <el-button @click="fetchModelTopology">
            <el-icon><Refresh /></el-icon>
            刷新
          </el-button>
        </div>
      </div>

      <div class="topology-graph" v-loading="modelLoading">
        <div v-if="modelTopology.nodes.length === 0 && !modelLoading" class="empty-state">
          <el-icon :size="48"><Share /></el-icon>
          <div class="empty-title">暂无模型拓扑数据</div>
          <div class="empty-desc">请先创建模型和模型关系</div>
        </div>
        <div v-else class="graph-content">
          <!-- 模型节点列表 -->
          <div class="nodes-grid">
            <div
              v-for="node in modelTopology.nodes"
              :key="node.uid"
              class="model-node"
              :class="getCategoryClass(node.category)"
            >
              <div class="node-icon">
                <el-icon :size="24"><Grid /></el-icon>
              </div>
              <div class="node-info">
                <div class="node-name">{{ node.name }}</div>
                <div class="node-uid">{{ node.uid }}</div>
              </div>
              <div class="node-meta">
                <span class="category-tag">{{ getCategoryLabel(node.category) }}</span>
                <span class="provider-tag">{{ getProviderLabel(node.provider) }}</span>
              </div>
            </div>
          </div>

          <!-- 关系列表 -->
          <div v-if="modelTopology.edges.length > 0" class="edges-section">
            <h3 class="section-title">模型关系 ({{ modelTopology.edges.length }})</h3>
            <div class="edges-list">
              <div v-for="(edge, index) in modelTopology.edges" :key="index" class="edge-item">
                <code class="edge-source">{{ edge.source_uid }}</code>
                <div class="edge-arrow">
                  <span class="edge-type">{{ edge.relation_name }}</span>
                  <el-icon><Right /></el-icon>
                </div>
                <code class="edge-target">{{ edge.target_uid }}</code>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 实例拓扑视图 -->
    <div v-if="viewMode === 'instance'" class="topology-container">
      <div class="topology-toolbar">
        <div class="toolbar-left">
          <div class="filter-item">
            <span class="filter-label">选择实例</span>
            <el-select
              v-model="instanceFilter.instanceId"
              placeholder="请选择实例"
              filterable
              remote
              :remote-method="searchInstances"
              :loading="instanceSearchLoading"
              class="filter-select instance-select"
              @change="fetchInstanceTopology"
            >
              <el-option
                v-for="inst in instanceOptions"
                :key="inst.id"
                :label="`${inst.asset_name || inst.asset_id} (${inst.uid})`"
                :value="inst.id"
              />
            </el-select>
          </div>
          <div class="filter-item">
            <span class="filter-label">深度</span>
            <el-select v-model="instanceFilter.depth" class="filter-select-sm" @change="fetchInstanceTopology">
              <el-option :value="1" label="1 层" />
              <el-option :value="2" label="2 层" />
              <el-option :value="3" label="3 层" />
            </el-select>
          </div>
          <div class="filter-item">
            <span class="filter-label">方向</span>
            <el-select v-model="instanceFilter.direction" class="filter-select-sm" @change="fetchInstanceTopology">
              <el-option value="both" label="双向" />
              <el-option value="outgoing" label="出向" />
              <el-option value="incoming" label="入向" />
            </el-select>
          </div>
        </div>
        <div class="toolbar-right">
          <el-button :disabled="!instanceFilter.instanceId" @click="fetchInstanceTopology">
            <el-icon><Refresh /></el-icon>
            刷新
          </el-button>
        </div>
      </div>

      <div class="topology-graph" v-loading="instanceLoading">
        <div v-if="!instanceFilter.instanceId" class="empty-state">
          <el-icon :size="48"><Search /></el-icon>
          <div class="empty-title">请选择一个实例</div>
          <div class="empty-desc">选择实例后将展示其关联的资源拓扑图</div>
        </div>
        <div v-else-if="instanceTopology.nodes.length === 0 && !instanceLoading" class="empty-state">
          <el-icon :size="48"><Share /></el-icon>
          <div class="empty-title">该实例暂无关联资源</div>
          <div class="empty-desc">请先创建实例关系</div>
        </div>
        <div v-else class="graph-content">
          <!-- 实例节点列表 -->
          <div class="nodes-grid">
            <div
              v-for="node in instanceTopology.nodes"
              :key="node.id"
              class="instance-node"
              :class="{ 'is-center': node.id === instanceFilter.instanceId }"
            >
              <div class="node-icon" :class="getCategoryClass(node.category)">
                <el-icon :size="20"><Box /></el-icon>
              </div>
              <div class="node-info">
                <div class="node-name">{{ node.asset_name || node.asset_id }}</div>
                <div class="node-model">{{ node.model_name }}</div>
              </div>
              <div class="node-status" v-if="node.attributes?.status">
                <span class="status-dot" :class="getStatusClass(node.attributes.status)"></span>
                {{ node.attributes.status }}
              </div>
            </div>
          </div>

          <!-- 关系列表 -->
          <div v-if="instanceTopology.edges.length > 0" class="edges-section">
            <h3 class="section-title">实例关系 ({{ instanceTopology.edges.length }})</h3>
            <div class="edges-list">
              <div v-for="(edge, index) in instanceTopology.edges" :key="index" class="edge-item">
                <span class="edge-source">{{ getNodeName(edge.source_id) }}</span>
                <div class="edge-arrow">
                  <span class="edge-type">{{ edge.relation_name }}</span>
                  <el-icon><Right /></el-icon>
                </div>
                <span class="edge-target">{{ getNodeName(edge.target_id) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getInstanceTopologyApi, getModelTopologyApi, listCmdbInstancesApi } from '@/api'
import type { InstanceVO, ModelTopologyGraph, TopologyGraph } from '@/api/types/cmdb'
import { Box, Grid, Refresh, Right, Search, Share } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { onMounted, reactive, ref } from 'vue'

const viewMode = ref<'model' | 'instance'>('model')

// 模型拓扑
const modelLoading = ref(false)
const modelFilter = reactive({ provider: '' })
const modelTopology = ref<ModelTopologyGraph>({ nodes: [], edges: [] })

// 实例拓扑
const instanceLoading = ref(false)
const instanceSearchLoading = ref(false)
const instanceFilter = reactive({
  instanceId: undefined as number | undefined,
  depth: 1,
  direction: 'both' as 'both' | 'outgoing' | 'incoming',
})
const instanceOptions = ref<InstanceVO[]>([])
const instanceTopology = ref<TopologyGraph>({ nodes: [], edges: [] })

const getCategoryLabel = (category: string) => {
  const map: Record<string, string> = {
    compute: '计算', storage: '存储', network: '网络',
    database: '数据库', security: '安全', iam: 'IAM',
  }
  return map[category] || category
}

const getCategoryClass = (category: string) => {
  const map: Record<string, string> = {
    compute: 'blue', storage: 'purple', network: 'orange',
    database: 'green', security: 'red', iam: 'cyan',
  }
  return map[category] || 'blue'
}

const getProviderLabel = (provider: string) => {
  const map: Record<string, string> = {
    aliyun: '阿里云', aws: 'AWS', azure: 'Azure', all: '通用',
  }
  return map[provider] || provider
}

const getStatusClass = (status: string) => {
  const map: Record<string, string> = {
    Running: 'active', Stopped: 'inactive', Deleted: 'error',
  }
  return map[status] || ''
}

const getNodeName = (id: number) => {
  const node = instanceTopology.value.nodes.find(n => n.id === id)
  return node?.asset_name || node?.asset_id || String(id)
}

const fetchModelTopology = async () => {
  modelLoading.value = true
  try {
    const response = await getModelTopologyApi(modelFilter.provider || undefined)
    const data = response.data as any
    modelTopology.value = data?.data || data || { nodes: [], edges: [] }
  } catch (error) {
    console.error('获取模型拓扑失败:', error)
    ElMessage.error('获取模型拓扑失败')
  } finally {
    modelLoading.value = false
  }
}

const searchInstances = async (query: string) => {
  if (!query) {
    instanceOptions.value = []
    return
  }
  instanceSearchLoading.value = true
  try {
    const response = await listCmdbInstancesApi({ asset_name: query, limit: 20 })
    const data = response.data as any
    instanceOptions.value = data?.data?.instances || data?.instances || []
  } catch (error) {
    console.error('搜索实例失败:', error)
  } finally {
    instanceSearchLoading.value = false
  }
}

const fetchInstanceTopology = async () => {
  if (!instanceFilter.instanceId) return
  instanceLoading.value = true
  try {
    const response = await getInstanceTopologyApi(instanceFilter.instanceId, {
      depth: instanceFilter.depth,
      direction: instanceFilter.direction,
    })
    const data = response.data as any
    instanceTopology.value = data?.data || data || { nodes: [], edges: [] }
  } catch (error) {
    console.error('获取实例拓扑失败:', error)
    ElMessage.error('获取实例拓扑失败')
  } finally {
    instanceLoading.value = false
  }
}

onMounted(() => {
  fetchModelTopology()
})
</script>

<style scoped lang="scss">
@import './styles/topology.scss';
</style>
