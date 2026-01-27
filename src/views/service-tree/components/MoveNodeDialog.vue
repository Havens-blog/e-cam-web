<template>
  <el-dialog
    :model-value="visible"
    title="移动节点"
    width="480px"
    :close-on-click-modal="false"
    @update:model-value="$emit('update:visible', $event)"
  >
    <div class="move-dialog-content">
      <div class="current-location">
        <span class="label">当前位置:</span>
        <span class="path">{{ currentPath }}</span>
      </div>

      <div class="target-section">
        <div class="section-label">选择新的父节点:</div>
        <div class="tree-container">
          <el-tree
            ref="treeRef"
            :data="filteredTreeData"
            :props="{ label: 'name', children: 'children' }"
            :expand-on-click-node="false"
            highlight-current
            node-key="id"
            default-expand-all
            @node-click="handleNodeSelect"
          >
            <template #default="{ node, data }">
              <div class="tree-node" :class="{ disabled: isDisabled(data) }">
                <el-icon class="node-icon">
                  <Folder v-if="data.children?.length" />
                  <Document v-else />
                </el-icon>
                <span class="node-label">{{ node.label }}</span>
                <span v-if="data.id === node?.id && isCurrentParent(data)" class="current-tag">
                  当前
                </span>
              </div>
            </template>
          </el-tree>
        </div>
        <div class="root-option">
          <el-radio v-model="selectedParentId" :label="0">移动到根级别</el-radio>
        </div>
      </div>

      <div v-if="selectedParentId !== null && selectedParentId !== node?.parent_id" class="preview">
        <span class="label">移动后位置:</span>
        <span class="path">{{ newPath }}</span>
      </div>
    </div>

    <template #footer>
      <el-button @click="$emit('update:visible', false)">取消</el-button>
      <el-button
        type="primary"
        :loading="submitting"
        :disabled="selectedParentId === null || selectedParentId === node?.parent_id"
        @click="handleSubmit"
      >
        确认移动
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { moveNodeApi } from '@/api/service-tree'
import type { ServiceTreeNode } from '@/api/types/service-tree'
import { Document, Folder } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  visible: boolean
  node: ServiceTreeNode | null
  treeData: ServiceTreeNode[]
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  success: []
}>()

const submitting = ref(false)
const selectedParentId = ref<number | null>(null)

// 当前路径
const currentPath = computed(() => {
  if (!props.node) return ''
  return buildPath(props.treeData, props.node.id)
})

// 新路径
const newPath = computed(() => {
  if (!props.node || selectedParentId.value === null) return ''
  if (selectedParentId.value === 0) {
    return props.node.name
  }
  const parentPath = buildPath(props.treeData, selectedParentId.value)
  return parentPath ? `${parentPath} / ${props.node.name}` : props.node.name
})

// 过滤掉当前节点及其子节点
const filteredTreeData = computed(() => {
  if (!props.node) return props.treeData
  return filterTree(props.treeData, props.node.id)
})

// 构建路径
const buildPath = (nodes: ServiceTreeNode[], targetId: number): string => {
  for (const node of nodes) {
    if (node.id === targetId) {
      return node.name
    }
    if (node.children?.length) {
      const childPath = buildPath(node.children, targetId)
      if (childPath) {
        return `${node.name} / ${childPath}`
      }
    }
  }
  return ''
}

// 过滤树
const filterTree = (nodes: ServiceTreeNode[], excludeId: number): ServiceTreeNode[] => {
  return nodes
    .filter(node => node.id !== excludeId)
    .map(node => ({
      ...node,
      children: node.children ? filterTree(node.children, excludeId) : undefined
    }))
}

// 是否是当前父节点
const isCurrentParent = (data: ServiceTreeNode) => {
  return props.node && data.id === props.node.parent_id
}

// 是否禁用（当前节点或其子节点）
const isDisabled = (data: ServiceTreeNode) => {
  if (!props.node) return false
  return isDescendant(data, props.node.id)
}

// 检查是否是后代节点
const isDescendant = (node: ServiceTreeNode, targetId: number): boolean => {
  if (node.id === targetId) return true
  if (node.children) {
    return node.children.some(child => isDescendant(child, targetId))
  }
  return false
}

// 选择节点
const handleNodeSelect = (data: ServiceTreeNode) => {
  if (!isDisabled(data)) {
    selectedParentId.value = data.id
  }
}

// 提交
const handleSubmit = async () => {
  if (!props.node || selectedParentId.value === null) return

  try {
    submitting.value = true
    await moveNodeApi(props.node.id, selectedParentId.value)
    ElMessage.success('移动成功')
    emit('success')
  } catch (error: any) {
    ElMessage.error(error.message || '移动失败')
  } finally {
    submitting.value = false
  }
}

watch(() => props.visible, (val) => {
  if (val) {
    selectedParentId.value = null
  }
})
</script>

<style scoped lang="scss">
.move-dialog-content {
  .current-location {
    padding: 12px 16px;
    background: var(--bg-hover);
    border-radius: 8px;
    margin-bottom: 16px;

    .label {
      color: var(--text-tertiary);
      margin-right: 8px;
    }

    .path {
      color: var(--text-secondary);
      font-weight: 500;
    }
  }

  .target-section {
    .section-label {
      font-size: 14px;
      color: var(--text-secondary);
      margin-bottom: 12px;
    }

    .tree-container {
      max-height: 300px;
      overflow: auto;
      border: 1px solid var(--border-base);
      border-radius: 8px;
      padding: 8px;

      .tree-node {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 4px 0;

        &.disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .node-icon {
          color: var(--text-tertiary);
        }

        .node-label {
          flex: 1;
          font-size: 14px;
          color: var(--text-secondary);
        }

        .current-tag {
          font-size: 11px;
          padding: 2px 6px;
          background: var(--accent-blue);
          color: white;
          border-radius: 4px;
        }
      }

      :deep(.el-tree-node__content) {
        height: 36px;
        border-radius: 6px;
      }

      :deep(.el-tree-node.is-current > .el-tree-node__content) {
        background: rgba(59, 130, 246, 0.15);
      }
    }

    .root-option {
      margin-top: 12px;
      padding: 8px 0;
    }
  }

  .preview {
    margin-top: 16px;
    padding: 12px 16px;
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid rgba(59, 130, 246, 0.2);
    border-radius: 8px;

    .label {
      color: var(--text-tertiary);
      margin-right: 8px;
    }

    .path {
      color: var(--accent-blue);
      font-weight: 500;
    }
  }
}
</style>
