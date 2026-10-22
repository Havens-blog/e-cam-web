/**
 * ECS 实例列表页（`views/compute/ecs/index.vue`）的纯展示格式化函数集合。
 *
 * 【拆分来源 / 边界】
 *   本文件由原 `views/compute/ecs/index.vue` 第 908-988 行的「辅助函数」区块**逐字迁移**而来，
 *   迁移时只做了一处机械改写：`const fn = ...` → `export const fn = ...`。
 *   函数体、默认返回值、边界判断、注释均未改动，因此行为与拆分前完全一致。
 *
 *   这些函数原先只被该页模板的表格单元格（状态点/状态文案/系统图标/规格/安全组/
 *   计费方式/平台/内存/时间/标签）使用，全部是无副作用的纯函数，只依赖常量表，
 *   迁出后由 `components/InstanceTable.vue` 统一引用，`index.vue` 不再持有它们。
 *
 * 【为什么收敛到同目录 utils.ts，而不是直接内联进 InstanceTable.vue】
 *   同一套「状态色 / 状态文案 / 系统图标 / 厂商名 / 容量 / 时间 / 标签」的展示口径，
 *   后续详情抽屉、导出行、以及其它计算资源页都可能复用；如果内联进单个子组件，
 *   很容易再长出第二份实现——本仓 `components/InstanceDetailDrawer.vue` 就已经各自
 *   维护了一份同名副本（见下方 ⚠）。放在同目录 utils.ts 给它一个单源位置。
 *
 * 【⚠ 已知历史分叉：本次刻意不动，留作后续独立任务】
 *   `components/InstanceDetailDrawer.vue` 第 639-693 行另有自己的 getOsIcon /
 *   getStatusClass / getChargeTypeText / formatDateTime / formatMemory 实现，且口径并**不**一致：
 *   例如该文件的 `getChargeTypeText` 只传 2 个参数（`labelOfLenient(CHARGE_TYPE_LABELS, chargeType)`），
 *   而本文件迁移前是 3 个参数（多一个兜底值 `'包年包月'`）。
 *   统一两者属于**行为变更**，超出本次「结构拆分、行为零变化」的范围，故本次未触碰该文件。
 */

import type { Asset } from '@/api/types/asset'
import { getProviderLabel } from '@/utils/constants'
import { CHARGE_TYPE_LABELS, ECS_STATUS_LABELS, labelOfLenient } from '@/utils/fieldLabels'
import { getProviderIcon } from '@/utils/icon-mapping'

/**
 * 搜索条件。
 *
 * 放在这里的原因：该类型原先定义在 index.vue，但拆分后**跨组件共享**——
 * `components/InstanceSearchBar.vue` 负责写入（新增/替换/删除条件），
 * `index.vue` 负责读取（把条件落到查询参数上，且统计卡片点击也会增删 status 条件）。
 * 为避免两边各写一份结构体，收敛到本文件共享。
 */
export interface SearchCondition {
  field: string
  value: string
  displayValue: string
}

// 辅助函数
export const getStatusClass = (status: string | undefined) => {
  if (!status) return ''
  const s = status.toUpperCase()
  const map: Record<string, string> = {
    RUNNING: 'running',
    STOPPED: 'stopped',
    DELETED: 'error',
    PENDING: 'pending',
  }
  return map[s] || ''
}

export const getStatusText = (status: string | undefined) => {
  if (!status) return '-'
  return ECS_STATUS_LABELS[status.toUpperCase()] || status
}

export const getOsIcon = (osType: string | undefined): string => {
  if (!osType) return 'caise-Linux'
  const os = osType.toLowerCase()
  if (os.includes('windows')) return 'caise-Windows'
  if (os.includes('ubuntu')) return 'caise-Ubuntu'
  if (os.includes('centos')) return 'caise-centos'
  // 默认返回 Linux 图标（适用于 Rocky Linux、Debian、RedHat 等）
  return 'caise-Linux'
}

export const getPlatformIcon = (provider?: string) => getProviderIcon(provider || '')

export const getChargeTypeText = (chargeType: string | undefined) => labelOfLenient(CHARGE_TYPE_LABELS, chargeType, '包年包月')

/** 云厂商展示名统一走 utils/constants 单源（含 volcengine/bytedance 与扩展云归一） */
export const getProviderName = (provider: string | undefined): string => (provider ? getProviderLabel(provider) : '-')

export const getSecurityGroupCount = (item: Asset): string => {
  const groups = item.attributes?.security_groups || item.attributes?.security_group_ids
  if (Array.isArray(groups) && groups.length > 0) {
    return `${groups.length} 个`
  }
  return item.attributes?.security_group || '-'
}

export const formatMemory = (memory: number | undefined): string => {
  if (!memory) return '-'
  if (memory >= 1024) {
    return `${(memory / 1024).toFixed(0)}GB`
  }
  return `${memory}MB`
}

export const formatDateTime = (dateStr: string | undefined): string => {
  if (!dateStr) return '-'
  try {
    const date = new Date(dateStr)
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

export const formatTime = (time: number | undefined): string => {
  if (!time) return '-'
  return new Date(time).toLocaleString('zh-CN')
}

export const formatTags = (tags: Record<string, string> | undefined): string => {
  if (!tags || typeof tags !== 'object') return '-'
  const entries = Object.entries(tags)
  if (entries.length === 0) return '-'
  if (entries.length <= 2) {
    return entries.map(([k, v]) => `${k}:${v}`).join(', ')
  }
  return `${entries.slice(0, 2).map(([k, v]) => `${k}:${v}`).join(', ')} +${entries.length - 2}`
}
