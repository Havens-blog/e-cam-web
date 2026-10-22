<template>
  <div class="table-wrapper">
    <!-- 固定表头 -->
    <div class="table-header">
      <table class="data-table">
        <thead>
          <tr>
            <th class="col-name">名称</th>
            <th v-for="col in visibleColumns" :key="col.key" :style="{ width: col.width + 'px' }">
              {{ col.label }}
            </th>
            <th class="col-actions">操作</th>
          </tr>
        </thead>
      </table>
    </div>

    <!-- 表格内容（可滚动） -->
    <div class="table-body" v-loading="loading">
      <table class="data-table">
        <tbody>
          <tr
            v-for="item in instances"
            :key="item.id"
            @click="emit('row-click', item)"
          >
            <td class="col-name">
              <div class="name-cell">
                <span class="instance-name" @click.stop="emit('view-detail', item)">
                  {{ item.asset_name || item.asset_id }}
                </span>
                <el-icon v-if="item.attributes?.is_locked" class="lock-icon"><Lock /></el-icon>
              </div>
            </td>
            <!-- 动态列 -->
            <td v-for="col in visibleColumns" :key="col.key" :style="{ width: col.width + 'px' }">
              <!-- 状态列 -->
              <template v-if="col.key === 'status'">
                <span class="status-dot" :class="getStatusClass(item.attributes?.status)"></span>
                <span class="status-text">{{ getStatusText(item.attributes?.status) }}</span>
              </template>
              <!-- IP列 -->
              <template v-else-if="col.key === 'ip'">
                <span class="ip-text">{{ item.attributes?.private_ip || '-' }}</span>
                <span v-if="item.attributes?.private_ip" class="ip-tag">私有</span>
              </template>
              <!-- 公网IP列 -->
              <template v-else-if="col.key === 'public_ip'">
                <span class="ip-text">{{ item.attributes?.public_ip || '-' }}</span>
                <span v-if="item.attributes?.public_ip" class="ip-tag">公网</span>
              </template>
              <!-- 系统列 -->
              <template v-else-if="col.key === 'os'">
                <IconFont :type="getOsIcon(item.attributes?.os_type)" class="os-icon" :title="item.attributes?.os_name" />
              </template>
              <!-- 规格列 -->
              <template v-else-if="col.key === 'spec'">
                <span class="spec-text">{{ item.attributes?.instance_type || '-' }}</span>
              </template>
              <!-- 安全组列 -->
              <template v-else-if="col.key === 'security_group'">
                <span class="env-tag">{{ getSecurityGroupCount(item) }}</span>
              </template>
              <!-- 计费方式列 -->
              <template v-else-if="col.key === 'billing'">
                <span class="billing-text">{{ getChargeTypeText(item.attributes?.charge_type) }}</span>
              </template>
              <!-- 平台列 -->
              <template v-else-if="col.key === 'platform'">
                <IconFont :type="getPlatformIcon(item.attributes?.platform || item.attributes?.provider)" class="platform-icon" :title="getProviderName(item.attributes?.provider)" />
              </template>
              <!-- 项目列 -->
              <template v-else-if="col.key === 'project'">
                <span class="project-text">{{ item.attributes?.project || item.tenant_id }}</span>
              </template>
              <!-- 区域列 -->
              <template v-else-if="col.key === 'region'">
                <div class="region-cell">
                  <span class="region-text">{{ item.attributes?.region || '-' }}</span>
                </div>
              </template>
              <!-- 主机名列 -->
              <template v-else-if="col.key === 'host_name'">
                <span class="text-ellipsis">{{ item.attributes?.host_name || '-' }}</span>
              </template>
              <!-- CPU列 -->
              <template v-else-if="col.key === 'cpu'">
                <span>{{ item.attributes?.cpu ? item.attributes.cpu + '核' : '-' }}</span>
              </template>
              <!-- 内存列 -->
              <template v-else-if="col.key === 'memory'">
                <span>{{ formatMemory(item.attributes?.memory) }}</span>
              </template>
              <!-- 云账号列 -->
              <template v-else-if="col.key === 'cloud_account'">
                <span class="text-ellipsis">{{ item.attributes?.cloud_account_name || '-' }}</span>
              </template>
              <!-- VPC列 -->
              <template v-else-if="col.key === 'vpc'">
                <span class="text-ellipsis">{{ item.attributes?.vpc_id || '-' }}</span>
              </template>
              <!-- 可用区列 -->
              <template v-else-if="col.key === 'zone'">
                <span>{{ item.attributes?.zone || '-' }}</span>
              </template>
              <!-- 到期时间列 -->
              <template v-else-if="col.key === 'expired_time'">
                <span>{{ formatDateTime(item.attributes?.expired_time) }}</span>
              </template>
              <!-- 创建时间列 -->
              <template v-else-if="col.key === 'create_time'">
                <span>{{ formatDateTime(item.attributes?.creation_time) || formatTime(item.create_time) }}</span>
              </template>
              <!-- 标签列 -->
              <template v-else-if="col.key === 'tags'">
                <span class="tags-cell">{{ formatTags(item.attributes?.tags) }}</span>
              </template>
              <!-- 默认 -->
              <template v-else>
                <span>-</span>
              </template>
            </td>
            <td class="col-actions" @click.stop>
              <el-dropdown trigger="click" @command="(cmd: string) => emit('action', cmd, item)">
                <span class="action-link">远程登录</span>
                <template #dropdown>
                  <el-dropdown-menu>
                    <!-- F-C4：handleAction 无 ssh/vnc 分支，按主题 B 决策禁用 + title -->
                    <el-dropdown-item command="ssh" disabled title="功能开发中">SSH登录</el-dropdown-item>
                    <el-dropdown-item command="vnc" disabled title="功能开发中">VNC登录</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
              <el-dropdown trigger="click" @command="(cmd: string) => emit('action', cmd, item)">
                <span class="action-link">更多</span>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="view">查看详情</el-dropdown-item>
                    <el-dropdown-item command="edit">编辑</el-dropdown-item>
                    <el-dropdown-item command="delete" divided>
                      <span class="danger-text">删除</span>
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- 空状态 -->
      <div v-if="!loading && instances.length === 0" class="empty-state">
        <el-icon :size="48"><Box /></el-icon>
        <p>暂无数据</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * ECS 实例表格（列表主视图：固定表头 + 可滚动表体 + 动态列 + 行内操作下拉）。
 *
 * 【拆分来源 / 边界】
 *   模板来自原 `views/compute/ecs/index.vue` 第 232-388 行的 `.table-wrapper` 区块，
 *   样式来自同文件 `<style scoped>` 中第 1688-1887 行（`// 表格区域` 注释起，
 *   到 `.empty-state` 结束），均为**逐字搬迁**，元素结构/类名/条件分支/文案零改动。
 *
 *   本组件只负责「把一行资产渲染出来」，不持有任何数据：
 *   数据与加载态由 props 传入，交互一律 emit 回页面编排层。
 *
 * 【为什么 emit 拆成 row-click / view-detail 两个事件而不合并】
 *   迁移前父组件里 `<tr @click="handleRowClick(item)">` 与
 *   `<span @click.stop="handleViewDetail(item)">` 是两个不同的处理函数
 *   （handleRowClick 内部转调 handleViewDetail）。为保持父组件调用链与拆分前
 *   完全一致（父组件两个处理函数原样保留、不产生未使用变量），这里保留两条事件通道。
 */
