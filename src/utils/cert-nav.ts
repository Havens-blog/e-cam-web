/**
 * 证书管理功能域一级菜单注册（任务 6.7 页面装配）。
 *
 * 从 MainLayout 抽出的纯数据：菜单顺序/目标/只读可见性按
 * prd-ui-functions Primary Navigation 落地，可被单测直接回归
 * （同 cert-permission.ts 的纯函数约定）。
 *
 * - 顺序：证书台账 → 到期看板 → 变更管理（prd-ui-functions Primary Navigation）
 * - 目标：Page Composition 表三个一级页（/certs · /certs/dashboard · /certs/changes）
 * - 可见性：台账/变更管理 requireCertManage（只读查看者仅见"到期看板"，
 *   MainLayout 渲染层按 certManageAccess 过滤）；到期看板对全角色开放
 * - 图标：iconfont 线性图标（certificate/clock-alert/swap 语义对应
 *   已认证/报警/切换），类名需存在于 public/iconfont/iconfont.css
 */

/** 一级菜单项（MainLayout MenuItem 的结构子集，多余字段由布局层补充） */
export interface CertMenuItem {
    key: string
    title: string
    icon: string
    path: string
    /** true = 需证书管理权限（非只读查看者）可见 */
    requireCertManage?: boolean
}

/** 证书管理功能域三个一级菜单项（顺序即渲染顺序） */
export const CERT_MENU_ITEMS: readonly CertMenuItem[] = [
    { key: 'cert-ledger', path: '/certs', title: '证书台账', icon: 'icon-xianxing-yirenzheng', requireCertManage: true },
    { key: 'cert-dashboard', path: '/certs/dashboard', title: '到期看板', icon: 'icon-xianxing-baojing' },
    { key: 'cert-changes', path: '/certs/changes', title: '变更管理', icon: 'icon-xianxing-qiehuanyonghu', requireCertManage: true },
]
