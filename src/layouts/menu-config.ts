/**
 * 侧边栏菜单配置（自 src/layouts/MainLayout.vue 抽出）。
 *
 * 【为什么独立成模块】
 * 拆分后这份菜单树有两个消费方：AppSidebar.vue 渲染整棵树，TopNavBar.vue 依据
 * route.path 反查面包屑。若把它留在 MainLayout.vue，父组件就必须向两个子组件分别
 * 透传，父组件无法真正变薄。故抽成独立模块，由两个子组件各自 import。
 *
 * 【与原文的等价性说明】
 * 原文是 `const menuGroups = ref<MenuGroup[]>([...])`。经核查，`menuGroups` 在原
 * MainLayout.vue 中**只被读取、从无 mutation**（读取点：visibleMenuGroups 的 map、
 * activeMenuKey 的遍历、breadcrumbs 的遍历）。故此处导出为普通常量数组而非 ref——
 * 对上述所有读取路径语义完全一致，且少一层无意义的响应式包装。
 *
 * 本文件只含类型与纯数据：无副作用、无 Vue 运行时依赖（唯一 import 是证书菜单项常量）。
 */
import { CERT_MENU_ITEMS } from '@/utils/cert-nav'

export interface MenuItem {
  key: string
  title: string
  icon?: string
  path?: string
  children?: MenuItem[]
  /** true = 仅管理员可见（useUserStore.isAdmin）。路由本身不做硬守卫。 */
  requireAdmin?: boolean
  /**
   * true = 需证书管理权限（非只读查看者）可见（任务 6.1）。
   * 只读查看者仅见"到期看板"；对应路由由全局守卫按 certManageOnly 拦截。
   */
  requireCertManage?: boolean
}

export interface MenuGroup {
  title: string
  items: MenuItem[]
}

