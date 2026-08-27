import { describe, expect, it } from 'vitest'
import {
    SCAN_SESSION_MAX_AGE_MS,
    blindSpotNotice,
    changeStatusMeta,
    clearScanSession,
    coverageSummary,
    filterChangeOrders,
    filterForwardGroups,
    forwardFilterOptions,
    groupLabel,
    isK8sCloud,
    isScanComplete,
    loadScanSession,
    noRefsNotice,
    parseScanConflict,
    relativeTime,
    resolveReverseState,
    resourceIdLines,
    saveScanSession,
    scanStale,
    splitScopedResourceId,
    validityConsumedPercent,
} from './format'

// ==================== AC1：要素���展示逻辑 ====================

describe('validityConsumedPercent（有效期进度条：已消耗百分比，AC1）', () => {
    it('按 notBefore~notAfter 区间计算当前消耗比例', () => {
        const now = new Date('2026-08-19T00:00:00Z')
        // 90 天窗口已消耗 45 天 → 50%
        expect(
            validityConsumedPercent('2026-07-05T00:00:00Z', '2026-10-03T00:00:00Z', now),
        ).toBe(50)
    })

    it('钳制 0~100（过期后 100%，窗口开始前 0%）', () => {
        const now = new Date('2026-08-19T00:00:00Z')
        expect(validityConsumedPercent('2026-01-01T00:00:00Z', '2026-02-01T00:00:00Z', now)).toBe(100)
        expect(validityConsumedPercent('2026-12-01T00:00:00Z', '2027-01-01T00:00:00Z', now)).toBe(0)
    })

    it('非法日期 / 空区间 → 0（不渲染误导进度）', () => {
        expect(validityConsumedPercent('not-a-date', '2026-10-03T00:00:00Z')).toBe(0)
        expect(validityConsumedPercent('2026-08-01T00:00:00Z', '2026-08-01T00:00:00Z')).toBe(0)
        expect(validityConsumedPercent('', '')).toBe(0)
    })
})

describe('changeStatusMeta（变更单状态徽章 9 态：全局模式色映射 + 非色觉通道，AC1）', () => {
    it('草稿/待确认=secondary，执行中=accent，验证中=verifying 紫', () => {
        expect(changeStatusMeta('draft')).toMatchObject({ label: '草稿', tone: 'secondary' })
        expect(changeStatusMeta('pending_confirm')).toMatchObject({ label: '待确认', tone: 'secondary' })
        expect(changeStatusMeta('executing')).toMatchObject({ label: '执行中', tone: 'accent', spinner: true })
        expect(changeStatusMeta('verifying')).toMatchObject({ label: '验证中', tone: 'verifying' })
    })

    it('已完成=success ✓，部分完成=warning，已回滚=secondary，回滚失败=error ⚠，已取消=secondary', () => {
        expect(changeStatusMeta('completed')).toMatchObject({ label: '已完成', tone: 'success', icon: '✓' })
        expect(changeStatusMeta('partial_completed')).toMatchObject({ label: '部分完成', tone: 'warning' })
        expect(changeStatusMeta('rolled_back')).toMatchObject({ label: '已回滚', tone: 'secondary' })
        expect(changeStatusMeta('rollback_failed')).toMatchObject({ label: '回滚失败', tone: 'error', icon: '⚠' })
        expect(changeStatusMeta('cancelled')).toMatchObject({ label: '已取消', tone: 'secondary' })
    })

    it('未知状态回退 secondary + 原文标签', () => {
        expect(changeStatusMeta('weird_state')).toEqual(
            expect.objectContaining({ label: 'weird_state', tone: 'secondary' }),
        )
    })
})

