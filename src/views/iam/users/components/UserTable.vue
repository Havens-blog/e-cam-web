<template>
  <!--
    用户列表主体：表头 + TransitionGroup 列表项 + 空状态。
    拆分来源：src/views/iam/users/index.vue 原模板 178-302 行，
    以及原 style 中的 `.users-list` / `.list-header` / `.user-item` / `.col-*` /
    `.empty-state` 块与 `// 动画` 段的 `.list-*`（全部逐字搬迁）。

    边界与取舍：
      1. 原模板最外层的 `v-if="!errorInfo"` 与 `v-loading` 中的 `loading` 均保留语义，
         但 `v-if` 移到父组件（父组件决定是否渲染本组件），`v-loading` 留在本组件根节点。
      2. `<TransitionGroup name="list">` 与其 `.list-*` 过渡类一并搬入本组件：过渡类名挂在
         列表项（本组件 scoped 元素）上，父组件中的同名规则匹配不到，必须同 SFC。
      3. 五个本地格式化函数（getAvatarText / getUserTypeClass / getUserTypeLabel /
         getStatusClass / getSafeUserStatus / formatTime）改由 ../utils 与 @/utils/constants
         导入，实现逐字未改。
      4. 选中判定 isSelected 由本组件基于 selectedUsers prop 计算，与拆分前父组件里的
         `selectedUsers.some(u => u.id === user.id)` 表达式完全一致；本组件不修改 props。
      5. 行内操作（下拉菜单）通过 action 事件把 (command, user) 上抛给父组件处理。
  -->
  <div class="users-list" v-loading="loading" :element-loading-text="loadingMessage">
    <!-- 列表头部 -->
    <div class="list-header">
      <div class="col-checkbox">
        <el-checkbox
          :model-value="isAllSelected"
          :indeterminate="isIndeterminate"
          @change="emit('select-all', $event)"
        />
      </div>
      <div class="col-user">用户</div>
      <div class="col-type">类型</div>
      <div class="col-status">状态</div>
      <div class="col-platform">云平台</div>
      <div class="col-groups">用户组</div>
      <div class="col-time">创建时间</div>
      <div class="col-actions">操作</div>
    </div>

    <!-- 用户列表项 -->
    <TransitionGroup name="list">
      <div
        v-for="user in users"
        :key="user.id"
        class="user-item"
        :class="{ 'is-selected': isSelected(user) }"
        @click="emit('view-detail', user)"
      >
        <div class="col-checkbox" @click.stop>
          <el-checkbox
            :model-value="isSelected(user)"
            @change="emit('toggle-select', user)"
          />
        </div>
        <div class="col-user">
          <div class="user-avatar">
            {{ getAvatarText(user) }}
          </div>
          <div class="user-info">
            <div class="user-name">{{ user.username }}</div>
            <div class="user-email">{{ user.email || user.display_name || '-' }}</div>
          </div>
        </div>
        <div class="col-type">
          <span class="type-badge" :class="getUserTypeClass(user.user_type)">
            {{ getUserTypeLabel(user.user_type) }}
          </span>
        </div>
        <div class="col-status">
          <span class="status-dot" :class="getStatusClass(user.status)"></span>
          <span class="status-text">{{ getSafeUserStatus(user.status).label }}</span>
        </div>
        <div class="col-platform">
          <div class="platform-info">
            <ProviderIcon :provider="user.provider" size="small" />
            <span>{{ user.cloud_account_name || getProviderLabel(user.provider) }}</span>
          </div>
        </div>
        <div class="col-groups">
          <template v-if="user.permission_groups && user.permission_groups.length > 0">
            <div class="groups-list">
              <span
                v-for="group in user.permission_groups.slice(0, 2)"
                :key="group.id"
                class="group-tag"
              >
                {{ group.name }}
              </span>
              <span v-if="user.permission_groups.length > 2" class="group-more">
                +{{ user.permission_groups.length - 2 }}
              </span>
            </div>
          </template>
          <span v-else class="no-groups">未分组</span>
        </div>
        <div class="col-time">
          {{ formatTime(user.create_time) }}
        </div>
        <div class="col-actions" @click.stop>
          <el-dropdown trigger="click" @command="(cmd: string) => emit('action', cmd, user)">
            <button class="action-trigger">
              <el-icon><MoreFilled /></el-icon>
            </button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="edit">
                  <el-icon><Edit /></el-icon>
                  编辑
                </el-dropdown-item>
                <el-dropdown-item command="detail">
                  <el-icon><View /></el-icon>
                  查看详情
                </el-dropdown-item>
                <el-dropdown-item command="assign">
                  <el-icon><FolderAdd /></el-icon>
                  分配用户组
                </el-dropdown-item>
                <el-dropdown-item divided command="delete">
                  <el-icon><Delete /></el-icon>
                  <span style="color: var(--accent-red)">删除</span>
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>
    </TransitionGroup>

    <!-- 空状态 -->
    <div v-if="!loading && users.length === 0" class="empty-state">
      <div class="empty-icon">
        <el-icon :size="48"><UserFilled /></el-icon>
      </div>
      <div class="empty-title">{{ hasFilters ? '没有符合条件的用户' : '暂无用户' }}</div>
      <div class="empty-desc">{{ hasFilters ? '尝试调整筛选条件' : '点击上方按钮创建第一个用户' }}</div>
      <div class="empty-actions">
        <el-button v-if="hasFilters" @click="emit('reset')">清除筛选</el-button>
        <el-button v-else type="primary" @click="emit('add')">
          <el-icon><Plus /></el-icon>
          创建用户
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CloudUser } from '@/api/types/iam'
import { ProviderIcon } from '@haven/ui/ProviderIcon'
import { getProviderLabel, getUserTypeLabel } from '@/utils/constants'
import { Delete, Edit, FolderAdd, MoreFilled, Plus, UserFilled, View } from '@element-plus/icons-vue'
import { formatTime, getAvatarText, getSafeUserStatus, getStatusClass, getUserTypeClass } from '../utils'

