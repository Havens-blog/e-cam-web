/**
 * 应用配置
 */

/**
 * 应用基础配置
 */
export const appConfig = {
    // 应用标题
    title: import.meta.env.VITE_APP_TITLE || 'CAM 多云资产管理',

    // 应用版本
    version: '1.0.0',

    // 应用描述
    description: '统一管理多云环境下的资源',
}

/**
 * API 配置
 */
export const apiConfig = {
    // API 基础 URL
    baseURL: import.meta.env.VITE_API_BASE_URL || '/api',

    // 请求超时时间（毫秒）
    timeout: 30000,

    // 是否使用 Mock 数据
    useMock: import.meta.env.VITE_USE_MOCK === 'true',
}

/**
 * 开发服务器配置
 */
export const devConfig = {
    // 开发服务器端口
    port: Number(import.meta.env.VITE_PORT) || 5173,

    // 是否自动打开浏览器
    open: true,

    // 是否启用 HTTPS
    https: false,
}

/**
 * 路由配置
 */
export const routerConfig = {
    // 路由模式
    mode: 'history',

    // 基础路径
    base: import.meta.env.BASE_URL || '/',

    // 是否启用路由懒加载
    lazy: true,
}

/**
 * 存储配置
 */
export const storageConfig = {
    // localStorage 前缀
    localPrefix: 'cam_',

    // sessionStorage 前缀
    sessionPrefix: 'cam_session_',

    // 过期时间（天）
    expire: 7,
}

/**
 * 分页配置
 */
export const paginationConfig = {
    // 默认每页条数
    pageSize: 20,

    // 每页条数选项
    pageSizes: [10, 20, 50, 100],

    // 布局
    layout: 'total, sizes, prev, pager, next, jumper',
}

/**
 * 表格配置
 */
export const tableConfig = {
    // 默认高度
    height: 'auto',

    // 是否显示边框
    border: true,

    // 是否显示斑马纹
    stripe: true,

    // 尺寸
    size: 'default',
}

/**
 * 上传配置
 */
export const uploadConfig = {
    // 上传地址
    action: `${apiConfig.baseURL}/upload`,

    // 允许的文件类型
    accept: '.jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.xls,.xlsx',

    // 最大文件大小（MB）
    maxSize: 10,

    // 最大上传数量
    limit: 5,
}

/**
 * 导出所有配置
 */
export default {
    app: appConfig,
    api: apiConfig,
    dev: devConfig,
    router: routerConfig,
    storage: storageConfig,
    pagination: paginationConfig,
    table: tableConfig,
    upload: uploadConfig,
}