describe('filterChangeOrders（关联变更历史：按当前证书过滤 + 倒序，AC1）', () => {
    const cert = { id: 'cert-001', fingerprint: 'aa…ff' }
    const orders = [
        { id: 'a', oldFingerprint: 'other', newCertId: 'other', createdAt: '2026-05-14T00:00:00Z' },
        { id: 'b', oldFingerprint: 'aa…ff', newCertId: 'cert-002', createdAt: '2026-08-01T00:00:00Z' },
        { id: 'c', oldFingerprint: 'bb…ee', newCertId: 'cert-001', createdAt: '2026-08-10T00:00:00Z' },
        { id: 'd', oldFingerprint: 'aa…ff', newCertId: 'cert-003', createdAt: '2026-07-01T00:00:00Z' },
    ]

    it('旧证书指纹或新证书 ID 命中当前证书即关联（新旧两侧都算）', () => {
        const got = filterChangeOrders(orders, cert)
        expect(got.map((o) => o.id)).toEqual(['c', 'b', 'd'])
    })

    it('结果按 createdAt 倒序（最新在前）', () => {
        const got = filterChangeOrders(orders, cert)
        for (let i = 1; i < got.length; i++) {
            expect(Date.parse(got[i - 1]!.createdAt)).toBeGreaterThanOrEqual(Date.parse(got[i]!.createdAt))
        }
    })

    it('无关联单 → 空数组（渲染「暂无关联变更单」）', () => {
        expect(filterChangeOrders(orders, { id: 'none', fingerprint: 'none' })).toEqual([])
    })
})

// ==================== AC2：扫描元数据行 ====================

describe('relativeTime（最近扫描相对时间：刚刚/N 分钟前/Nh 前/N 天前，AC2）', () => {
    const now = new Date('2026-08-19T12:00:00Z')

    it('null / 非法 → 尚未扫描（blind_spot 区分依据）', () => {
        expect(relativeTime(null, now)).toBe('尚未扫描')
        expect(relativeTime(undefined, now)).toBe('尚未扫描')
        expect(relativeTime('bad', now)).toBe('尚未扫描')
    })

    it('分级格式与原型一致（2h 前 / 5 分钟前 / 3 天前 / 刚刚）', () => {
        expect(relativeTime('2026-08-19T11:59:40Z', now)).toBe('刚刚')
        expect(relativeTime('2026-08-19T11:55:00Z', now)).toBe('5 分钟前')
        expect(relativeTime('2026-08-19T10:00:00Z', now)).toBe('2h 前')
        expect(relativeTime('2026-08-16T12:00:00Z', now)).toBe('3 天前')
    })
})

describe('scanStale（扫描超期：元数据行变 Warning 的判定，AC2）', () => {
    const now = new Date('2026-08-19T12:00:00Z')

    it('从未扫描 → 超期（true）', () => {
        expect(scanStale(null, now)).toBe(true)
    })

    it('阈值内 → 新鲜；超阈值 → 超期', () => {
        expect(scanStale('2026-08-19T10:00:00Z', now)).toBe(false)
        expect(scanStale('2026-08-18T11:00:00Z', now)).toBe(true)
    })

    it('支持自定义阈值（服务端 thresholds.scanFreshnessHours 口径）', () => {
        // 扫描于 08:00，now=12:00 → 已过 4h：阈值 5h 新鲜、阈值 3h 超期
        expect(scanStale('2026-08-19T08:00:00Z', now, 5)).toBe(false)
        expect(scanStale('2026-08-19T08:00:00Z', now, 3)).toBe(true)
    })
})

