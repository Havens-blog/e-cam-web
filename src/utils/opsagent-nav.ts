/**
 * 运维 Agent 功能域一级菜单注册（任务 5.1 路由 + 侧边导航集成）。
 *
 * 从 MainLayout 抽出的纯数据：分组顺序/目标/图标按
 * docs/features/haven-opsagent/design/page-map.md 的 Page Overview
 * 落地，可被单测直接回归（同 cert-nav.ts 的纯函数约定）。
 *
 * - 分组：核心 → 数据视图 → 管理（page-map「核心 / 数据视图 / 管理」三组）
 * - 目标：Page Overview 表 P1 页中的 5 个菜单可见页；诊断详情
 *   （/opsagent/diagnosis/:id）经风险中心/对话进入、不进菜单；
 *   RCA 分析页为 P2 预留、P1 导航不挂载（Implementation Notes）。
 * - 图标：iconfont 线性图标，类名需存在于 public/iconfont/iconfont.css
 *   （原型 app.js 的 lucide 仅为视觉参考，落地统一用 iconfont 图标体系）
 */

/** 菜单项（MainLayout MenuItem 的结构子集，多余字段由布局层补充） */
export interface OpsagentMenuItem {
    key: string
    title: string
    icon: string
    path?: string
    children?: OpsagentMenuItem[]
}

/** 运维 Agent 功能域一级菜单项（分组顺序即渲染顺序） */
export const OPSAGENT_MENU_ITEMS: readonly OpsagentMenuItem[] = [
    {
        key: 'opsagent-core',
        title: '核心',
        icon: 'ops-oneterm-dashboard',
        children: [
            { key: 'opsagent-chat', path: '/opsagent/chat', title: '对话排障', icon: 'icon-xianxing-xiaoxi' },
            { key: 'opsagent-risk-center', path: '/opsagent/risk-center', title: '风险中心', icon: 'icon-xianxing-baojing' },
        ],
    },
    {
        key: 'opsagent-data',
        title: '数据视图',
        icon: 'icon-xianxing-tiaoxingtu',
        children: [
            { key: 'opsagent-history', path: '/opsagent/history', title: '历史回溯', icon: 'ops-history' },
        ],
    },
    {
        key: 'opsagent-admin',
        title: '管理',
        icon: 'ops-admin',
        children: [
            { key: 'opsagent-agents', path: '/opsagent/agents', title: 'Agent 管理', icon: 'icon-xianxing-yingyong' },
            { key: 'opsagent-settings', path: '/opsagent/settings', title: '系统配置', icon: 'ops-setting-system' },
        ],
    },
]