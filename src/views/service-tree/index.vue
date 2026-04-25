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

            <!-- Tab 切换：绑定资源 / 关联资产 -->
            <div class="bindings-section">
              <el-tabs v-model="activeTab" @tab-change="handleTabChange">
                <el-tab-pane label="绑定资源" name="bindings">
                  <div class="section-header">
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
                    highlight-current-row
                    @row-click="handleBindingRowClick"
                    style="cursor: pointer"
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
                </el-tab-pane>

                <el-tab-pane label="关联资产" name="assets">
                  <!-- 统计卡片 -->
                  <div v-if="assetStats" class="asset-stats-row">
                    <div class="stat-card total">
                      <span class="stat-num">{{ assetStats.total }}</span>
                      <span class="stat-label">总资产</span>
                    </div>
                    <div
                      v-for="(count, type) in assetStats.by_asset_type"
                      :key="type"
                      class="stat-card"
                    >
                      <span class="stat-num">{{ count }}</span>
                      <span class="stat-label">{{ assetTypeMap[type as string] || type }}</span>
                    </div>
                  </div>

                  <!-- 筛选 -->
                  <div class="asset-filters">
                    <el-select
                      v-model="assetFilters.asset_type"
                      placeholder="全部类型"
                      clearable
                      size="small"
                      style="width: 130px"
                      @change="loadNodeAssets"
                    >
                      <el-option label="云服务器" value="ecs" />
                      <el-option label="云数据库" value="rds" />
                      <el-option label="Redis" value="redis" />
                      <el-option label="MongoDB" value="mongodb" />
                      <el-option label="VPC" value="vpc" />
                      <el-option label="弹性IP" value="eip" />
                      <el-option label="负载均衡" value="lb" />
                      <el-option label="CDN" value="cdn" />
                      <el-option label="WAF" value="waf" />
                      <el-option label="文件存储" value="nas" />
                      <el-option label="对象存储" value="oss" />
                      <el-option label="Kafka" value="kafka" />
                      <el-option label="Elasticsearch" value="elasticsearch" />
                      <el-option label="安全组" value="security_group" />
                      <el-option label="云盘" value="disk" />
                      <el-option label="快照" value="snapshot" />
                    </el-select>
                    <el-select
                      v-model="assetFilters.env_id"
                      placeholder="全部环境"
                      clearable
                      size="small"
                      style="width: 120px"
                      @change="loadNodeAssets"
                    >
                      <el-option
                        v-for="env in environmentList"
                        :key="env.id"
                        :label="env.name"
                        :value="env.id"
                      />
                    </el-select>
                    <el-switch
                      v-model="assetFilters.include_children"
                      active-text="含子节点"
                      size="small"
                      @change="handleIncludeChildrenChange"
                    />
                    <el-button size="small" circle @click="loadNodeAssets" title="刷新">
                      <el-icon><Refresh /></el-icon>
                    </el-button>
                  </div>

                  <!-- 资产表格 -->
                  <el-table
                    v-loading="assetsLoading"
                    :data="nodeAssetList"
                    size="small"
                    max-height="400"
                    highlight-current-row
                    @row-click="handleAssetRowClick"
                    style="cursor: pointer"
                  >
                    <el-table-column prop="asset_name" label="资产名称" min-width="140" show-overflow-tooltip />
                    <el-table-column prop="asset_id" label="资产ID" width="160" show-overflow-tooltip>
                      <template #default="{ row }">
                        <span style="font-family: monospace; font-size: 12px;">{{ row.asset_id }}</span>
                      </template>
                    </el-table-column>
                    <el-table-column label="类型" width="100">
                      <template #default="{ row }">
                        <el-tag size="small" type="info">{{ assetTypeMap[row.asset_type] || row.asset_type }}</el-tag>
                      </template>
                    </el-table-column>
                    <el-table-column label="云厂商" width="90">
                      <template #default="{ row }">
                        {{ providerMap[row.provider] || row.provider }}
                      </template>
                    </el-table-column>
                    <el-table-column prop="region" label="地域" width="110" show-overflow-tooltip />
                    <el-table-column label="状态" width="80">
                      <template #default="{ row }">
                        <el-tag :type="getStatusType(row.status)" size="small">
                          {{ getStatusText(row.status) }}
                        </el-tag>
                      </template>
                    </el-table-column>
                    <el-table-column label="绑定方式" width="80">
                      <template #default="{ row }">
                        <template v-if="row.binding_id === 0">
                          <el-tag type="warning" size="small">未绑定</el-tag>
                        </template>
                        <template v-else>
                          <el-tag :type="row.bind_type === 'manual' ? 'info' : 'success'" size="small">
                            {{ row.bind_type === 'manual' ? '手动' : '规则' }}
                          </el-tag>
                        </template>
                      </template>
                    </el-table-column>
                    <el-table-column label="操作" width="100" fixed="right">
                      <template #default="{ row }">
                        <template v-if="row.binding_id === 0">
                          <el-button link type="primary" size="small" @click.stop="handleAssignToNode(row)">
                            分配到节点
                          </el-button>
                        </template>
                        <template v-else>
                          <el-button link type="danger" size="small" @click.stop="handleUnbindAsset(row)">
                            解绑
                          </el-button>
                        </template>
                      </template>
                    </el-table-column>
                  </el-table>

                  <!-- 分页 -->
                  <div v-if="assetTotal > 20" class="asset-pagination">
                    <el-pagination
                      v-model:current-page="assetCurrentPage"
                      :page-size="20"
                      :total="assetTotal"
                      layout="total, prev, pager, next"
                      small
                      @current-change="handleAssetPageChange"
                    />
                  </div>
                </el-tab-pane>
              </el-tabs>
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

  <!-- 资源详情抽屉 -->
  <ResourceDetailDrawer
    v-model:visible="resourceDetailVisible"
    :resource="resourceDetailData"
    :binding-info="resourceDetailBinding"
  />

  <!-- 分配资产到节点弹窗 -->
  <el-dialog
    v-model="assignDialogVisible"
    title="分配资产到节点"
    width="480px"
    :close-on-click-modal="false"
  >
    <div v-if="assignAsset" style="margin-bottom: 16px;">
      <p style="margin: 0 0 8px; color: #606266;">
        将资产 <strong>{{ assignAsset.asset_name }}</strong> ({{ assetTypeMap[assignAsset.asset_type] || assignAsset.asset_type }}) 分配到：
      </p>
    </div>
    <el-form label-width="80px">
      <el-form-item label="目标节点">
        <el-tree-select
          v-model="assignTargetNodeId"
          :data="treeData"
          :props="{ label: 'name', children: 'children', value: 'id' }"
          placeholder="选择目标节点"
          check-strictly
          filterable
          style="width: 100%"
        />
      </el-form-item>
      <el-form-item label="环境">
        <el-select v-model="assignEnvId" placeholder="选择环境" style="width: 100%">
          <el-option
            v-for="env in environmentList"
            :key="env.id"
            :label="env.name"
            :value="env.id"
          />
        </el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="assignDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="assignLoading" @click="handleAssignConfirm">确定</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { listAssetsApi, listCmdbInstancesApi } from '@/api'