const props = defineProps<{
  /** 当前页用户列表：父组件 users */
  users: CloudUser[]
  /** 加载中：驱动 v-loading */
  loading: boolean
  /** v-loading 文案：父组件 loadingMessage */
  loadingMessage: string
  /** 是否存在筛选条件：决定空状态文案与「清除筛选 / 创建用户」按钮 */
  hasFilters: boolean
  /** 是否全选：父组件 isAllSelected */
  isAllSelected: boolean
  /** 半选态：父组件 isIndeterminate */
  isIndeterminate: boolean
  /** 已选用户（父组件 selectedUsers）：本组件据此计算每行是否选中 */
  selectedUsers: CloudUser[]
}>()

const emit = defineEmits<{
  /** 表头全选/取消全选，透传 el-checkbox 的值 */
  (e: 'select-all', value: boolean | string | number): void
  /** 单行复选框切换，携带该行用户 */
  (e: 'toggle-select', user: CloudUser): void
  /** 点击行（查看详情），携带该行用户 */
  (e: 'view-detail', user: CloudUser): void
  /** 行内操作下拉命令，携带 (command, user) */
  (e: 'action', command: string, user: CloudUser): void
  /** 空状态「清除筛选」 */
  (e: 'reset'): void
  /** 空状态「创建用户」 */
  (e: 'add'): void
}>()

/** 与拆分前父组件的 isSelected 表达式逐字等价；基于 props 计算，不修改父数据 */
const isSelected = (user: CloudUser) => props.selectedUsers.some((u) => u.id === user.id)
</script>

<style scoped lang="scss">
// 用户列表（CSS 逐字搬迁自 index.vue 原 style）
.users-list {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 16px;
}