describe('coverageSummary（各云覆盖率：total=-1 显示「分母不可用」不显示 0%，AC2）', () => {
    it('按云聚合 covered/total 输出百分比', () => {
        const got = coverageSummary([
            { cloud: 'aliyun', product: 'dcdn', covered: 99, total: 100, denominatorAvailable: true },
            { cloud: 'aliyun', product: 'slb', covered: 1, total: 100, denominatorAvailable: true },
            { cloud: 'tencent', product: 'cdn', covered: 98, total: 100, denominatorAvailable: true },
        ])
        expect(got.map((c) => `${c.label} ${c.text}`)).toEqual(['阿里云 50%', '腾讯云 98%'])
        expect(got.every((c) => c.denominatorAvailable)).toBe(true)
    })

    it('total=-1（分母不可用）→ 显示「分母不可用」而非 0%', () => {
        const got = coverageSummary([
            { cloud: 'huawei', product: 'cdn', covered: 5, total: -1, denominatorAvailable: false },
        ])
        expect(got[0]).toMatchObject({ label: '华为云', text: '分母不可用', denominatorAvailable: false })
    })

    it('同云混合可用/不可用 → 百分比 + 「部分分母不可用」标记', () => {
        const got = coverageSummary([
            { cloud: 'aliyun', product: 'dcdn', covered: 80, total: 100, denominatorAvailable: true },
            { cloud: 'aliyun', product: 'waf', covered: 3, total: -1, denominatorAvailable: false },
        ])
        expect(got[0]!.text).toBe('80% · 部分分母不可用')
        expect(got[0]!.denominatorAvailable).toBe(false)
    })

    it('K8s 云输出「N 集群」（集群数来自分组去重，非覆盖率百分比）', () => {
        const got = coverageSummary(
            [{ cloud: 'k8s', product: 'ingress', covered: 12, total: 20, denominatorAvailable: true }],
            5,
        )
        expect(got[0]).toMatchObject({ label: 'K8s', text: '5 集群' })
    })

    it('lagging（asset 盘点滞后，covered>total）→ 百分比封顶 + 滞后标记', () => {
        const got = coverageSummary([
            { cloud: 'tencent', product: 'cdn', covered: 120, total: 100, denominatorAvailable: true, lagging: true },
        ])
        expect(got[0]!.text).toBe('100%（asset 盘点滞后）')
        expect(got[0]!.lagging).toBe(true)
    })

    it('空覆盖率 → 空数组', () => {
        expect(coverageSummary([])).toEqual([])
    })
})

// ==================== AC3：立即扫描防重（会话恢复 / 409 解析 / 完成判定） ====================

describe('扫描会话持久化（重入/刷新恢复「扫描中」态轮询，AC3）', () => {
    function memStorage(): Storage {
        const m = new Map<string, string>()
        return {
            get length() {
                return m.size
            },
            clear: () => m.clear(),
            getItem: (k) => (m.has(k) ? m.get(k)! : null),
            key: () => null,
            removeItem: (k) => void m.delete(k),
            setItem: (k, v) => void m.set(k, v),
        }
    }

    it('save/load/clear 往返；clear 后为 null', () => {
        const s = memStorage()
        const startedAt = Date.now() - 60_000
        saveScanSession({ certId: 'cert-001', snapshotId: 'snap-1', startedAt }, s)
        expect(loadScanSession('cert-001', s)).toEqual({ certId: 'cert-001', snapshotId: 'snap-1', startedAt })
        clearScanSession('cert-001', s)
        expect(loadScanSession('cert-001', s)).toBeNull()
    })

    it('会话按 certId 隔离（其他证书详情页互不干扰）', () => {
        const s = memStorage()
        saveScanSession({ certId: 'cert-001', startedAt: Date.now() }, s)
        expect(loadScanSession('cert-002', s)).toBeNull()
    })

    it('损坏 JSON / 非法结构 → null 且清理残留键', () => {
        const s = memStorage()
        s.setItem('cert.scan.cert-001', '{oops')
        expect(loadScanSession('cert-001', s)).toBeNull()
        expect(s.getItem('cert.scan.cert-001')).toBeNull()
    })

    it('超过最大会话时长的陈旧会话 → null 并清理（避免永久卡「扫描中」）', () => {
        const s = memStorage()
        const now = Date.now()
        saveScanSession({ certId: 'cert-001', startedAt: now - SCAN_SESSION_MAX_AGE_MS - 1 }, s)
        expect(loadScanSession('cert-001', s, new Date())).toBeNull()
        expect(s.getItem('cert.scan.cert-001')).toBeNull()
    })

    it('storage 不可用（隐私模式）→ 静默 null / 不抛错', () => {
        expect(loadScanSession('cert-001', null)).toBeNull()
        expect(() => saveScanSession({ certId: 'c', startedAt: 1 }, null)).not.toThrow()
        expect(() => clearScanSession('c', null)).not.toThrow()
    })
})