import {
    bindResourceApi,
    deleteNodeApi,
    getNodeAssetStatsApi,
    listEnvironmentsApi,
    listNodeAssetsApi,
    listNodeBindingsApi,
    listNodesApi,
    unbindResourceApi
} from '@/api/service-tree'
import type { AssetStatsVO, Environment, ListNodeAssetsParams, NodeAssetVO, ResourceBinding, ServiceTreeNode } from '@/api/types/service-tree'
import {
    Delete,
    Document,
    Edit,
    Folder,
    Link,
    Plus,
    Rank,
    Refresh,
    Search
} from '@element-plus/icons-vue'
import type { ElTree } from 'element-plus'
import { ElMessage, ElMessageBox } from 'element-plus'
import { nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import BindResourceDialog from './components/BindResourceDialog.vue'
import MoveNodeDialog from './components/MoveNodeDialog.vue'
import NodeFormDialog from './components/NodeFormDialog.vue'
import ResourceDetailDrawer, { type ResourceData } from './components/ResourceDetailDrawer.vue'
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
  redis: 'Redis',
  mongodb: 'MongoDB',
  oss: '对象存储',
  nas: '文件存储',
  slb: '负载均衡',
  lb: '负载均衡',
  eip: '弹性IP',
  disk: '云硬盘',
  snapshot: '快照',
  vpc: 'VPC',
  vswitch: '交换机',
  subnet: '子网',
  security_group: '安全组',
  kafka: 'Kafka',
  elasticsearch: 'Elasticsearch',
  cdn: 'CDN',
  waf: 'WAF',
  image: '镜像'
}

