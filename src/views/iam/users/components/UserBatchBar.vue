<template>
  <!--
    批量操作栏：选中若干用户后出现，提供「分配用户组 / 批量删除 / 取消选择」。
    拆分来源：src/views/iam/users/index.vue 原模板 151-176 行，
    以及原 style 中的 `.batch-bar` 块与 `// 动画` 段的 `.slide-fade-*`（逐字搬迁）。

    边界与取舍：
      1. 原 `<Transition name="slide-fade">` 一并搬进本组件。原因是过渡类名会被挂到
         被包裹的 `.batch-bar` 元素上，而该元素现在带的是本组件的 scope id，
         父组件里的同名规则匹配不到；过渡必须与其消费的标记处于同一 SFC。
      2. 因此本组件「常驻挂载」，由内部的 v-if 决定是否显示操作栏——这与拆分前
         父组件里 Transition + 内部 v-if 的结构完全一致，进出场动画行为不变。
      3. 选择态（isAllSelected / isIndeterminate / selectedCount）仍由父组件持有，
         本组件只读；所有操作以事件上抛，不直接改父数据。
  -->
  <Transition name="slide-fade">
    <div v-if="selectedCount > 0" class="batch-bar">
      <div class="batch-info">
        <el-checkbox
          :model-value="isAllSelected"
          :indeterminate="isIndeterminate"
          @change="emit('select-all', $event)"
        />
        <span class="selected-text">
          已选择 <strong>{{ selectedCount }}</strong> 个用户
        </span>
      </div>
      <div class="batch-actions">
        <el-button size="small" @click="emit('batch-assign')">
          <el-icon><FolderAdd /></el-icon>
          分配用户组
        </el-button>
        <el-button size="small" type="danger" :loading="batchDeleting" @click="emit('batch-delete')">
          <el-icon><Delete /></el-icon>
          批量删除
        </el-button>
        <el-button size="small" text @click="emit('clear-selection')">取消选择</el-button>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { Delete, FolderAdd } from '@element-plus/icons-vue'

defineProps<{
  /** 已选用户数量：父组件 selectedUsers.length */
  selectedCount: number
  /** 是否全选：父组件 isAllSelected */
  isAllSelected: boolean
  /** 半选态：父组件 isIndeterminate */
  isIndeterminate: boolean
  /** 批量删除进行中（用于按钮 loading，防止重复提交） */
  batchDeleting: boolean
}>()

const emit = defineEmits<{
  /** 全选/取消全选复选框变更，透传 el-checkbox 的值（父组件 handleSelectAll） */
  (e: 'select-all', value: boolean | string | number): void
  /** 点击「分配用户组」 */
  (e: 'batch-assign'): void
  /** 点击「批量删除」 */
  (e: 'batch-delete'): void
  /** 点击「取消选择」 */
  (e: 'clear-selection'): void
}>()
</script>

<style scoped lang="scss">
// 批量操作栏（CSS 逐字搬迁自 index.vue 原 style 的 `.batch-bar` 块）
.batch-bar {
  background: rgba(113, 112, 255, 0.1);
  border: 1px solid rgba(113, 112, 255, 0.2);
  border-radius: 12px;
  padding: 12px 20px;
  margin-bottom: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;

  .batch-info {
    display: flex;
    align-items: center;
    gap: 12px;

    .selected-text {
      font-size: 14px;
      color: var(--text-secondary);

      strong {
        color: var(--accent-blue);
        font-weight: 600;
      }
    }
  }

  .batch-actions {
    display: flex;
    gap: 8px;
  }
}

// 进出场动画（CSS 逐字搬迁自 index.vue 原 style 的 `// 动画` 段）
.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 200ms ease;
}

.slide-fade-enter-from,
.slide-fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