describe('parseScanConflict（服务端 409 SCAN_IN_PROGRESS → 进行中态，不新建任务，AC3）', () => {
    it('错误码命中 → 解析 meta 的 snapshotId/startedAt', () => {
        const got = parseScanConflict({
            code: 'SCAN_IN_PROGRESS',
            meta: { snapshotId: 'snap-9', startedAt: '2026-08-19T10:00:00Z' },
        })
        expect(got).toEqual({ snapshotId: 'snap-9', startedAt: Date.parse('2026-08-19T10:00:00Z') })
    })

    it('meta 缺失/非法 → 以当前时间作为 startedAt（保守进入轮询）', () => {
        const now = new Date('2026-08-19T12:00:00Z')
        expect(parseScanConflict({ code: 'SCAN_IN_PROGRESS' }, now)).toEqual({ snapshotId: undefined, startedAt: now.getTime() })
        expect(parseScanConflict({ code: 'SCAN_IN_PROGRESS', meta: 'junk' }, now)?.startedAt).toBe(now.getTime())
    })

    it('非 409 错误（其他错误码 / 普通对象）→ null', () => {
        expect(parseScanConflict({ code: 'FORBIDDEN' })).toBeNull()
        expect(parseScanConflict(new Error('boom'))).toBeNull()
        expect(parseScanConflict(null)).toBeNull()
    })
})

describe('isScanComplete（轮询完成判定：lastScanAt >= 会话 startedAt，AC3）', () => {
    it('新成功快照落库（lastScanAt >= startedAt）→ 完成', () => {
        expect(isScanComplete('2026-08-19T10:05:00Z', Date.parse('2026-08-19T10:00:00Z'))).toBe(true)
        expect(isScanComplete('2026-08-19T10:00:00Z', Date.parse('2026-08-19T10:00:00Z'))).toBe(true)
    })

    it('仍是旧快照 / 无快照 → 未完成（继续轮询）', () => {
        expect(isScanComplete('2026-08-19T09:00:00Z', Date.parse('2026-08-19T10:00:00Z'))).toBe(false)
        expect(isScanComplete(null, Date.parse('2026-08-19T10:00:00Z'))).toBe(false)
    })
})

// ==================== AC4：正向筛选（级联 + 资源名搜索） ====================

const GROUPS = [
    {
        cloud: 'aliyun',
        product: 'dcdn',
        references: [
            { resourceId: 'dcdn-2g8vk1x0', referencedCloudCertId: '1997-1' },
            { resourceId: 'dcdn-9jp3lmz7', referencedCloudCertId: '1997-2' },
        ],
    },
    {
        cloud: 'aliyun',
        product: 'slb',
        references: [{ resourceId: 'slb-bp1q8k2z', referencedCloudCertId: '1997-3' }],
    },
    {
        cloud: 'k8s',
        product: 'ingress',
        clusterId: 'prod-sh-1',
        references: [{ resourceId: 'gw/main', referencedCloudCertId: 'tls-main' }],
    },
    {
        cloud: 'k8s',
        product: 'ingress',
        clusterId: 'prod-bj-2',
        references: [{ resourceId: 'gw/bj', referencedCloudCertId: 'tls-bj' }],
    },
    {
        cloud: 'tencent',
        product: 'cdn',
        references: [{ resourceId: 'cdn-abc', referencedCloudCertId: 'tc-1' }],
    },
]

