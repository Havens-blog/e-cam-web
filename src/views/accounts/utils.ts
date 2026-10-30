// 云账号视图共享的纯展示格式化函数（自 index.vue 抽出，卡片/列表两个视图组件共用）。
// 注意：components/AccountDetailDrawer.vue 内另有同名函数且实现已历史分化（如状态标签
// 文案、provider 类名映射方式不同），去重统一属行为变更，需单独评估，不在本次拆分范围。
// 走 utils/constants 的展示名单源（转发 @haven/ui/provider.getProviderLabel，
// 该实现已认 `volcengine`/`bytedance` 等别名）。
// 修复前直接用 PROVIDER_CONFIGS 查表：云账号接口对火山云返回 `volcengine`，
// 查不到配置就回退原值 ⇒ 列表/卡片视图显示裸英文 `volcengine`，
// 而同页其他云（腾讯云等）与详情抽屉（走 getProviderLabel）都是中文名，前后不一致。
import { ACCOUNT_STATUS, ENVIRONMENTS, getProviderLabel } from '@/utils/constants'

export const getProviderName = (provider: string) => {
  return provider ? getProviderLabel(provider) : '-'
}

export const getProviderClass = (provider: string | undefined) => {
  if (!provider) return ''
  const map: Record<string, string> = {
    'aliyun': 'provider-aliyun',
    'tencent': 'provider-tencent',
    'aws': 'provider-aws',
    'huawei': 'provider-huawei',
    'azure': 'provider-azure'
  }
  return map[provider] || ''
}

export const getProviderAccentClass = (provider: string | undefined) => {
  if (!provider) return ''
  const map: Record<string, string> = {
    'aliyun': 'accent-aliyun',
    'tencent': 'accent-tencent',
    'aws': 'accent-aws',
    'huawei': 'accent-huawei',
    'azure': 'accent-azure'
  }
  return map[provider] || ''
}

export const getEnvClass = (env: string | undefined) => {
  if (!env) return ''
  const map: Record<string, string> = {
    'production': 'env-prod',
    'staging': 'env-staging',
    'development': 'env-dev',
    'test': 'env-test'
  }
  return map[env] || ''
}

export const getStatusClass = (status: string | undefined) => {
  if (!status) return ''
  const map: Record<string, string> = {
    'active': 'status-active',
    'disabled': 'status-disabled',
    'error': 'status-error',
    'testing': 'status-testing',
    'inactive': 'status-inactive'
  }
  return map[status] || ''
}

export const getEnvironmentLabel = (env: string | undefined) => {
  if (!env) return '-'
  const item = ENVIRONMENTS.find(e => e.value === env)
  return item?.label || env
}

export const getStatusLabel = (status: string | undefined) => {
  if (!status) return '-'
  const item = ACCOUNT_STATUS.find(s => s.value === status)
  return item?.label || status
}

export const maskAccessKey = (key: string | undefined) => {
  if (!key) return '-'
  if (key.length <= 8) return key
  return key.slice(0, 4) + '****' + key.slice(-4)
}

export const formatSyncTime = (time: string | undefined) => {
  if (!time) return '从未同步'
  const date = new Date(time)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days < 7) return `${days}天前`
  return date.toLocaleDateString('zh-CN')
}
