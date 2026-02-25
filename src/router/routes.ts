import type { RouteRecordRaw } from 'vue-router'

/**
 * 路由配置
 * 使用 base: '/cam/' 配置，所以路由路径不需要 /cam 前缀
 * 使用懒加载优化首屏加载性能
 */
const routes: RouteRecordRaw[] = [
    {
        path: '/',
        component: () => import('@/layouts/MainLayout.vue'),
        redirect: '/dashboard',
        children: [
            {
                path: '/dashboard',
                name: 'Dashboard',
                component: () => import('@/views/dashboard/index.vue'),
                meta: {
                    title: '多云概览',
                    icon: 'monitor-dashboard',
                },
            },
            {
                path: '/accounts',
                name: 'Accounts',
                component: () => import('@/views/accounts/index.vue'),
                meta: {
                    title: '云账号管理',
                    icon: 'ops-oneterm-asset-management',
                },
            },
            {
                path: '/accounts/create',
                name: 'AccountCreate',
                component: () => import('@/views/accounts/form.vue'),
                meta: {
                    title: '添加云账号',
                    icon: 'Plus',
                    hideInMenu: true,
                },
            },
            {
                path: '/accounts/:id/edit',
                name: 'AccountEdit',
                component: () => import('@/views/accounts/form.vue'),
                meta: {
                    title: '编辑云账号',
                    icon: 'Edit',
                    hideInMenu: true,
                },
            },
            {
                path: '/assets',
                name: 'Assets',
                component: () => import('@/views/assets/index.vue'),
                meta: {
                    title: '资产管理',
                    icon: 'caise-public_cloud',
                },
            },
            {
                path: '/assets/instances/:uid',
                name: 'AssetInstances',
                component: () => import('@/views/cmdb/instances/index.vue'),
                meta: {
                    title: '资产实例',
                    icon: 'Box',
                    hideInMenu: true,
                },
            },
            {
                path: '/assets/:id',
                name: 'AssetDetail',
                component: () => import('@/views/assets/detail.vue'),
                meta: {
                    title: '资产详情',
                    icon: 'Document',
                    hideInMenu: true,
                },
            },
            {
                path: '/cost',
                name: 'Cost',
                component: () => import('@/views/cost/index.vue'),
                meta: {
                    title: '成本分析',
                    icon: 'monitor-healing',
                },
            },
            {
                path: '/tasks',
                name: 'Tasks',
                component: () => import('@/views/tasks/index.vue'),
                meta: {
                    title: '任务管理',
                    icon: 'quick_commands',
                },
            },
            {
                path: '/tasks/:id',
                name: 'TaskDetail',
                component: () => import('@/views/tasks/detail.vue'),
                meta: {
                    title: '任务详情',
                    icon: 'Document',
                    hideInMenu: true,
                },
            },
            // ==================== IAM 管理路由 ====================
            {
                path: '/iam',
                redirect: '/iam/tenants',
            },
            {
                path: '/iam/tenants',
                name: 'IAMTenants',
                component: () => import('@/views/iam/tenants/index.vue'),
                meta: {
                    title: '租户管理',
                    icon: 'office-building',
                },
            },
            {
                path: '/iam/users',
                name: 'IAMUsers',
                component: () => import('@/views/iam/users/index.vue'),
                meta: {
                    title: '用户管理',
                    icon: 'ops-oneterm-authorization',
                },
            },
            {
                path: '/iam/users/:id',
                name: 'IAMUserDetail',
                component: () => import('@/views/iam/users/detail.vue'),
                meta: {
                    title: '用户详情',
                    icon: 'Document',
                    hideInMenu: true,
                },
            },
            {
                path: '/iam/groups',
                name: 'IAMGroups',
                component: () => import('@/views/iam/groups/index.vue'),
                meta: {
                    title: '用户组管理',
                    icon: 'ops-oneterm-access_period',
                },
            },
            {
                path: '/iam/groups/:id',
                name: 'IAMGroupDetail',
                component: () => import('@/views/iam/groups/detail.vue'),
                meta: {
                    title: '用户组详情',
                    icon: 'Document',
                    hideInMenu: true,
                },
            },
            {
                path: '/iam/templates',
                name: 'IAMTemplates',
                component: () => import('@/views/iam/templates/index.vue'),
                meta: {
                    title: '策略模板管理',
                    icon: 'file',
                },
            },
            {
                path: '/iam/templates/:id',
                name: 'IAMTemplateDetail',
                component: () => import('@/views/iam/templates/detail.vue'),
                meta: {
                    title: '模板详情',
                    icon: 'Document',
                    hideInMenu: true,
                },
            },
            {
                path: '/iam/audit',
                name: 'IAMAudit',
                component: () => import('@/views/iam/audit/index.vue'),
                meta: {
                    title: '审计日志',
                    icon: 'ops-oneterm-file_log',
                },
            },
            {
                path: '/iam/sync',
                name: 'IAMSync',
                component: () => import('@/views/iam/sync/index.vue'),
                meta: {
                    title: '同步任务',
                    icon: 'oneterm-batch_execution',
                },
            },
            {
                path: '/iam/sync/:id',
                name: 'IAMSyncDetail',
                component: () => import('@/views/iam/sync/detail.vue'),
                meta: {
                    title: '任务详情',
                    icon: 'Document',
                    hideInMenu: true,
                },
            },
            // ==================== CMDB 管理路由 ====================
            {
                path: '/cmdb',
                redirect: '/cmdb/models',
            },
            {
                path: '/cmdb/models',
                name: 'CmdbModels',
                component: () => import('@/views/cmdb/models/index.vue'),
                meta: {
                    title: '资源模型',
                    icon: 'Grid',
                },
            },
            {
                path: '/cmdb/instances',
                name: 'CmdbInstances',
                component: () => import('@/views/cmdb/instances/index.vue'),
                meta: {
                    title: '资源实例',
                    icon: 'Box',
                },
            },
            {
                path: '/cmdb/relations',
                name: 'CmdbRelations',
                component: () => import('@/views/cmdb/relations/index.vue'),
                meta: {
                    title: '模型关系',
                    icon: 'Connection',
                },
            },
            {
                path: '/cmdb/topology',
                name: 'CmdbTopology',
                component: () => import('@/views/cmdb/topology/index.vue'),
                meta: {
                    title: '拓扑视图',
                    icon: 'Share',
                },
            },
            // ==================== 服务树路由 ====================
            {
                path: '/service-tree',
                name: 'ServiceTree',
                component: () => import('@/views/service-tree/index.vue'),
                meta: {
                    title: '服务树',
                    icon: 'Connection',
                },
            },
            {
                path: '/service-tree/environments',
                name: 'ServiceTreeEnvironments',
                component: () => import('@/views/service-tree/environments/index.vue'),
                meta: {
                    title: '环境管理',
                    icon: 'Setting',
                },
            },
            {
                path: '/service-tree/rules',
                name: 'ServiceTreeRules',
                component: () => import('@/views/service-tree/rules/index.vue'),
                meta: {
                    title: '绑定规则',
                    icon: 'List',
                },
            },
            // ==================== 数据库管理路由 ====================
            {
                path: '/databases',
                redirect: '/databases/rds',
            },
            {
                path: '/databases/rds',
                name: 'DatabasesRDS',
                component: () => import('@/views/databases/rds/index.vue'),
                meta: {
                    title: 'RDS 云数据库',
                    icon: 'Coin',
                },
            },
            {
                path: '/databases/redis',
                name: 'DatabasesRedis',
                component: () => import('@/views/databases/redis/index.vue'),
                meta: {
                    title: 'Redis 云数据库',
                    icon: 'Coin',
                },
            },
            {
                path: '/databases/mongodb',
                name: 'DatabasesMongoDB',
                component: () => import('@/views/databases/mongodb/index.vue'),
                meta: {
                    title: 'MongoDB 云数据库',
                    icon: 'Coin',
                },
            },
            // ==================== ECS 虚拟机路由 ====================

            {
                path: '/compute/ecs',
                name: 'ComputeECS',
                component: () => import('@/views/compute/ecs/index.vue'),
                meta: {
                    title: '虚拟机',
                    icon: 'Monitor',
                },
            },
            {
                path: '/compute/disk',
                name: 'ComputeDisk',
                component: () => import('@/views/compute/disk/index.vue'),
                meta: {
                    title: '云盘',
                    icon: 'Coin',
                },
            },
            {
                path: '/compute/snapshot',
                name: 'ComputeSnapshot',
                component: () => import('@/views/compute/snapshot/index.vue'),
                meta: {
                    title: '快照',
                    icon: 'Camera',
                },
            },
            {
                path: '/compute/security-group',
                name: 'ComputeSecurityGroup',
                component: () => import('@/views/compute/security-group/index.vue'),
                meta: {
                    title: '安全组',
                    icon: 'Lock',
                },
            },
            // ==================== 告警中心路由 ====================
            {
                path: '/alert',
                redirect: '/alert/events',
            },
            {
                path: '/alert/events',
                name: 'AlertEvents',
                component: () => import('@/views/alert/events/index.vue'),
                meta: {
                    title: '告警事件',
                    icon: 'Bell',
                },
            },
            {
                path: '/alert/rules',
                name: 'AlertRules',
                component: () => import('@/views/alert/rules/index.vue'),
                meta: {
                    title: '告警规则',
                    icon: 'List',
                },
            },
            {
                path: '/alert/channels',
                name: 'AlertChannels',
                component: () => import('@/views/alert/channels/index.vue'),
                meta: {
                    title: '通知渠道',
                    icon: 'ChatDotRound',
                },
            },
            // ==================== 网络管理路由 ====================
            {
                path: '/network/vpc',
                name: 'VPC',
                component: () => import('@/views/network/vpc/index.vue'),
                meta: {
                    title: 'VPC',
                    icon: 'Connection',
                },
            },
            {
                path: '/network/eip',
                name: 'EIP',
                component: () => import('@/views/network/eip/index.vue'),
                meta: {
                    title: '弹性公网IP',
                    icon: 'Position',
                },
            },
            // ==================== 存储管理路由 ====================
            {
                path: '/storage/nas',
                name: 'NAS',
                component: () => import('@/views/storage/nas/index.vue'),
                meta: {
                    title: '文件存储 NAS',
                    icon: 'FolderOpened',
                },
            },
            {
                path: '/storage/oss',
                name: 'OSS',
                component: () => import('@/views/storage/oss/index.vue'),
                meta: {
                    title: '对象存储 OSS',
                    icon: 'Folder',
                },
            },
            // ==================== 中间件管理路由 ====================
            {
                path: '/middleware/kafka',
                name: 'Kafka',
                component: () => import('@/views/middleware/kafka/index.vue'),
                meta: {
                    title: 'Kafka 消息队列',
                    icon: 'Message',
                },
            },
            {
                path: '/middleware/elasticsearch',
                name: 'Elasticsearch',
                component: () => import('@/views/middleware/elasticsearch/index.vue'),
                meta: {
                    title: 'Elasticsearch',
                    icon: 'Search',
                },
            },
        ],
    },
    {
        path: '/:pathMatch(.*)*',
        name: 'NotFound',
        component: () => import('@/views/error/404.vue'),
        meta: {
            title: '页面不存在',
            hideInMenu: true,
        },
    },
]

export default routes
