/**
 * IAM 云账号用户列表 —— 纯展示格式化函数
 *
 * 【拆分来源】
 * 本文件从 src/views/iam/users/index.vue 抽出，对应原文件的 475-518 行：
 * getSafeUserStatus / getUserTypeClass / getStatusClass / getAvatarText / formatTime。
 *
 * 【为什么抽成 utils.ts 而不是塞进某个子组件】
 * 这 5 个函数都是纯函数、不依赖任何组件状态，原本只服务于「用户列表」模板。
 * 单独成文件的目的：
 *  1. 让列表组件（components/UserTable.vue）只关心渲染，格式化口径集中一处；
 *  2. 后续若详情抽屉等组件需要同口径格式化，可直接复用，避免出现
 *     accounts 模块那样「同一份格式化逻辑在两个文件里各自分叉」的问题
 *     （见 src/views/accounts/utils.ts 顶部关于 AccountDetailDrawer 分叉的说明）。
 *
 * 【行为边界 —— 严格遵守「逐字等价」】
 * 以下实现的入参、分支、返回值、兜底文案全部与拆分前一致，未做任何"顺手修正"。
 * 特别注意 getSafeUserStatus 的类型签名保持为 { label: string; color: string }，
 * 依赖 getUserStatus 的既有返回类型，不做额外收敛。
 *
 * 【未纳入本文件的相关函数】
 * getUserTypeLabel / getProviderLabel / getUserStatus 来自 @/utils/constants，
 * 属共享常量与标签映射，仍由各使用方直接 import，不在此处二次封装。
 */
import type { CloudUser } from '@/api/types/iam'
import { getUserStatus } from '@/utils/constants'

/** 安全获取用户状态文案与颜色；status 为空或未被 getUserStatus 收录时回退为 '-' / info */
export const getSafeUserStatus = (status: string | undefined): { label: string; color: string } => {
  if (!status) return { label: '-', color: 'info' }
  const statusInfo = getUserStatus(status)
  return statusInfo || { label: '-', color: 'info' }
}

/** 用户类型 → 类型徽标的样式类名（未收录的类型返回空串，由基础样式兜底） */
export const getUserTypeClass = (type: string | undefined) => {
  if (!type) return ''
  const typeMap: Record<string, string> = {
    'iam': 'type-iam',
    'root': 'type-root',
    'service': 'type-service',
    'federated': 'type-federated'
  }
  return typeMap[type] || ''
}

/** 用户状态 → 状态圆点的样式类名（未收录的状态返回空串，圆点用默认灰色） */
export const getStatusClass = (status: string | undefined) => {
  if (!status) return ''
  const statusMap: Record<string, string> = {
    'active': 'status-active',
    'inactive': 'status-inactive',
    'disabled': 'status-disabled',
    'locked': 'status-locked'
  }
  return statusMap[status] || ''
}

/** 列表头像文字：优先取显示名首字母，其次用户名首字母，均无则兜底 'U' */
export const getAvatarText = (user: CloudUser) => {
  if (user.display_name) return user.display_name.charAt(0).toUpperCase()
  if (user.username) return user.username.charAt(0).toUpperCase()
  return 'U'
}

/** 创建时间格式化：zh-CN 数字日期（YYYY/MM/DD）；空值兜底 '-' */
export const formatTime = (time: string | undefined) => {
  if (!time) return '-'
  const date = new Date(time)
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}