// 云平台映射
const providerMap: Record<string, string> = {
  aliyun: '阿里云',
  aws: 'AWS',
  tencent: '腾讯云',
  huawei: '华为云',
  azure: 'Azure',
  volcano: '火山引擎'
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

// Tab 切换
const activeTab = ref('bindings')

// 关联资产
const nodeAssetList = ref<NodeAssetVO[]>([])
const assetsLoading = ref(false)
const assetStats = ref<AssetStatsVO | null>(null)
const assetTotal = ref(0)
const assetCurrentPage = ref(1)
const assetFilters = reactive<ListNodeAssetsParams>({
  asset_type: undefined,
  env_id: undefined,
  include_children: false,
  offset: 0,
  limit: 20
})

// 右键菜单
const contextMenuVisible = ref(false)
const contextMenuRef = ref<HTMLElement>()
const contextMenuPosition = reactive({ x: 0, y: 0 })

// 资源详情抽屉
const resourceDetailVisible = ref(false)
const resourceDetailData = ref<ResourceData | null>(null)
const resourceDetailBinding = ref<{ env_name?: string; env_color?: string; bind_type?: string } | null>(null)

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

// Tab 切换
const handleTabChange = (tab: string | number) => {
  if (tab === 'assets' && selectedNode.value) {
    loadNodeAssets()
    loadAssetStats()
  }
}

// 加载节点关联资产
const loadNodeAssets = async () => {
  if (!selectedNode.value) return
  assetsLoading.value = true
  try {
    const res = await listNodeAssetsApi(selectedNode.value.id, {
      asset_type: assetFilters.asset_type || undefined,
      env_id: assetFilters.env_id || undefined,
      include_children: assetFilters.include_children,
      offset: (assetCurrentPage.value - 1) * 20,
      limit: 20
    })
    const data = res.data as any
    nodeAssetList.value = data?.items || []
    assetTotal.value = data?.total || 0
  } catch (error) {
    console.error('加载关联资产失败:', error)
    nodeAssetList.value = []
    assetTotal.value = 0
  } finally {
    assetsLoading.value = false
  }
}

// 加载资产统计
const loadAssetStats = async () => {
  if (!selectedNode.value) return
  try {
    const res = await getNodeAssetStatsApi(selectedNode.value.id, {
      include_children: assetFilters.include_children
    })
    assetStats.value = (res.data as any) || null
  } catch (error) {
    console.error('加载资产统计失败:', error)
    assetStats.value = null
  }
}

// 资产分页
const handleAssetPageChange = (page: number) => {
  assetCurrentPage.value = page
  loadNodeAssets()
}

// 含子节点切换
const handleIncludeChildrenChange = () => {
  assetCurrentPage.value = 1
  loadNodeAssets()
  loadAssetStats()
}

// 分配资产到节点（根节点未绑定资产）
const assignAsset = ref<NodeAssetVO | null>(null)
const assignDialogVisible = ref(false)

const handleAssignToNode = (row: NodeAssetVO) => {
  assignAsset.value = row
  assignDialogVisible.value = true
}

// 解绑关联资产（子节点已绑定资产）
const handleUnbindAsset = async (row: NodeAssetVO) => {
  try {
    await ElMessageBox.confirm(
      `确定要解绑资产 "${row.asset_name}" 吗？`,
      '解绑确认',
      { type: 'warning' }
    )
    await unbindResourceApi(row.binding_id)
    ElMessage.success('解绑成功')
    loadNodeAssets()
    loadAssetStats()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '解绑失败')
    }
  }
}

