/**
 * 多云 CDN 共享标签工具。
 *
 * 后端(26c0758)已将业务类型/服务区域/状态归一化为统一枚举,
 * 原始值保留在 *_raw;映射同时收录历史原始值,重同步前后的存量数据都能正确显示。
 */

/** 统一业务类型 + 历史原始值 → 中文文案 */
const BUSINESS_TYPE_LABELS: Record<string, string> = {
    // 统一枚举
    web: '网页加速',
    download: '下载加速',
    media: '流媒体点播',
    whole_site: '全站加速',
    dynamic: '动态加速',
    other: '其他',
    // 历史原始值兼容
    page: '网页加速',
    file: '下载加速',
    video: '流媒体点播',
    vod: '点播加速',
    vodDomainName: '点播',
    dcdn: '全站加速',
    wholeSite: '全站加速',
    api: '动态加速',
}

export function cdnBusinessTypeLabel(type?: string): string {
    if (!type) return '-'
    return BUSINESS_TYPE_LABELS[type] || type
}

/** 统一服务区域 + 历史原始值 → 中文文案 */
const SERVICE_AREA_LABELS: Record<string, string> = {
    domestic: '中国大陆',
    overseas: '海外',
    global: '全球',
    // 历史原始值兼容
    mainland: '中国大陆',
    mainland_china: '中国大陆',
}

export function cdnServiceAreaLabel(area?: string): string {
    if (!area) return '-'
    return SERVICE_AREA_LABELS[area] || area
}

/** 统一状态 + 历史原始值 → 中文文案(供 AssetStatusBadge 的 labels) */
export const CDN_STATUS_LABELS: Record<string, string> = {
    // 统一枚举
    online: '正常',
    offline: '已停用',
    configuring: '配置中',
    checking: '审核中',
    check_failed: '审核失败',
    error: '异常',
    // 历史原始值兼容
    Online: '正常',
    Deployed: '正常',
    deployed: '正常',
    active: '正常',
    Active: '正常',
    Started: '正常',
    started: '正常',
    Offline: '已停用',
    stopped: '已停用',
    Stopped: '已停用',
    disabled: '已停用',
    closed: '已停用',
    Closed: '已停用',
    Configuring: '配置中',
    InProgress: '部署中',
    inprogress: '部署中',
    deploying: '部署中',
    Deploying: '部署中',
    creating: '创建中',
    Checking: '审核中',
    pending: '审核中',
    CheckFailed: '审核失败',
    failed: '失败',
    Failed: '失败',
}

export function cdnStatusLabel(status?: string): string {
    if (!status) return '-'
    return CDN_STATUS_LABELS[status] || status
}

/** 业务类型筛选选项(统一枚举,后端 Variants 兼容历史数据) */
export const CDN_BUSINESS_TYPE_OPTIONS = [
    { label: '网页加速', value: 'web' },
    { label: '下载加速', value: 'download' },
    { label: '流媒体点播', value: 'media' },
    { label: '全站加速', value: 'whole_site' },
    { label: '动态加速', value: 'dynamic' },
    { label: '其他', value: 'other' },
]

/** 服务区域筛选选项 */
export const CDN_SERVICE_AREA_OPTIONS = [
    { label: '中国大陆', value: 'domestic' },
    { label: '海外', value: 'overseas' },
    { label: '全球', value: 'global' },
]

/** 缓存规则匹配类型 → 中文文案 */
const CACHE_RULE_TYPE_LABELS: Record<string, string> = {
    all: '全站',
    file_ext: '文件后缀',
    directory: '目录',
    full_path: '全路径',
}

export function cdnCacheRuleTypeLabel(type?: string): string {
    if (!type) return '-'
    return CACHE_RULE_TYPE_LABELS[type] || type
}

/** 缓存时间(秒)→ 文案: -1 跟随源站 / 0 不缓存 / >0 人性化时长 */
export function cdnTtlText(ttl?: number): string {
    if (ttl === undefined || ttl === null) return '-'
    if (ttl === -1) return '跟随源站'
    if (ttl === 0) return '不缓存'
    if (ttl % 86400 === 0) return `${ttl / 86400} 天`
    if (ttl % 3600 === 0) return `${ttl / 3600} 小时`
    if (ttl % 60 === 0) return `${ttl / 60} 分钟`
    return `${ttl} 秒`
}