import type { Asset } from '@/api/types/asset'
import { IconFont } from '@haven/ui/IconFont'
import { Box, Lock } from '@element-plus/icons-vue'
import type { ColumnConfig } from './ColumnSettingsDialog.vue'
import {
  formatDateTime,
  formatMemory,
  formatTags,
  formatTime,
  getChargeTypeText,
  getOsIcon,
  getPlatformIcon,
  getProviderName,
  getSecurityGroupCount,
  getStatusClass,
  getStatusText,
} from '../utils'

defineProps<{
  /** 当前页实例列表 */
  instances: Asset[]
  /** 加载态（v-loading 遮罩，与拆分前一致） */
  loading: boolean
  /** 可见列配置（由页面层的自定义列对话框维护） */
  visibleColumns: ColumnConfig[]
}>()

const emit = defineEmits<{
  /** 行点击（页面层对应 handleRowClick → handleViewDetail） */
  'row-click': [item: Asset]
  /** 点名称打开详情（页面层对应 handleViewDetail） */
  'view-detail': [item: Asset]
  /** 行内「远程登录 / 更多」下拉命令（页面层对应 handleAction） */
  action: [command: string, item: Asset]
}>()
</script>

<style scoped lang="scss">
// 表格区域
.table-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--bg-elevated);
}

.table-header {
  flex-shrink: 0;
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border-subtle);
  overflow: hidden;
}

.table-body {
  flex: 1;
  overflow: auto;
  min-height: 0;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  table-layout: fixed;

  th, td {
    padding: 10px 12px;
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  // 首/末列对齐页面 20px 横向节奏（去多选列后首列名称不再贴边错位）
  th:first-child, td:first-child { padding-left: 20px; }
  th:last-child, td:last-child { padding-right: 20px; }

  th {
    background: var(--bg-surface);
    color: var(--text-secondary);
    font-weight: 500;
  }

  td {
    border-bottom: 1px solid var(--border-subtle);
  }

  tbody tr {
    transition: background 150ms ease;
    cursor: pointer;

    &:hover {
      background: var(--bg-hover);
    }
  }
}

.col-name { width: 220px; max-width: 220px; }
.col-actions { width: 110px; }

// 单元格样式
.name-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: 200px;

  .instance-name {
    color: var(--accent-blue);
    cursor: pointer;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    &:hover {
      text-decoration: underline;
    }
  }

  .lock-icon {
    color: var(--text-muted);
    font-size: 12px;
    flex-shrink: 0;
  }
}

.status-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  margin-right: 6px;
  background: var(--text-muted);

  &.running { background: var(--accent-green); }
  &.stopped { background: var(--text-tertiary); }
  &.error { background: var(--accent-red); }
  &.pending { background: var(--accent-yellow); }
}

.status-text {
  color: var(--text-secondary);
}

.ip-text {
  color: var(--text-primary);
}

.ip-tag {
  margin-left: 4px;
  padding: 1px 4px;
  font-size: 10px;
  background: var(--bg-hover);
  border-radius: 2px;
  color: var(--text-tertiary);
}

.os-icon {
  font-size: 20px;
}

.spec-text, .billing-text, .project-text {
  color: var(--text-secondary);
}

.env-tag {
  padding: 2px 8px;
  background: var(--bg-hover);
  border-radius: 4px;
  font-size: 12px;
  color: var(--text-secondary);
}

.platform-icon {
  font-size: 20px;
}

.region-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;

  .region-text {
    color: var(--text-secondary);
  }

  .zone-text {
    font-size: 11px;
    color: var(--text-muted);
  }
}

.action-link {
  color: var(--accent-blue);
  cursor: pointer;
  margin-right: 12px;

  &:hover {
    text-decoration: underline;
  }
}

.danger-text {
  color: var(--accent-red);
}

.text-ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
  display: inline-block;
}

.tags-cell {
  font-size: 12px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
  display: inline-block;
}

// 空状态
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--text-muted);

  p {
    margin-top: 12px;
  }
}
</style>