.list-header {
  display: grid;
  grid-template-columns: 48px 2fr 100px 100px 160px 160px 120px 60px;
  gap: 12px;
  padding: 14px 20px;
  background: var(--bg-hover);
  border-bottom: 1px solid var(--border-subtle);
  font-size: 12px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;

  @media (max-width: 1200px) {
    display: none;
  }
}

.user-item {
  display: grid;
  grid-template-columns: 48px 2fr 100px 100px 160px 160px 120px 60px;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-subtle);
  cursor: pointer;
  transition: all 200ms ease;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: var(--bg-hover);
  }

  &.is-selected {
    background: rgba(113, 112, 255, 0.08);
  }

  @media (max-width: 1200px) {
    grid-template-columns: 48px 1fr auto;
    grid-template-rows: auto auto;

    .col-checkbox { grid-row: span 2; }
    .col-user { grid-column: 2; }
    .col-actions { grid-row: span 2; align-self: center; }
    .col-type, .col-status, .col-platform, .col-groups, .col-time {
      display: none;
    }
  }
}

.col-checkbox {
  display: flex;
  align-items: center;
  justify-content: center;
}

.col-user {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;

  .user-avatar {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple));
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    font-weight: 600;
    color: white;
    flex-shrink: 0;
  }

  .user-info {
    min-width: 0;

    .user-name {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .user-email {
      font-size: 12px;
      color: var(--text-tertiary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
}

.col-type {
  display: flex;
  align-items: center;

  .type-badge {
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    background: var(--bg-hover);
    color: var(--text-secondary);

    &.type-iam {
      background: rgba(113, 112, 255, 0.15);
      color: var(--accent-blue);
    }

    &.type-root {
      background: rgba(239, 68, 68, 0.15);
      color: var(--accent-red);
    }

    &.type-service {
      background: rgba(139, 92, 246, 0.15);
      color: var(--accent-purple);
    }
  }
}

.col-status {
  display: flex;
  align-items: center;
  gap: 8px;

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--text-muted);

    &.status-active {
      background: var(--accent-green);
    }

    &.status-inactive {
      background: var(--text-tertiary);
    }

    &.status-disabled {
      background: var(--accent-red);
    }

    &.status-locked {
      background: var(--accent-yellow);
    }
  }

  .status-text {
    font-size: 13px;
    color: var(--text-secondary);
  }
}

.col-platform {
  display: flex;
  align-items: center;

  .platform-info {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.col-groups {
  display: flex;
  align-items: center;

  .groups-list {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .group-tag {
    padding: 3px 8px;
    border-radius: 4px;
    font-size: 11px;
    background: var(--bg-hover);
    color: var(--text-secondary);
  }

  .group-more {
    font-size: 11px;
    color: var(--text-tertiary);
  }

  .no-groups {
    font-size: 13px;
    color: var(--text-muted);
  }
}

.col-time {
  display: flex;
  align-items: center;
  font-size: 13px;
  color: var(--text-tertiary);
}

.col-actions {
  display: flex;
  align-items: center;
  justify-content: center;

  .action-trigger {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: transparent;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-tertiary);
    transition: all 200ms ease;

    &:hover {
      background: var(--bg-hover);
      color: var(--text-primary);
    }
  }
}

// 空状态
.empty-state {
  padding: 60px 20px;
  text-align: center;

  .empty-icon {
    color: var(--text-muted);
    margin-bottom: 16px;
  }

  .empty-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 8px;
  }

  .empty-desc {
    font-size: 14px;
    color: var(--text-tertiary);
    margin-bottom: 20px;
  }

  .empty-actions {
    display: flex;
    justify-content: center;
    gap: 12px;
  }
}

// 列表项进出场动画（CSS 逐字搬迁自 index.vue 原 style 的 `// 动画` 段）
.list-enter-active,
.list-leave-active {
  transition: all 200ms ease;
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}
</style>