// 菜单配置 — 4 大分组，统一 ops-* 线性图标风格
export const menuGroups: MenuGroup[] = [
  {
    title: '概览',
    items: [
      { key: 'dashboard', path: '/dashboard', title: '仪表盘', icon: 'ops-oneterm-dashboard' },
      { key: 'cloud-logs', path: '/logs', title: '日志查询', icon: 'ops-itsm-logs' },
    ]
  },
  {
    title: '资源',
    items: [
      {
        key: 'assets',
        title: '资产列表',
        icon: 'icon-xianxing-xuniji',
        children: [
          {
            key: 'assets-host',
            title: '主机',
            icon: 'caise-computer',
            children: [
              { key: 'assets-vm', path: '/compute/ecs', title: '虚拟机' },
              { key: 'assets-template', path: '/compute/template', title: '主机模板' },
              { key: 'assets-disk', path: '/compute/disk', title: '云盘' },
              { key: 'assets-snapshot', path: '/compute/snapshot', title: '快照' },
              { key: 'assets-security-group', path: '/compute/security-group', title: '安全组' },
              { key: 'assets-image', path: '/compute/image', title: '镜像管理' },
            ]
          },
          {
            key: 'assets-storage',
            title: '存储',
            icon: 'caise-storage_device',
            children: [
              { key: 'assets-nas', path: '/storage/nas', title: '文件存储 NAS' },
              { key: 'assets-oss', path: '/storage/oss', title: '对象存储 OSS' },
            ]
          },
          {
            key: 'assets-network',
            title: '网络',
            icon: 'caise-network_devices',
            children: [
              { key: 'assets-vpc', path: '/network/vpc', title: 'VPC' },
              { key: 'assets-eip', path: '/network/eip', title: '弹性公网IP' },
              { key: 'assets-vswitch', path: '/network/vswitch', title: '交换机' },
              { key: 'assets-lb', path: '/network/lb', title: '负载均衡' },
              { key: 'assets-cdn', path: '/network/cdn', title: 'CDN 加速' },
              { key: 'assets-waf', path: '/network/waf', title: 'WAF 防火墙' },
              { key: 'assets-ddos', path: '/network/ddos', title: 'DDoS 防护' },
              { key: 'assets-eni', path: '/network/eni', title: '弹性网卡' },
              { key: 'assets-dns', path: '/network/dns', title: 'DNS 管理' },
            ]
          },
          {
            key: 'assets-database',
            title: '数据库',
            icon: 'caise-database',
            children: [
              { key: 'assets-rds', path: '/databases/rds', title: 'RDS 云数据库' },
              { key: 'assets-redis', path: '/databases/redis', title: 'Redis' },
              { key: 'assets-mongodb', path: '/databases/mongodb', title: 'MongoDB' },
            ]
          },
          {
            key: 'assets-middleware',
            title: '中间件',
            icon: 'caise-middleware',
            children: [
              { key: 'assets-kafka', path: '/middleware/kafka', title: 'Kafka' },
              { key: 'assets-elasticsearch', path: '/middleware/elasticsearch', title: 'Elasticsearch' },
            ]
          },
          {
            key: 'assets-service',
            title: '容器服务',
            icon: 'caise-virtualization',
          },
        ]
      },
      {
        // 服务树已随 CMDB 迁移到独立应用 e-cmdb-web（nginx /cmdb/）。
        // 这里用 `/cmdb/` 前缀：AppSidebar 经 resolveMenuTarget 判定为**跨应用**，
        // 新窗口打开并自动带上 ?tenant_id=（e-cmdb-web 路由守卫要求），
        // 不再产生"有菜单项但本仓无对应路由"的死链。
        key: 'service-tree',
        title: '服务树',
        icon: 'icon-xianxing-yingyong',
        children: [
          { key: 'service-tree-main', path: '/cmdb/service-tree', title: '服务树总览', icon: 'icon-xianxing-yingyong' },
          { key: 'service-tree-envs', path: '/cmdb/service-tree/environments', title: '环境管理', icon: 'icon-xianxing-chanpin' },
          { key: 'service-tree-rules', path: '/cmdb/service-tree/rules', title: '绑定规则', icon: 'icon-xianxing-luyouqi' },
        ]
      },
      { key: 'tasks', path: '/tasks', title: '任务管理', icon: 'icon-xianxing-bumen' },
      { key: 'resource-tags', path: '/resource/tags', title: '标签管理', icon: 'icon-xianxing-chanpin' },
    ]
  },
  {
    // 证书管理功能域（任务 6.1）：只读查看者仅见"到期看板"，
    // 台账/变更管理按 requireCertManage 过滤；详情/配置不经菜单。
    title: '证书管理',
    items: [...CERT_MENU_ITEMS]
  },
  {
    title: 'FinOps',
    items: [
      { key: 'finops-cost', path: '/finops/cost', title: '成本概览', icon: 'ops-oneterm-dashboard' },
      { key: 'finops-allocation', path: '/finops/allocation', title: '成本分摊', icon: 'icon-xianxing-bumen' },
      { key: 'finops-budget', path: '/finops/budget', title: '预算管理', icon: 'icon-xianxing-chanpin' },
      { key: 'finops-anomaly', path: '/finops/anomaly', title: '异常与优化', icon: 'ops-itsm-logs' },
      { key: 'finops-collect', path: '/finops/collect', title: '采集管理', icon: 'icon-xianxing-yingyong' },
    ]
  },
  {
    title: '平台管理',
    items: [
      { key: 'audit-logs', path: '/audit/logs', title: '操作审计', icon: 'ops-itsm-logs' },
      { key: 'audit-changes', path: '/audit/changes', title: '变更历史', icon: 'icon-xianxing-chanpin' },
      { key: 'accounts', path: '/accounts', title: '云账号管理', icon: 'icon-xianxing-aliyun' },
      { key: 'data-dictionary', path: '/system/dictionary', title: '数据字典', icon: 'icon-xianxing-chanpin' },
      {
        key: 'security',
        title: '用户与权限',
        icon: 'ops-oneterm-authorization',
        children: [
          { key: 'users', path: '/iam/users', title: '云账号用户', icon: 'ops-oneterm-authorization' },
          { key: 'groups', path: '/iam/groups', title: '用户组管理', icon: 'icon-xianxing-bumen' },
          { key: 'templates', path: '/iam/templates', title: '策略模板', icon: 'icon-xianxing-chanpin' },
          { key: 'iam-compare', path: '/iam/compare', title: 'IAM 对比', icon: 'ops-oneterm-authorization' },
        ]
      },
    ]
  },
]
