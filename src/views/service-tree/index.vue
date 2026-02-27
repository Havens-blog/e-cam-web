<template>
  <PageContainer>
    <div class="service-tree-page">
      <!-- 页面头部 -->
      <div class="page-header">
        <div class="header-left">
          <h2 class="page-title">服务树</h2>
          <p class="page-subtitle">按业务维度组织和管理云资源</p>
        </div>
        <div class="header-right">
          <el-button type="primary" @click="handleCreateRoot">
            <el-icon><Plus /></el-icon>
            新建根节点
          </el-button>
        </div>
      </div>

      <!-- 主内容区 -->
      <div class="main-content">
        <!-- 左侧树形导航 -->
        <div class="tree-panel">
          <div class="tree-header">
            <el-input
              v-model="searchKeyword"
              placeholder="搜索节点"
              clearable
              size="small"
            >
              <template #prefix>
                <el-icon><Search /></el-icon>
              </template>
            </el-input>
          </div>
          <div class="tree-body">
            <el-tree
              ref="treeRef"
              v-loading="treeLoading"
              :data="treeData"
              :props="treeProps"
              :filter-node-method="filterNode"
              :expand-on-click-node="false"
              :highlight-current="true"
              node-key="id"
              default-expand-all
              @node-click="handleNodeClick"
              @node-contextmenu="handleContextMenu"
            >
              <template #default="{ node, data }">
                <div class="tree-node">
                  <el-icon class="node-icon">
                    <Folder v-if="data.children?.length" />
                    <Document v-else />
                  </el-icon>
                  <span class="node-label">{{ node.label }}</span>
                  <span v-if="data.resource_count" class="node-count">
                    {{ data.resource_count }}
                  </span>
                </div>
              </template>
            </el-tree>
            <div v-if="!treeLoading && treeData.length === 0" class="tree-empty">
              <el-empty description="暂无节点，请创建根节点" :image-size="80" />
            </div>
          </div>
          <div class="tree-footer">
            <el-button text size="small" @click="handleCreateRoot">
              <el-icon><Plus /></el-icon>
              新建节点
            </el-button>
          </div>
        </div>

        <!-- 右侧详情面板 -->
        <div class="detail-panel">
          <template v-if="selectedNode">
            <!-- 节点信息 -->
            <div class="node-info-card">
              <div class="node-breadcrumb">
                <span v-for="(item, index) in nodePath" :key="index">
                  {{ item }}
                  <span v-if="index < nodePath.length - 1" class="separator">/</span>
                </span>
              </div>
              <h3 class="node-name">{{ selectedNode.name }}</h3>
              <div class="node-meta">
                <span v-if="selectedNode.uid" class="meta-item">
                  <span class="meta-label">UID:</span>
                  <span class="meta-value">{{ selectedNode.uid }}</span>
                </span>
                <span v-if="selectedNode.owner" class="meta-item">
                  <span class="meta-label">负责人:</span>
                  <span class="meta-value">{{ selectedNode.owner }}</span>
                </span>
                <span v-if="selectedNode.team" class="meta-item">
                  <span class="meta-label">团队:</span>
                  <span class="meta-value">{{ selectedNode.team }}</span>
                </span>
              </div>
              <div v-if="selectedNode.tags?.length" class="node-tags">
                <el-tag v-for="tag in selectedNode.tags" :key="tag" size="small">
                  {{ tag }}
                </el-tag>
              </div>
              <p v-if="selectedNode.description" class="node-desc">
                {{ selectedNode.description }}
              </p>
            </div>

            <!-- 绑定资源 -->
            <div class="bindings-section">
              <div class="section-header">
                <h4 class="section-title">绑定资源</h4>
                <div class="section-actions">
                  <el-select
                    v-model="bindingFilters.envId"
                    placeholder="全部环境"
                    clearable
                    size="small"
                    style="width: 120px"
                    @change="loadBindings"
                  >
                    <el-option
                      v-for="env in environmentList"
                      :key="env.id"
                      :label="env.name"
                      :value="env.id"
                    />
                  </el-select>
                  <el-select
                    v-model="bindingFilters.resourceType"
                    placeholder="全部类型"
                    clearable
                    size="small"
                    style="width: 120px"
                    @change="loadBindings"
                  >
                    <el-option label="实例" value="instance" />
                    <el-option label="资产" value="asset" />
                  </el-select>
                  <el-button type="primary" size="small" @click="handleBindResource">
                    <el-icon><Link /></el-icon>
                    绑定资源
                  </el-button>
                </div>
              </div>
              <el-table
                v-loading="bindingsLoading"
                :data="bindingList"
                size="small"
                max-height="300"
              >
                <el-table-column label="环境" width="90">
                  <template #default="{ row }">
                    <span class="env-tag">
                      <span class="env-dot" :style="{ background: row.env_color }"></span>
                      {{ row.env_name }}
                    </span>
                  </template>
                </el-table-column>
                <el-table-column prop="resource_name" label="资源名称" min-width="120" show-overflow-tooltip />
                <el-table-column label="类型" width="90">
                  <template #default="{ row }">
                    <template v-if="row.resource_type === 'asset'">
                      {{ assetTypeMap[row.asset_type] || row.asset_type }}
                    </template>
                    <template v-else>
                      {{ row.model_name || '实例' }}
                    </template>
                  </template>
                </el-table-column>
                <el-table-column label="云平台" width="90">
                  <template #default="{ row }">
                    <span v-if="row.provider" class="provider-tag">
                      {{ providerMap[row.provider] || row.provider }}
                    </span>
                    <span v-else class="text-muted">-</span>
                  </template>
                </el-table-column>
                <el-table-column label="IP地址" width="130">
                  <template #default="{ row }">
                    <div v-if="row.private_ip || row.public_ip" class="ip-cell">
                      <span v-if="row.private_ip" class="ip-item">{{ row.private_ip }}</span>
                      <span v-if="row.public_ip" class="ip-item public">{{ row.public_ip }}</span>
                    </div>
                    <span v-else class="text-muted">-</span>
                  </template>
                </el-table-column>
                <el-table-column label="地域" width="100" show-overflow-tooltip>
                  <template #default="{ row }">
                    {{ row.region || '-' }}
                  </template>
                </el-table-column>
                <el-table-column label="状态" width="80">
                  <template #default="{ row }">
                    <el-tag :type="getStatusType(row.resource_status)" size="small">
                      {{ getStatusText(row.resource_status) }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="bind_type" label="绑定" width="60">
                  <template #default="{ row }">
                    <el-tag :type="row.bind_type === 'manual' ? 'info' : 'success'" size="small">
                      {{ row.bind_type === 'manual' ? '手动' : '规则' }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="60" fixed="right">
                  <template #default="{ row }">
                    <el-button link type="danger" size="small" @click.stop="handleUnbind(row)">
                      解绑
                    </el-button>
                  </template>
                </el-table-column>
              </el-table>
            </div>

            <!-- 操作按钮 -->
            <div class="action-bar">
              <el-button @click="handleEditNode">
                <el-icon><Edit /></el-icon>
                编辑节点
              </el-button>
              <el-button @click="handleCreateChild">
                <el-icon><Plus /></el-icon>
                新建子节点
              </el-button>
              <el-button @click="handleMoveNode">
                <el-icon><Rank /></el-icon>
                移动节点
              </el-button>
              <el-button type="danger" @click="handleDeleteNode">
                <el-icon><Delete /></el-icon>
                删除节点
              </el-button>
            </div>
          </template>

          <template v-else>
            <div class="empty-detail">
              <el-empty description="请在左侧选择一个节点" :image-size="120" />
            </div>
          </template>
        </div>
      </div>

      <!-- 右键菜单 -->
      <div
        v-show="contextMenuVisible"
        ref="contextMenuRef"
        class="context-menu"
        :style="{ left: contextMenuPosition.x + 'px', top: contextMenuPosition.y + 'px' }"
      >
        <div class="menu-item" @click="handleCreateChild">
          <el-icon><Plus /></el-icon>
          新建子节点
        </div>
        <div class="menu-item" @click="handleEditNode">
          <el-icon><Edit /></el-icon>
          编辑
        </div>
        <div class="menu-item" @click="handleMoveNode">
          <el-icon><Rank /></el-icon>
          移动
        </div>
        <div class="menu-divider"></div>
        <div class="menu-item danger" @click="handleDeleteNode">
          <el-icon><Delete /></el-icon>
          删除
        </div>
      </div>

      <!-- 节点表单弹窗 -->
      <NodeFormDialog
        v-model:visible="nodeFormVisible"
        :node="currentNode"
        :parent-id="parentIdForCreate"
        :parent-level="parentLevelForCreate"
        :is-edit="isEditNode"
        @success="handleNodeFormSuccess"
      />

      <!-- 移动节点弹窗 -->
      <MoveNodeDialog
        v-model:visible="moveDialogVisible"
        :node="selectedNode"
        :tree-data="treeData"
        @success="handleMoveSuccess"
      />

      <!-- 绑定资源弹窗 -->
      <BindResourceDialog
        v-model:visible="bindDialogVisible"
        :node="selectedNode"
        :environments="environmentList"
        @success="handleBindSuccess"
      />
    </div>
  </PageContainer>

  <!-- 解绑确认弹窗 - 放在 PageContainer 外面 -->
  <UnbindConfirmDialog
    v-model:visible="unbindDialogVisible"
    :resource="unbindResource"
    @confirm="handleUnbindConfirm"
  />
</template>

<script setup lang="ts">
import { listAssetsApi, listCmdbInstancesApi } from '@/api'
import {
  deleteNodeApi,
  listEnvironmentsApi,
  listNodeBindingsApi,
  listNodesApi,
  unbindResourceApi
} from '@/api/service-tree'
import type { Environment, ResourceBinding, ServiceTreeNode } from '@/api/types/service-tree'
import {
  Delete,
  Document,
  Edit,
  Folder,
  Link,
  Plus,
  Rank,
  Search
} from '@element-plus/icons-vue'
import type { ElTree } from 'element-plus'
import { ElMessage, ElMessageBox } from 'element-plus'
import { nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import BindResourceDialog from './components/BindResourceDialog.vue'
import MoveNodeDialog from './components/MoveNodeDialog.vue'
import NodeFormDialog from './components/NodeFormDialog.vue'
import UnbindConfirmDialog from './components/UnbindConfirmDialog.vue'

// 树形数据
const treeRef = ref<InstanceType<typeof ElTree>>()
const treeData = ref<ServiceTreeNode[]>([])
const treeLoading = ref(false)
const searchKeyword = ref('')

const treeProps = {
  label: 'name',
  children: 'children'
}

// 资产类型映射
const assetTypeMap: Record<string, string> = {
  ecs: '云服务器',
  rds: '云数据库',
  oss: '对象存储',
  slb: '负载均衡',
  eip: '弹性IP',
  disk: '云硬盘',
  vpc: 'VPC'
}

// 云平台映射
const providerMap: Record<string, string> = {
  aliyun: '阿里云',
  aws: 'AWS',
  tencent: '腾讯云',
  huawei: '华为云',
  azure: 'Azure'
}

// 获取状态类型
const getStatusType = (status?: string): 'success' | 'info' | 'warning' | 'danger' => {
  if (!status) return 'info'
  const map: Record<string, 'success' | 'info' | 'warning' | 'danger'> = {
    running: 'success',
    active: 'success',
    stopped: 'info',
    inactive: 'warning',
    error: 'danger',
    terminated: 'danger'
  }
  return map[status] || 'info'
}

// 获取状态文本
const getStatusText = (status?: string): string => {
  if (!status) return '-'
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

// 选中的节点
const selectedNode = ref<ServiceTreeNode | null>(null)
const nodePath = ref<string[]>([])

// 环境列表
const environmentList = ref<Environment[]>([])

// 绑定资源
const bindingList = ref<ResourceBinding[]>([])
const bindingsLoading = ref(false)
const bindingFilters = reactive({
  envId: undefined as number | undefined,
  resourceType: undefined as string | undefined
})

// 右键菜单
const contextMenuVisible = ref(false)
const contextMenuRef = ref<HTMLElement>()
const contextMenuPosition = reactive({ x: 0, y: 0 })

// 弹窗
const nodeFormVisible = ref(false)
const currentNode = ref<ServiceTreeNode | undefined>()
const parentIdForCreate = ref<number>(0)
const parentLevelForCreate = ref<number>(0)
const isEditNode = ref(false)

const moveDialogVisible = ref(false)
const bindDialogVisible = ref(false)

// 将扁平列表构建为树结构
const buildTree = (nodes: ServiceTreeNode[]): ServiceTreeNode[] => {
  if (!nodes || nodes.length === 0) return []
  
  // 创建节点映射
  const nodeMap = new Map<number, ServiceTreeNode>()
  nodes.forEach(node => {
    nodeMap.set(node.id, { ...node, children: [] })
  })
  
  // 构建树结构
  const roots: ServiceTreeNode[] = []
  nodeMap.forEach(node => {
    if (node.parent_id === 0 || !nodeMap.has(node.parent_id)) {
      // 根节点
      roots.push(node)
    } else {
      // 子节点，添加到父节点的 children 中
      const parent = nodeMap.get(node.parent_id)
      if (parent) {
        if (!parent.children) parent.children = []
        parent.children.push(node)
      }
    }
  })
  
  // 按 order 排序
  const sortNodes = (nodes: ServiceTreeNode[]) => {
    nodes.sort((a, b) => (a.order || 0) - (b.order || 0))
    nodes.forEach(node => {
      if (node.children?.length) {
        sortNodes(node.children)
      }
    })
  }
  sortNodes(roots)
  
  return roots
}

// 加载树数据
const loadTree = async () => {
  treeLoading.value = true
  try {
    // 使用 listNodesApi 获取所有节点，然后在前端构建树结构
    const res = await listNodesApi({ page_size: 1000 })
    const data = res.data as any
    
    let nodes: ServiceTreeNode[] = []
    if (data?.list) {
      nodes = data.list
    } else if (Array.isArray(data)) {
      nodes = data
    }
    
    // 构建树结构
    treeData.value = buildTree(nodes)
    
    // 默认选中第一个根节点
    if (treeData.value.length > 0 && !selectedNode.value) {
      const firstNode = treeData.value[0]
      if (firstNode) {
        selectedNode.value = firstNode
        buildNodePath(firstNode)
        loadBindings()
        // 设置树组件的当前选中节点
        nextTick(() => {
          treeRef.value?.setCurrentKey(firstNode.id)
        })
      }
    }
  } catch (error) {
    console.error('加载服务树失败:', error)
    treeData.value = []
  } finally {
    treeLoading.value = false
  }
}

// 加载环境列表
const loadEnvironments = async () => {
  try {
    const res = await listEnvironmentsApi({ status: 1 })
    environmentList.value = res.data?.list || []
  } catch (error) {
    console.error('加载环境列表失败:', error)
  }
}

// 加载绑定资源
const loadBindings = async () => {
  if (!selectedNode.value) return
  bindingsLoading.value = true
  try {
    const res = await listNodeBindingsApi(selectedNode.value.id, {
      env_id: bindingFilters.envId,
      resource_type: bindingFilters.resourceType
    })
    const bindings = res.data?.list || []
    
    // 补充环境信息
    const envMap = new Map(environmentList.value.map(e => [e.id, e]))
    
    // 收集需要查询的资源ID
    const assetIds = bindings.filter(b => b.resource_type === 'asset').map(b => b.resource_id)
    const instanceIds = bindings.filter(b => b.resource_type === 'instance').map(b => b.resource_id)
    
    // 查询资产详情
    let assetMap = new Map<number, any>()
    if (assetIds.length > 0) {
      try {
        const assetRes = await listAssetsApi({ offset: 0, limit: 500 })
        const assetData = assetRes.data as any
        const assets = assetData?.assets || assetData?.list || []
        assetMap = new Map(assets.map((a: any) => [a.id, a]))
      } catch (e) {
        console.error('加载资产详情失败:', e)
      }
    }
    
    // 查询CMDB实例详情
    let instanceMap = new Map<number, any>()
    if (instanceIds.length > 0) {
      try {
        const instRes = await listCmdbInstancesApi({ offset: 0, limit: 500 })
        const instData = instRes.data as any
        const instances = instData?.list || instData?.instances || []
        instanceMap = new Map(instances.map((i: any) => [i.id, i]))
      } catch (e) {
        console.error('加载实例详情失败:', e)
      }
    }
    
    // 补充绑定数据的详细信息
    bindingList.value = bindings.map(binding => {
      const env = envMap.get(binding.env_id)
      const enriched = {
        ...binding,
        env_name: binding.env_name || env?.name,
        env_color: binding.env_color || env?.color
      }
      
      if (binding.resource_type === 'asset') {
        const asset = assetMap.get(binding.resource_id)
        if (asset) {
          enriched.resource_name = enriched.resource_name || asset.asset_name || asset.name
          enriched.asset_id = enriched.asset_id || asset.asset_id
          enriched.asset_type = enriched.asset_type || asset.asset_type
          enriched.provider = enriched.provider || asset.provider
          enriched.region = enriched.region || asset.region
          enriched.private_ip = enriched.private_ip || asset.private_ip
          enriched.public_ip = enriched.public_ip || asset.public_ip
          enriched.resource_status = enriched.resource_status || asset.status
        }
      } else if (binding.resource_type === 'instance') {
        const inst = instanceMap.get(binding.resource_id)
        if (inst) {
          enriched.resource_name = enriched.resource_name || inst.name || inst.inst_name
          enriched.inst_id = enriched.inst_id || inst.inst_id || inst.uid
          enriched.model_uid = enriched.model_uid || inst.model_uid
          enriched.model_name = enriched.model_name || inst.model_name
          enriched.resource_status = enriched.resource_status || inst.status
        }
      }
      
      return enriched
    })
  } catch (error) {
    console.error('加载绑定资源失败:', error)
  } finally {
    bindingsLoading.value = false
  }
}

// 搜索过滤
watch(searchKeyword, (val) => {
  treeRef.value?.filter(val)
})

const filterNode = (value: string, data: any) => {
  if (!value) return true
  return data.name.toLowerCase().includes(value.toLowerCase())
}

// 节点点击
const handleNodeClick = (data: ServiceTreeNode) => {
  selectedNode.value = data
  buildNodePath(data)
  loadBindings()
  contextMenuVisible.value = false
}

// 构建节点路径
const buildNodePath = (node: ServiceTreeNode) => {
  const path: string[] = []
  const findPath = (nodes: ServiceTreeNode[], target: ServiceTreeNode): boolean => {
    for (const n of nodes) {
      if (n.id === target.id) {
        path.push(n.name)
        return true
      }
      if (n.children?.length) {
        if (findPath(n.children, target)) {
          path.unshift(n.name)
          return true
        }
      }
    }
    return false
  }
  findPath(treeData.value, node)
  nodePath.value = path
}

// 右键菜单
const handleContextMenu = (event: Event, data: ServiceTreeNode) => {
  const mouseEvent = event as MouseEvent
  mouseEvent.preventDefault()
  selectedNode.value = data
  buildNodePath(data)
  contextMenuPosition.x = mouseEvent.clientX
  contextMenuPosition.y = mouseEvent.clientY
  contextMenuVisible.value = true
}

// 点击其他地方关闭右键菜单
const handleClickOutside = (event: MouseEvent) => {
  if (contextMenuRef.value && !contextMenuRef.value.contains(event.target as Node)) {
    contextMenuVisible.value = false
  }
}

// 创建根节点
const handleCreateRoot = () => {
  currentNode.value = undefined
  parentIdForCreate.value = 0
  parentLevelForCreate.value = 0  // 根节点的父级层级为0，创建后层级为1
  isEditNode.value = false
  nodeFormVisible.value = true
  contextMenuVisible.value = false
}

// 创建子节点
const handleCreateChild = () => {
  if (!selectedNode.value) return
  currentNode.value = undefined
  parentIdForCreate.value = selectedNode.value.id
  parentLevelForCreate.value = selectedNode.value.level  // 父节点的层级
  isEditNode.value = false
  nodeFormVisible.value = true
  contextMenuVisible.value = false
}

// 编辑节点
const handleEditNode = () => {
  if (!selectedNode.value) return
  currentNode.value = selectedNode.value
  isEditNode.value = true
  nodeFormVisible.value = true
  contextMenuVisible.value = false
}

// 移动节点
const handleMoveNode = () => {
  if (!selectedNode.value) return
  moveDialogVisible.value = true
  contextMenuVisible.value = false
}

// 删除节点
const handleDeleteNode = async () => {
  if (!selectedNode.value) return
  contextMenuVisible.value = false

  try {
    await ElMessageBox.confirm(
      `确定要删除节点 "${selectedNode.value.name}" 吗？如果该节点下有子节点或绑定资源，将无法删除。`,
      '删除确认',
      { type: 'warning' }
    )
    await deleteNodeApi(selectedNode.value.id)
    ElMessage.success('删除成功')
    selectedNode.value = null
    loadTree()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '删除失败')
    }
  }
}

// 绑定资源
const handleBindResource = () => {
  if (!selectedNode.value) return
  bindDialogVisible.value = true
}

// 解绑资源
const unbindDialogVisible = ref(false)
const unbindResource = ref<ResourceBinding | null>(null)

const handleUnbind = (binding: ResourceBinding) => {
  console.log('[DEBUG] handleUnbind called', binding)
  unbindResource.value = binding
  unbindDialogVisible.value = true
  console.log('[DEBUG] unbindDialogVisible:', unbindDialogVisible.value)
}

const handleUnbindConfirm = async () => {
  if (!unbindResource.value) return
  try {
    await unbindResourceApi(unbindResource.value.id)
    ElMessage.success('解绑成功')
    unbindDialogVisible.value = false
    loadBindings()
  } catch (error: any) {
    ElMessage.error(error.message || '解绑失败')
  }
}

// 表单成功回调
const handleNodeFormSuccess = () => {
  nodeFormVisible.value = false
  loadTree()
}

const handleMoveSuccess = () => {
  moveDialogVisible.value = false
  loadTree()
}

const handleBindSuccess = () => {
  bindDialogVisible.value = false
  loadBindings()
}

onMounted(() => {
  loadTree()
  loadEnvironments()
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped lang="scss">
.service-tree-page {
  height: 100%;
  display: flex;
  flex-direction: column;

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 20px;
    flex-shrink: 0;

    .header-left {
      .page-title {
        margin: 0 0 8px 0;
        font-size: 24px;
        font-weight: 700;
        color: var(--text-primary);
      }

      .page-subtitle {
        margin: 0;
        font-size: 14px;
        color: var(--text-tertiary);
      }
    }
  }

  .main-content {
    flex: 1;
    display: flex;
    gap: 20px;
    min-height: 0;
  }

  // 左侧树形面板
  .tree-panel {
    width: 280px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    background: var(--glass-bg);
    backdrop-filter: blur(16px);
    border: 1px solid var(--glass-border);
    border-radius: 12px;
    overflow: hidden;

    .tree-header {
      padding: 12px;
      border-bottom: 1px solid var(--border-subtle);
    }

    .tree-body {
      flex: 1;
      overflow: auto;
      padding: 8px;

      .tree-node {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 4px 0;

        .node-icon {
          color: var(--text-tertiary);
          font-size: 16px;
        }

        .node-label {
          flex: 1;
          font-size: 14px;
          color: var(--text-secondary);
        }

        .node-count {
          padding: 2px 6px;
          background: var(--bg-hover);
          border-radius: 10px;
          font-size: 11px;
          color: var(--text-tertiary);
        }
      }

      :deep(.el-tree-node__content) {
        height: 36px;
        border-radius: 6px;
        background: transparent;

        &:hover {
          background: var(--bg-hover);
        }
      }

      :deep(.el-tree) {
        background: transparent;
      }

      :deep(.el-tree-node.is-current > .el-tree-node__content) {
        background: rgba(59, 130, 246, 0.15);

        .node-label {
          color: var(--accent-blue);
          font-weight: 500;
        }

        .node-icon {
          color: var(--accent-blue);
        }
      }
    }

    .tree-empty {
      padding: 40px 20px;
    }

    .tree-footer {
      padding: 8px 12px;
      border-top: 1px solid var(--border-subtle);
    }
  }

  // 右侧详情面板
  .detail-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-width: 0;

    .node-info-card {
      background: var(--glass-bg);
      backdrop-filter: blur(16px);
      border: 1px solid var(--glass-border);
      border-radius: 12px;
      padding: 20px;

      .node-breadcrumb {
        font-size: 13px;
        color: var(--text-tertiary);
        margin-bottom: 8px;

        .separator {
          margin: 0 6px;
          color: var(--text-muted);
        }
      }

      .node-name {
        margin: 0 0 12px 0;
        font-size: 20px;
        font-weight: 600;
        color: var(--text-primary);
      }

      .node-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 16px;
        margin-bottom: 12px;

        .meta-item {
          font-size: 13px;

          .meta-label {
            color: var(--text-tertiary);
            margin-right: 4px;
          }

          .meta-value {
            color: var(--text-secondary);
          }
        }
      }

      .node-tags {
        display: flex;
        gap: 8px;
        margin-bottom: 12px;
      }

      .node-desc {
        margin: 0;
        font-size: 14px;
        color: var(--text-tertiary);
        line-height: 1.6;
      }
    }

    .bindings-section {
      flex: 1;
      background: var(--glass-bg);
      backdrop-filter: blur(16px);
      border: 1px solid var(--glass-border);
      border-radius: 12px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      min-height: 0;

      .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;

        .section-title {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .section-actions {
          display: flex;
          gap: 8px;
        }
      }

      .env-tag {
        display: inline-flex;
        align-items: center;
        gap: 6px;

        .env-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
      }

      .provider-tag {
        font-size: 12px;
        color: var(--text-secondary);
      }

      .ip-cell {
        display: flex;
        flex-direction: column;
        gap: 2px;
        font-size: 12px;

        .ip-item {
          color: var(--text-secondary);
          font-family: monospace;

          &.public {
            color: var(--accent-blue);
          }
        }
      }

      .text-muted {
        color: var(--text-muted);
      }

      :deep(.el-table) {
        background: transparent;

        th.el-table__cell {
          background: var(--table-header-bg);
        }

        tr {
          background: transparent;

          &:hover > td.el-table__cell {
            background: var(--table-row-hover);
          }
        }

        td.el-table__cell {
          background: transparent;
        }
      }
    }

    .action-bar {
      display: flex;
      gap: 12px;
      flex-shrink: 0;
    }

    .empty-detail {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--glass-bg);
      backdrop-filter: blur(16px);
      border: 1px solid var(--glass-border);
      border-radius: 12px;
    }
  }

  // 右键菜单
  .context-menu {
    position: fixed;
    z-index: 9999;
    min-width: 140px;
    background: var(--bg-overlay);
    border: 1px solid var(--border-base);
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
    padding: 6px 0;

    .menu-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      font-size: 13px;
      color: var(--text-secondary);
      cursor: pointer;
      transition: all 150ms ease;

      &:hover {
        background: var(--bg-hover);
        color: var(--text-primary);
      }

      &.danger {
        color: var(--accent-red);

        &:hover {
          background: rgba(239, 68, 68, 0.1);
        }
      }
    }

    .menu-divider {
      height: 1px;
      background: var(--border-subtle);
      margin: 6px 0;
    }
  }
}
</style>