// 分配到节点弹窗状态
const assignTargetNodeId = ref<number | undefined>()
const assignEnvId = ref<number | undefined>()
const assignLoading = ref(false)

const handleAssignConfirm = async () => {
  if (!assignAsset.value || !assignTargetNodeId.value || !assignEnvId.value) {
    ElMessage.warning('请选择目标节点和环境')
    return
  }
  assignLoading.value = true
  try {
    await bindResourceApi(assignTargetNodeId.value, {
      env_id: assignEnvId.value,
      resource_type: 'asset',
      resource_id: assignAsset.value.id
    })
    ElMessage.success('分配成功')
    assignDialogVisible.value = false
    assignTargetNodeId.value = undefined
    assignEnvId.value = undefined
    loadNodeAssets()
    loadAssetStats()
  } catch (error: any) {
    ElMessage.error(error.message || '分配失败')
  } finally {
    assignLoading.value = false
  }
}

// 搜索过滤
watch(searchKeyword, (val) => {
  treeRef.value?.filter(val)
})

// 点击绑定资源行 -> 打开详情抽屉
const handleBindingRowClick = (row: ResourceBinding) => {
  resourceDetailData.value = {
    asset_id: row.asset_id,
    asset_name: row.resource_name,
    asset_type: row.asset_type,
    resource_name: row.resource_name,
    resource_status: row.resource_status,
    provider: row.provider,
    region: row.region,
    model_uid: row.model_uid,
    model_name: row.model_name,
    inst_id: row.inst_id,
    attributes: {
      private_ip: row.private_ip,
      public_ip: row.public_ip,
      region: row.region,
      provider: row.provider,
      status: row.resource_status,
    }
  }
  resourceDetailBinding.value = {
    env_name: row.env_name,
    env_color: row.env_color,
    bind_type: row.bind_type,
  }
  resourceDetailVisible.value = true
}

// 点击关联资产行 -> 打开详情抽屉
const handleAssetRowClick = (row: NodeAssetVO) => {
  resourceDetailData.value = {
    asset_id: row.asset_id,
    asset_name: row.asset_name,
    asset_type: row.asset_type,
    status: row.status,
    provider: row.provider,
    region: row.region,
    attributes: row.attributes || {},
  }
  resourceDetailBinding.value = row.binding_id ? {
    env_name: undefined,
    bind_type: row.bind_type,
  } : null
  resourceDetailVisible.value = true
}

const filterNode = (value: string, data: any) => {
  if (!value) return true
  return data.name.toLowerCase().includes(value.toLowerCase())
}

// 节点点击
const handleNodeClick = (data: any) => {
  const nodeData = data as ServiceTreeNode
  selectedNode.value = nodeData
  buildNodePath(nodeData)
  activeTab.value = 'bindings'
  assetStats.value = null
  nodeAssetList.value = []
  assetCurrentPage.value = 1
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
const handleContextMenu = (event: Event, data: any) => {
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
      overflow: hidden;

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

      :deep(.el-tabs) {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-height: 0;
      }

      :deep(.el-tabs__header) {
        margin-bottom: 12px;
        flex-shrink: 0;
      }

      :deep(.el-tabs__content) {
        flex: 1;
        overflow: auto;
      }

      .asset-stats-row {
        display: flex;
        gap: 10px;
        margin-bottom: 12px;
        flex-wrap: wrap;

        .stat-card {
          padding: 8px 14px;
          background: var(--bg-hover);
          border-radius: 8px;
          display: flex;
          flex-direction: column;
          align-items: center;
          min-width: 70px;

          &.total {
            background: rgba(59, 130, 246, 0.12);

            .stat-num {
              color: var(--accent-blue);
            }
          }

          .stat-num {
            font-size: 18px;
            font-weight: 600;
            color: var(--text-primary);
          }

          .stat-label {
            font-size: 11px;
            color: var(--text-tertiary);
            margin-top: 2px;
          }
        }
      }

      .asset-filters {
        display: flex;
        gap: 8px;
        align-items: center;
        margin-bottom: 12px;
      }

      .asset-pagination {
        display: flex;
        justify-content: flex-end;
        margin-top: 12px;
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
