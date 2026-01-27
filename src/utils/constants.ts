/**
 * CAM 模块常量定义
 */

// ==================== 云厂商常量 ====================

export type CloudProvider = 'aliyun' | 'aws' | 'azure' | 'tencent' | 'huawei' | 'volcengine'

export interface ProviderConfig {
    id: CloudProvider
    name: string
    displayName: string
    icon: string
    color: string
    regions: Array<{ value: string; label: string }>
    assetTypes: Array<{ value: string; label: string }>
    features: string[]
}

export const PROVIDER_CONFIGS: Record<CloudProvider, ProviderConfig> = {
    aliyun: {
        id: 'aliyun',
        name: 'aliyun',
        displayName: '阿里云',
        icon: 'icon-aliyun',
        color: '#ff6a00',
        regions: [
            { value: 'cn-hangzhou', label: '华东1(杭州)' },
            { value: 'cn-shanghai', label: '华东2(上海)' },
            { value: 'cn-beijing', label: '华北2(北京)' },
            { value: 'cn-shenzhen', label: '华南1(深圳)' },
            { value: 'cn-guangzhou', label: '华南2(广州)' },
            { value: 'cn-chengdu', label: '西南1(成都)' }
        ],
        assetTypes: [
            { value: 'ecs', label: '弹性计算服务' },
            { value: 'rds', label: '关系型数据库' },
            { value: 'oss', label: '对象存储' },
            { value: 'slb', label: '负载均衡' },
            { value: 'vpc', label: '虚拟私有云' },
            { value: 'eip', label: '弹性公网IP' }
        ],
        features: ['auto_sync', 'cost_monitoring', 'batch_operations']
    },
    aws: {
        id: 'aws',
        name: 'aws',
        displayName: 'Amazon Web Services',
        icon: 'icon-aws',
        color: '#ff9900',
        regions: [
            { value: 'us-east-1', label: 'US East (N. Virginia)' },
            { value: 'us-west-2', label: 'US West (Oregon)' },
            { value: 'eu-west-1', label: 'Europe (Ireland)' },
            { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
            { value: 'ap-northeast-1', label: 'Asia Pacific (Tokyo)' },
            { value: 'cn-north-1', label: 'China (Beijing)' }
        ],
        assetTypes: [
            { value: 'ec2', label: 'Elastic Compute Cloud' },
            { value: 'rds', label: 'Relational Database Service' },
            { value: 's3', label: 'Simple Storage Service' },
            { value: 'elb', label: 'Elastic Load Balancing' },
            { value: 'vpc', label: 'Virtual Private Cloud' },
            { value: 'eip', label: 'Elastic IP' }
        ],
        features: ['auto_sync', 'cost_monitoring', 'batch_operations']
    },
    azure: {
        id: 'azure',
        name: 'azure',
        displayName: 'Microsoft Azure',
        icon: 'icon-azure',
        color: '#0078d4',
        regions: [
            { value: 'eastus', label: 'East US' },
            { value: 'westus2', label: 'West US 2' },
            { value: 'westeurope', label: 'West Europe' },
            { value: 'southeastasia', label: 'Southeast Asia' },
            { value: 'japaneast', label: 'Japan East' },
            { value: 'chinaeast2', label: 'China East 2' }
        ],
        assetTypes: [
            { value: 'vm', label: 'Virtual Machines' },
            { value: 'sql', label: 'SQL Database' },
            { value: 'storage', label: 'Storage Account' },
            { value: 'lb', label: 'Load Balancer' },
            { value: 'vnet', label: 'Virtual Network' },
            { value: 'pip', label: 'Public IP' }
        ],
        features: ['auto_sync', 'cost_monitoring', 'batch_operations']
    },
    tencent: {
        id: 'tencent',
        name: 'tencent',
        displayName: '腾讯云',
        icon: 'icon-tencent',
        color: '#006eff',
        regions: [
            { value: 'ap-beijing', label: '北京' },
            { value: 'ap-shanghai', label: '上海' },
            { value: 'ap-guangzhou', label: '广州' },
            { value: 'ap-shenzhen', label: '深圳' },
            { value: 'ap-chengdu', label: '成都' },
            { value: 'ap-chongqing', label: '重庆' }
        ],
        assetTypes: [
            { value: 'cvm', label: '云服务器' },
            { value: 'cdb', label: '云数据库MySQL' },
            { value: 'cos', label: '对象存储' },
            { value: 'clb', label: '负载均衡' },
            { value: 'vpc', label: '私有网络' },
            { value: 'eip', label: '弹性公网IP' }
        ],
        features: ['auto_sync', 'cost_monitoring', 'batch_operations']
    },
    huawei: {
        id: 'huawei',
        name: 'huawei',
        displayName: '华为云',
        icon: 'icon-huawei',
        color: '#ff0000',
        regions: [
            { value: 'cn-north-1', label: '华北-北京一' },
            { value: 'cn-north-4', label: '华北-北京四' },
            { value: 'cn-east-2', label: '华东-上海二' },
            { value: 'cn-east-3', label: '华东-上海一' },
            { value: 'cn-south-1', label: '华南-广州' },
            { value: 'cn-southwest-2', label: '西南-贵阳一' }
        ],
        assetTypes: [
            { value: 'ecs', label: '弹性云服务器' },
            { value: 'rds', label: '关系型数据库' },
            { value: 'obs', label: '对象存储服务' },
            { value: 'elb', label: '弹性负载均衡' },
            { value: 'vpc', label: '虚拟私有云' },
            { value: 'eip', label: '弹性公网IP' }
        ],
        features: ['auto_sync', 'batch_operations']
    },
    volcengine: {
        id: 'volcengine',
        name: 'volcengine',
        displayName: '火山引擎',
        icon: 'icon-volcengine',
        color: '#3370ff',
        regions: [
            { value: 'cn-beijing', label: '华北2(北京)' },
            { value: 'cn-shanghai', label: '华东2(上海)' },
            { value: 'cn-guangzhou', label: '华南1(广州)' }
        ],
        assetTypes: [
            { value: 'ecs', label: '云服务器' },
            { value: 'rds', label: '云数据库' },
            { value: 'tos', label: '对象存储' },
            { value: 'clb', label: '负载均衡' },
            { value: 'vpc', label: '私有网络' },
            { value: 'eip', label: '弹性公网IP' }
        ],
        features: ['auto_sync', 'cost_monitoring', 'batch_operations']
    }
}

export const CLOUD_PROVIDERS = Object.values(PROVIDER_CONFIGS).map((config) => ({
    value: config.id,
    label: config.displayName,
    icon: config.icon,
    color: config.color
}))

// ==================== 资产类型常量 ====================

export const ASSET_TYPES = [
    { value: 'compute', label: '计算服务' },
    { value: 'database', label: '数据库服务' },
    { value: 'storage', label: '存储服务' },
    { value: 'network', label: '网络服务' },
    { value: 'security', label: '安全服务' },
    { value: 'monitor', label: '监控服务' }
]

export const ASSET_TYPE_MAPPING: Record<string, string> = {
    ecs: 'compute',
    rds: 'database',
    oss: 'storage',
    slb: 'network',
    vpc: 'network',
    eip: 'network',
    ec2: 'compute',
    s3: 'storage',
    elb: 'network',
    vm: 'compute',
    sql: 'database',
    storage: 'storage',
    lb: 'network',
    vnet: 'network',
    pip: 'network',
    cvm: 'compute',
    cdb: 'database',
    cos: 'storage',
    clb: 'network',
    obs: 'storage'
}

// ==================== 资产状态常量 ====================

export const ASSET_STATUS = [
    { value: 'running', label: '运行中', color: 'success' },
    { value: 'stopped', label: '已停止', color: 'info' },
    { value: 'starting', label: '启动中', color: 'warning' },
    { value: 'stopping', label: '停止中', color: 'warning' },
    { value: 'terminated', label: '已终止', color: 'danger' },
    { value: 'unknown', label: '未知', color: 'info' }
]

// ==================== 环境常量 ====================

export type Environment = 'production' | 'staging' | 'development'

export interface EnvironmentConfig {
    id: Environment
    name: string
    displayName: string
    color: string
    icon: string
    description: string
}

export const ENVIRONMENT_CONFIGS: Record<Environment, EnvironmentConfig> = {
    production: {
        id: 'production',
        name: 'production',
        displayName: '生产环境',
        color: '#f56c6c',
        icon: 'icon-prod',
        description: '正式生产环境，用于对外提供服务'
    },
    staging: {
        id: 'staging',
        name: 'staging',
        displayName: '预发环境',
        color: '#e6a23c',
        icon: 'icon-staging',
        description: '预发布环境，用于上线前的最终测试'
    },
    development: {
        id: 'development',
        name: 'development',
        displayName: '开发环境',
        color: '#67c23a',
        icon: 'icon-dev',
        description: '开发环境，用于日常开发和调试'
    }
}

export const ENVIRONMENT_MAPPING: Record<string, Environment> = {
    dev: 'development',
    test: 'staging',
    prod: 'production',
    development: 'development',
    staging: 'staging',
    production: 'production'
}

export const ENVIRONMENTS = Object.values(ENVIRONMENT_CONFIGS).map((config) => ({
    value: config.id,
    label: config.displayName,
    color: config.color,
    icon: config.icon,
    description: config.description
}))

// ==================== 账号状态常量 ====================

export const ACCOUNT_STATUS = [
    { value: 'active', label: '活跃', color: 'success' },
    { value: 'disabled', label: '禁用', color: 'info' },
    { value: 'error', label: '错误', color: 'danger' }
]

// ==================== 表单验证规则 ====================

export const accountFormRules = {
    name: [
        { required: true, message: '请输入账号名称', trigger: 'blur' },
        { min: 2, max: 50, message: '长度在 2 到 50 个字符', trigger: 'blur' }
    ],
    provider: [{ required: true, message: '请选择云厂商', trigger: 'change' }],
    environment: [{ required: true, message: '请选择环境', trigger: 'change' }],
    access_key_id: [{ required: true, message: '请输入Access Key ID', trigger: 'blur' }],
    access_key_secret: [{ required: true, message: '请输入Access Key Secret', trigger: 'blur' }],
    region: [{ required: true, message: '请输入区域', trigger: 'blur' }]
}

// ==================== 错误码映射 ====================

export const CAM_ERROR_CODES: Record<number, string> = {
    404001: '资产不存在',
    409001: '资产已存在',
    400001: '云厂商不支持',
    400002: '资产类型无效',
    404002: '云账号不存在',
    409002: '云账号已存在',
    400003: '云账号配置无效',
    401001: '云账号认证失败',
    500001: '资产发现失败',
    500002: '云账号连接失败'
}

export function getErrorMessage(code: number): string {
    return CAM_ERROR_CODES[code] || '系统错误'
}

// ==================== 工具函数 ====================

export function getProviderConfig(value: string): ProviderConfig | undefined {
    if (!value) return undefined
    return PROVIDER_CONFIGS[value as CloudProvider]
}

export function getProviderLabel(value: string): string {
    const config = getProviderConfig(value)
    return config?.displayName || value
}

export function getProviderRegions(provider: string): Array<{ value: string; label: string }> {
    const config = getProviderConfig(provider)
    return config?.regions || []
}

export function getProviderAssetTypes(provider: string): Array<{ value: string; label: string }> {
    const config = getProviderConfig(provider)
    return config?.assetTypes || []
}

export function isProviderFeatureSupported(provider: string, feature: string): boolean {
    const config = getProviderConfig(provider)
    return config?.features.includes(feature) || false
}

export function getAssetTypeLabel(value: string, provider?: string): string {
    if (provider) {
        const config = getProviderConfig(provider)
        const assetType = config?.assetTypes.find((t) => t.value === value)
        if (assetType) {
            return assetType.label
        }
    }

    const genericType = ASSET_TYPE_MAPPING[value]
    if (genericType) {
        const assetType = ASSET_TYPES.find((t) => t.value === genericType)
        if (assetType) {
            return assetType.label
        }
    }

    return value
}

export function getAssetTypeCategory(value: string): string {
    return ASSET_TYPE_MAPPING[value] || 'other'
}

export function getAssetStatus(value: string) {
    return ASSET_STATUS.find((s) => s.value === value) || ASSET_STATUS[ASSET_STATUS.length - 1]
}

export function getEnvironmentConfig(value: string): EnvironmentConfig | undefined {
    const mappedValue = ENVIRONMENT_MAPPING[value] || value
    return ENVIRONMENT_CONFIGS[mappedValue as Environment]
}

export function getEnvironmentLabel(value: string): string {
    const config = getEnvironmentConfig(value)
    return config?.displayName || value
}

export function migrateEnvironmentValue(oldValue: string): Environment {
    return (ENVIRONMENT_MAPPING[oldValue] as Environment) || (oldValue as Environment)
}

export function isValidEnvironment(value: string): boolean {
    const mappedValue = ENVIRONMENT_MAPPING[value] || value
    return Object.keys(ENVIRONMENT_CONFIGS).includes(mappedValue)
}

export function getAccountStatus(value: string) {
    return ACCOUNT_STATUS.find((s) => s.value === value) || ACCOUNT_STATUS[ACCOUNT_STATUS.length - 1]
}

// ==================== 租户状态常量 ====================

export const TENANT_STATUS = [
    { value: 'active', label: '活跃', color: 'success' },
    { value: 'inactive', label: '非活跃', color: 'info' },
    { value: 'suspended', label: '暂停', color: 'warning' },
    { value: 'deleted', label: '已删除', color: 'danger' }
]

export function getTenantStatus(value: string) {
    return TENANT_STATUS.find((s) => s.value === value) || TENANT_STATUS[0]
}

// ==================== 行业类型常量 ====================

export const INDUSTRIES = [
    { value: 'technology', label: '科技' },
    { value: 'finance', label: '金融' },
    { value: 'healthcare', label: '医疗' },
    { value: 'education', label: '教育' },
    { value: 'retail', label: '零售' },
    { value: 'manufacturing', label: '制造' },
    { value: 'other', label: '其他' }
]

export function getIndustryLabel(value: string): string {
    const industry = INDUSTRIES.find((i) => i.value === value)
    return industry?.label || value
}

// ==================== 地区类型常量 ====================

export const REGIONS = [
    { value: 'cn-north', label: '华北' },
    { value: 'cn-east', label: '华东' },
    { value: 'cn-south', label: '华南' },
    { value: 'cn-west', label: '华西' },
    { value: 'cn-central', label: '华中' },
    { value: 'overseas', label: '海外' }
]

export function getRegionLabel(value: string): string {
    const region = REGIONS.find((r) => r.value === value)
    return region?.label || value
}

// ==================== IAM 用户类型常量 ====================

export const USER_TYPES = [
    { value: 'api_key', label: 'API Key' },
    { value: 'access_key', label: 'Access Key' },
    { value: 'ram_user', label: 'RAM 用户' },
    { value: 'iam_user', label: 'IAM 用户' }
]

export function getUserTypeLabel(value: string): string {
    const userType = USER_TYPES.find((t) => t.value === value)
    return userType?.label || value
}

// ==================== IAM 用户状态常量 ====================

export const USER_STATUS = [
    { value: 'active', label: '活跃', color: 'success' },
    { value: 'inactive', label: '未激活', color: 'info' },
    { value: 'deleted', label: '已删除', color: 'danger' }
]

export function getUserStatus(value: string) {
    return USER_STATUS.find((s) => s.value === value) || USER_STATUS[USER_STATUS.length - 1]
}

// ==================== 策略模板分类常量 ====================

export const TEMPLATE_CATEGORIES = [
    { value: 'read_only', label: '只读权限', description: '仅允许查看资源，不能进行修改操作' },
    { value: 'admin', label: '管理员权限', description: '拥有完整的管理权限，可以进行所有操作' },
    { value: 'developer', label: '开发者权限', description: '适合开发人员的权限配置' },
    { value: 'custom', label: '自定义', description: '根据需求自定义的权限配置' }
]

export function getTemplateCategoryLabel(value: string): string {
    const category = TEMPLATE_CATEGORIES.find((c) => c.value === value)
    return category?.label || value
}

export function getTemplateCategoryDescription(value: string): string {
    const category = TEMPLATE_CATEGORIES.find((c) => c.value === value)
    return category?.description || ''
}

// ==================== 同步任务类型常量 ====================

export const SYNC_TASK_TYPES = [
    { value: 'user_sync', label: '用户同步', icon: 'User' },
    { value: 'permission_sync', label: '权限同步', icon: 'Lock' },
    { value: 'group_sync', label: '用户组同步', icon: 'UserFilled' }
]

export function getSyncTaskTypeLabel(value: string): string {
    const taskType = SYNC_TASK_TYPES.find((t) => t.value === value)
    return taskType?.label || value
}

// ==================== 同步任务状态常量 ====================

export const SYNC_TASK_STATUS = [
    { value: 'pending', label: '等待中', color: 'info' },
    { value: 'running', label: '执行中', color: 'warning' },
    { value: 'completed', label: '已完成', color: 'success' },
    { value: 'failed', label: '失败', color: 'danger' }
]

export function getSyncTaskStatus(value: string) {
    return SYNC_TASK_STATUS.find((s) => s.value === value) || SYNC_TASK_STATUS[SYNC_TASK_STATUS.length - 1]
}

export function getSyncTaskStatusLabel(value: string): string {
    const status = getSyncTaskStatus(value)
    return status.label
}

export function getSyncTaskStatusColor(value: string): string {
    const status = getSyncTaskStatus(value)
    return status.color
}

// ==================== 操作类型常量 ====================

export const OPERATION_TYPES = [
    { value: 'create', label: '创建', color: 'success' },
    { value: 'update', label: '更新', color: 'primary' },
    { value: 'delete', label: '删除', color: 'danger' },
    { value: 'sync', label: '同步', color: 'warning' },
    { value: 'assign', label: '分配', color: 'success' },
    { value: 'revoke', label: '撤销', color: 'warning' }
]

export function getOperationTypeLabel(value: string): string {
    const operationType = OPERATION_TYPES.find((t) => t.value === value)
    return operationType?.label || value
}

export function getOperationTypeColor(value: string): string {
    const operationType = OPERATION_TYPES.find((t) => t.value === value)
    return operationType?.color || 'info'
}

// ==================== 目标类型常量 ====================

export const TARGET_TYPES = [
    { value: 'user', label: '用户' },
    { value: 'group', label: '用户组' },
    { value: 'template', label: '策略模板' },
    { value: 'policy', label: '权限策略' }
]

export function getTargetTypeLabel(value: string): string {
    const targetType = TARGET_TYPES.find((t) => t.value === value)
    return targetType?.label || value
}

// ==================== IAM 错误码映射 ====================

export const IAM_ERROR_CODES: Record<number, string> = {
    // 用户相关错误
    404101: '用户不存在',
    409101: '用户名已存在',
    400101: '用户类型无效',
    401101: '用户认证失败',

    // 用户组相关错误
    404201: '用户组不存在',
    409201: '用户组名称已存在',
    400201: '权限策略无效',

    // 策略模板相关错误
    404301: '策略模板不存在',
    409301: '模板名称已存在',
    400301: '模板分类无效',
    403301: '不能修改内置模板',

    // 同步任务相关错误
    404401: '同步任务不存在',
    400401: '任务类型无效',
    409401: '任务正在执行中',

    // 审计日志相关错误
    400501: '时间范围无效',
    400502: '导出格式不支持'
}

export function getIAMErrorMessage(code: number): string {
    return IAM_ERROR_CODES[code] || getErrorMessage(code)
}