describe('forwardFilterOptions（云▾/产品▾级联，集群▾仅 K8s 组，AC4）', () => {
    it('云选项 = 去重云列表', () => {
        expect(forwardFilterOptions(GROUPS, '').clouds).toEqual(['aliyun', 'k8s', 'tencent'])
    })

    it('未选云 → 产品为全部产品；选云 → 产品级联限定该云', () => {
        expect(forwardFilterOptions(GROUPS, '').products).toEqual(['dcdn', 'slb', 'ingress', 'cdn'])
        expect(forwardFilterOptions(GROUPS, 'aliyun').products).toEqual(['dcdn', 'slb'])
    })

    it('集群选项仅来自 K8s 分组；非 K8s 云作用域下为空（集群筛选不适用）', () => {
        expect(forwardFilterOptions(GROUPS, '').clusters).toEqual(['prod-sh-1', 'prod-bj-2'])
        expect(forwardFilterOptions(GROUPS, 'k8s').clusters).toEqual(['prod-sh-1', 'prod-bj-2'])
        expect(forwardFilterOptions(GROUPS, 'aliyun').clusters).toEqual([])
    })
})

describe('filterForwardGroups（组级 云/产品/集群 + 行级资源名搜索，AC4）', () => {
    it('无筛选 → 原样全量', () => {
        expect(filterForwardGroups(GROUPS, { cloud: '', product: '', cluster: '', keyword: '' })).toHaveLength(5)
    })

    it('云+产品级联过滤分组', () => {
        const got = filterForwardGroups(GROUPS, { cloud: 'aliyun', product: 'dcdn', cluster: '', keyword: '' })
        expect(got).toHaveLength(1)
        expect(got[0]!.references).toHaveLength(2)
    })

    it('集群过滤仅作用于 K8s 分组（命中其 clusterId）', () => {
        const got = filterForwardGroups(GROUPS, { cloud: '', product: '', cluster: 'prod-sh-1', keyword: '' })
        expect(got).toHaveLength(1)
        expect(got[0]).toMatchObject({ cloud: 'k8s', clusterId: 'prod-sh-1' })
    })

    it('资源名搜索按 resourceId 子串过滤行（大小写不敏感）', () => {
        const got = filterForwardGroups(GROUPS, { cloud: '', product: '', cluster: '', keyword: 'DCDN-' })
        expect(got).toHaveLength(1)
        expect(got[0]!.references.map((r) => r.resourceId)).toEqual(['dcdn-2g8vk1x0', 'dcdn-9jp3lmz7'])
    })

    it('搜索命中部分行时保留组内命中行；整组无命中则丢弃该组', () => {
        const got = filterForwardGroups(GROUPS, { cloud: '', product: '', cluster: '', keyword: 'slb-' })
        expect(got).toHaveLength(1)
        expect(got[0]!.references).toHaveLength(1)
    })

    it('搜索清空 → 恢复全量；无匹配 → 空数组（渲染「无匹配引用」空态）', () => {
        expect(filterForwardGroups(GROUPS, { cloud: '', product: '', cluster: '', keyword: '   ' })).toHaveLength(5)
        expect(filterForwardGroups(GROUPS, { cloud: '', product: '', cluster: '', keyword: 'nope' })).toEqual([])
    })

    it('不修改入参数组（immutable：过滤返回新结构）', () => {
        filterForwardGroups(GROUPS, { cloud: '', product: '', cluster: '', keyword: 'gw' })
        expect(GROUPS[0]!.references).toHaveLength(2)
    })
})

