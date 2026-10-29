<template>
  <!--
    分页条：总数文案 + 上一页/页码/下一页 + 每页条数选择。
    拆分来源：src/views/iam/users/index.vue 原模板 304-343 行，
    以及原 style 中的 `.pagination-bar` 块（逐字搬迁）。

    边界：原模板最外层的 `v-if="!errorInfo && pagination.total > 0"` 保留在父组件
    （由父组件决定是否渲染本组件），因此本组件根节点直接是 `.pagination-bar`。

    数据流：
      - page / total / totalPages / visiblePages 为只读 props（父组件仍持有分页状态与
        visiblePages 计算逻辑，未下沉）；
      - 每页条数用 defineModel('size') 双向绑定回父组件 pagination.size；
      - 翻页与改每页条数均以事件上抛，父组件负责重置页码并重新拉取。

    注意：模板中原 `v-for="page in visiblePages"` 的循环变量与 page 状态同名，
    现在 page 变成了 prop，若沿用同名会造成遮蔽，故循环变量改为 `p`（仅变量改名，
    比较与渲染逻辑不变）。
  -->
  <div class="pagination-bar">
    <div class="pagination-info">
      共 <strong>{{ total }}</strong> 条记录
    </div>
    <div class="pagination-controls">
      <button
        class="page-btn"
        :disabled="page === 1"
        @click="emit('current-change', page - 1)"
      >
        <el-icon><ArrowLeft /></el-icon>
      </button>
      <div class="page-numbers">
        <button
          v-for="p in visiblePages"
          :key="p"
          class="page-num"
          :class="{ active: p === page, ellipsis: p === '...' }"
          :disabled="p === '...'"
          @click="p !== '...' && emit('current-change', Number(p))"
        >
          {{ p }}
        </button>
      </div>
      <button
        class="page-btn"
        :disabled="page === totalPages"
        @click="emit('current-change', page + 1)"
      >
        <el-icon><ArrowRight /></el-icon>
      </button>
      <el-select v-model="size" class="size-select" @change="emit('size-change')">
        <el-option :value="10" label="10 条/页" />
        <el-option :value="20" label="20 条/页" />
        <el-option :value="50" label="50 条/页" />
        <el-option :value="100" label="100 条/页" />
      </el-select>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ArrowLeft, ArrowRight } from '@element-plus/icons-vue'

/** 每页条数：双向绑定回父组件 pagination.size */
const size = defineModel<number>('size', { required: true })

defineProps<{
  /** 当前页码：父组件 pagination.page */
  page: number
  /** 总记录数：父组件 pagination.total */
  total: number
  /** 总页数：父组件 totalPages */
  totalPages: number
  /** 页码序列（含 '...'）：父组件 visiblePages */
  visiblePages: (number | string)[]
}>()

const emit = defineEmits<{
  /** 翻页，携带目标页码（父组件 handleCurrentChange） */
  (e: 'current-change', page: number): void
  /** 每页条数变更（父组件 handleSizeChange：重置到第一页并重新拉取） */
  (e: 'size-change'): void
}>()
</script>

<style scoped lang="scss">
// 分页（CSS 逐字搬迁自 index.vue 原 style 的 `.pagination-bar` 块）
.pagination-bar {
  /* 801–889：info(88) + 控件(490) + padding 放不进一行，允许整条换行，
     而不是把 info 压成竖排（原缺陷：info 宽 24px、5 行、卡片高 139px） */
  flex-wrap: wrap;
  row-gap: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;

  @media (max-width: 640px) {
    flex-direction: column;
    gap: 16px;
  }

  .pagination-info {
    font-size: 14px;
    color: var(--text-secondary);
    /* 801–889 区间分页条是 flex row + space-between：控件固定 490px 时 info 会被压成 24px 竖排（5 行），
       整条卡片高度涨到 139px。禁止压缩与换行，让它保持单行，必要时由分页条自己换行。 */
    flex-shrink: 0;
    white-space: nowrap;

    strong {
      color: var(--text-primary);
      font-weight: 600;
    }
  }

  .pagination-controls {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .page-btn {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: var(--bg-hover);
    border: 1px solid var(--border-subtle);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary);
    transition: all 200ms ease;

    &:hover:not(:disabled) {
      background: var(--bg-surface);
      border-color: var(--border-strong);
      color: var(--text-primary);
    }

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  }

  .page-numbers {
    display: flex;
    gap: 4px;
  }

  .page-num {
    min-width: 36px;
    height: 36px;
    padding: 0 8px;
    border-radius: 8px;
    background: transparent;
    border: 1px solid transparent;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    color: var(--text-secondary);
    transition: all 200ms ease;

    &:hover:not(:disabled):not(.active) {
      background: var(--bg-hover);
    }

    &.active {
      /* 白字压原 --accent-blue 仅 3.84:1（AA 需 4.5）→ 压暗 18% 至约 5.5:1，保留品牌色相 */
      background: color-mix(in srgb, var(--accent-blue) 82%, #000);
      color: white;
    }

    &.ellipsis {
      cursor: default;
      /* 原 --text-muted 在卡片底上仅 2.25:1 → 次文字色 */
      color: var(--text-secondary);
    }
  }

  .size-select {
    width: 110px;
    margin-left: 8px;

    :deep(.el-select__wrapper) {
      background: var(--bg-hover);
      border: 1px solid var(--border-subtle);
      box-shadow: none;
      border-radius: 8px;
      height: 36px;
    }
  }
}

/* 分页条换行后 space-between 在「行内只有 1 个子项」时退化为 flex-start，
   控件会从最右跳到最左（跳变约 400px）。auto 外边距让它始终贴右，视觉连续。
   注意：≤640 是 column 方向，margin-left:auto 会顶掉水平居中，故限定 ≥641。 */
@media (min-width: 641px) {
  .pagination-bar .pagination-controls {
    margin-left: auto;
  }
}

/* IAM_USERS_MOBILE_NO_OVERFLOW：分页控件 7 页时约 490px，而 360 下可用宽度仅约 230px。
   ≤800 而非 ≤768：769 起侧栏展开为 220px，内容宽骤降，490px 的分页条会溢出约 10px。
   - 控件与页码序列都可换行
   - 页码改用 min-width + 自动宽度（固定 30px 会在 padding/边框挤压下裁切 3 位数）
   - 只压缩列间距，不动 row-gap，避免换行后两行贴死 */
@media (max-width: 800px) {
  .pagination-bar .pagination-controls {
    flex-wrap: wrap;
    justify-content: center;
    column-gap: 4px;
    row-gap: 8px;
  }

  .pagination-bar .page-numbers {
    flex-wrap: wrap;
    justify-content: center;
    column-gap: 4px;
    row-gap: 4px;
  }

  .pagination-bar .page-num,
  .pagination-bar .page-btn {
    width: auto;
    min-width: 28px;
    padding: 0 4px;
  }
}
</style>