describe('groupLabel / isK8sCloud（分组标题 cloud·product·cluster，AC4）', () => {
    it('云·产品 标签映射 + K8s 组附集群', () => {
        expect(groupLabel(GROUPS[0]!)).toBe('阿里云 · DCDN')
        expect(groupLabel(GROUPS[2]!)).toBe('K8s · Ingress · prod-sh-1')
    })

    it('未知云/产品回退原文', () => {
        expect(groupLabel({ cloud: 'openstack', product: 'lb2', references: [] })).toBe('openstack · lb2')
    })

    it('isK8sCloud 仅 k8s 为真', () => {
        expect(isK8sCloud('k8s')).toBe(true)
        expect(isK8sCloud('aliyun')).toBe(false)
        expect(isK8sCloud('')).toBe(false)
    })
})

// ==================== AC5：反向查询状态 ====================

describe('resolveReverseState（初始态 / 结果 / 未查询到 三态区分，AC5）', () => {
    it('未执行查询（无查询词）→ initial（输入引导，非空态文案）', () => {
        expect(resolveReverseState('', false, null)).toBe('initial')
    })

    it('查询中 → loading', () => {
        expect(resolveReverseState('api.example.com', true, null)).toBe('loading')
    })

    it('查询完成：命中 → results；无匹配 → no-match（区别于初始态）', () => {
        expect(resolveReverseState('api.example.com', false, 2)).toBe('results')
        expect(resolveReverseState('api.example.com', false, 0)).toBe('no-match')
    })
})

// ==================== AC6：未发现引用 / 盲区文案 ====================

describe('noRefsNotice（未发现引用 ≠ 无引用，附最近扫描时间，AC6）', () => {
    it('已扫描无匹配 → 带最近扫描相对时间的三态文案', () => {
        const now = new Date('2026-08-19T12:00:00Z')
        expect(noRefsNotice('2026-08-19T10:00:00Z', now)).toBe('未发现引用（≠ 无引用）· 最近扫描 2h 前')
    })

    it('无快照时间兜底（no_refs_scanned 语义上应有值）', () => {
        expect(noRefsNotice(null)).toContain('尚未扫描')
    })
})

describe('blindSpotNotice（盲区声明：优先服务端 reason，AC6）', () => {
    it('服务端 reason 原文透出', () => {
        expect(blindSpotNotice('华为云未接入扫描')).toBe('引用视图存在盲区：华为云未接入扫描')
    })

    it('无 reason → 通用盲区说明', () => {
        expect(blindSpotNotice(undefined)).toContain('部分云/产品未纳入扫描范围')
        expect(blindSpotNotice('')).toContain('部分云/产品未纳入扫描范围')
    })
})

describe('splitScopedResourceId（复合资源 ID：LB 类 "{实例}/{监听}" 拆分）', () => {
    it('恰含一个 / -> 拆出实例 ID 与监听 ID', () => {
        expect(splitScopedResourceId('alb-bp1q8k2z/lsn-abc')).toEqual({
            instanceId: 'alb-bp1q8k2z',
            listenerId: 'lsn-abc',
        })
    })

    it('多斜杠（AWS 监听 ARN）不拆，返回 null 原样展示', () => {
        expect(splitScopedResourceId('arn:aws:elasticloadbalancing:cn-north-1:123:listener/app/my-alb/abc')).toBeNull()
    })

    it('无斜杠（CDN 域名/K8s 实例名/纯监听存量形态）返回 null', () => {
        expect(splitScopedResourceId('www.example.com')).toBeNull()
        expect(splitScopedResourceId('lsn-legacy')).toBeNull()
    })

    it('边界：首尾斜杠视为不可拆', () => {
        expect(splitScopedResourceId('/lsn-1')).toBeNull()
        expect(splitScopedResourceId('alb-1/')).toBeNull()
    })
})

describe('resourceIdLines（资源 ID 展示行：复合形态拆两行）', () => {
    it('复合形态 -> [实例 ID, "监听 {监听 ID}"]', () => {
        expect(resourceIdLines('alb-9/lsn-target')).toEqual(['alb-9', '监听 lsn-target'])
    })

    it('非复合形态 -> 单行原文', () => {
        expect(resourceIdLines('www.example.com')).toEqual(['www.example.com'])
    })
})
