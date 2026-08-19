/**
 * 变更管理纯展示逻辑单测（任务 6.5，UF-4）。
 *
 * 覆盖任务 AC 的可纯函数化部分：Tab 全集与合并、进度派生、分批上限、
 * 7 步闸门/只读回看/存草稿步域、Step2 阻断卡映射、Step3 分区与出路、
 * 逐项徽章、倒计时 a11y（跨小时档/归零才通告 + reduced-motion）、
 * 回滚 Hard Rule（三态 + 仅成功项）、只读恢复模式、报告卡筛选与结论、
 * 向导草稿持久化、?certId= 预选资格。
 */
import { describe, expect, it } from 'vitest'
import type { ChangeOrder, ChangeStatus } from '@/api/cert'
import {
    CHANGE_TABS,
    PRESELECT_INELIGIBLE_NOTICE,
    RESULT_FILTER_OPTIONS,
    WIZARD_DRAFT_KEY,
    actionLabel,
    allItemsTerminal,
    batchOptions,
    batchText,
    blockedExit,
    canAdvance,
    clearWizardDraft,
    canRollbackNow,
    canSaveDraft,
    clampBatchSize,
    countdownAriaLabel,
    countdownHourBucket,
    countdownParts,
    countdownText,
    filterReportItems,
    filterRowsByTab,
    firstBatchCap,
    hasFailedItem,
    isActiveRowStatus,
    isEditableRow,
    isExecutionPhase,
    isReadonlyLookback,
    itemStatusBadge,
    loadWizardDraft,
    needsBatching,
    nextPollDelay,
    orphanActionLabel,
    partitionListItems,
    precheckBlockFromError,
    preselectEligible,
    progressAnnouncement,
    progressText,
    resumeMode,
    rollbackReportItems,
    rollbackScopeItems,
    saveWizardDraft,
    shouldAnnounceCountdown,
    statusToTab,
    stepFromStatus,
    stepGateHint,
    summarizeProgress,
    tabCounts,
    targetLocationLabel,
    truncateMiddle,
    verifyConclusion,
} from './format'

function order(status: ChangeStatus, id = `CHG-${status}`): ChangeOrder {
    return {
        id,
        oldFingerprint: 'a'.repeat(64),
        newCertId: 'cert-new-1',
        status,
        snapshotId: 'snap-1',
        currentBatch: 1,
        totalBatches: 1,
        paused: false,
        creator: 'ops@team',
        createdAt: '2026-08-14T10:00:00Z',
    }
}

const ALL_STATUSES: ChangeStatus[] = [
    'draft',
    'pending_confirm',
    'executing',
    'verifying',
    'completed',
    'partial_completed',
    'rolled_back',
    'rollback_failed',
    'cancelled',
]

// ==================== AC1 列表页：Tab 全集 / 合并 / 计数 / 保护期 ====================

describe('变更列表状态 Tab', () => {
    it('Tab 全集为 7 个（全部/待确认/执行中/验证中/部分完成/已完成/已回滚回滚失败）', () => {
        expect(CHANGE_TABS.map((t) => t.key)).toEqual([
            'all',
            'pending',
            'executing',
            'verifying',
            'partial',
            'completed',
            'rollback',
        ])
    })

    it('待确认 Tab 含草稿；已回滚/回滚失败合并同一 Tab；cancelled 不入任何 Tab', () => {
        expect(statusToTab('draft')).toBe('pending')
        expect(statusToTab('pending_confirm')).toBe('pending')
        expect(statusToTab('rolled_back')).toBe('rollback')
        expect(statusToTab('rollback_failed')).toBe('rollback')
        expect(statusToTab('cancelled')).toBeNull()
    })

    it('九态全覆盖：每态映射唯一 Tab 或 null', () => {
        const mapped = ALL_STATUSES.map((s) => statusToTab(s))
        expect(mapped.filter((v) => v === null)).toEqual([null]) // 仅 cancelled
        expect(new Set(mapped.filter((v): v is NonNullable<typeof v> => v !== null)).size).toBe(6)
    })

    it('tabCounts 统计各 Tab 行数（全部 = 总数，cancelled 仅计入全部）', () => {
        const rows = ALL_STATUSES.map((s) => order(s))
        const counts = tabCounts(rows)
        expect(counts.all).toBe(9)
        expect(counts.pending).toBe(2)
        expect(counts.executing).toBe(1)
        expect(counts.verifying).toBe(1)
        expect(counts.partial).toBe(1)
        expect(counts.completed).toBe(1)
        expect(counts.rollback).toBe(2)
    })

    it('filterRowsByTab 按 Tab 过滤（rollback Tab 含两种回滚态）', () => {
        const rows = ALL_STATUSES.map((s) => order(s))
        expect(filterRowsByTab(rows, 'all')).toHaveLength(9)
        expect(filterRowsByTab(rows, 'rollback')).toHaveLength(2)
        expect(filterRowsByTab(rows, 'pending').map((r) => r.status)).toEqual(['draft', 'pending_confirm'])
        expect(filterRowsByTab(rows, 'executing')).toHaveLength(1)
    })

    it('草稿/待确认行可继续编辑；其余行走详情', () => {
        expect(isEditableRow('draft')).toBe(true)
        expect(isEditableRow('pending_confirm')).toBe(true)
        expect(isEditableRow('executing')).toBe(false)
        expect(isEditableRow('completed')).toBe(false)
    })

    it('执行中/验证中行为活跃行（10s 轮询对象）', () => {
        expect(isActiveRowStatus('executing')).toBe(true)
        expect(isActiveRowStatus('verifying')).toBe(true)
        expect(isActiveRowStatus('completed')).toBe(false)
        expect(isActiveRowStatus('pending_confirm')).toBe(false)
    })

    it('批次文案：分批单显示 批次 X/Y（批间暂停附加标注）；单批为空', () => {
        expect(batchText({ currentBatch: 1, totalBatches: 3, paused: false })).toBe('批次 1/3')
        expect(batchText({ currentBatch: 1, totalBatches: 3, paused: true })).toBe('批次 1/3（批间暂停）')
        expect(batchText({ currentBatch: 1, totalBatches: 1, paused: false })).toBe('')
        expect(batchText({ currentBatch: 0, totalBatches: 0, paused: false })).toBe('')
    })
})

// ==================== AC1/AC5 进度派生 ====================

describe('进度派生', () => {
    const states = [
        { status: 'success' as const },
        { status: 'success' as const },
        { status: 'failed' as const },
        { status: 'running' as const },
        { status: 'rate_limited' as const },
        { status: 'pending' as const },
        { status: 'skipped' as const },
        { status: 'rolled_back' as const },
    ]

    it('summarizeProgress 分类计数 + 终态 = 总数 − 待执行/执行中/限流', () => {
        const p = summarizeProgress(states)
        expect(p.total).toBe(8)
        expect(p.succeeded).toBe(2)
        expect(p.failed).toBe(1)
        expect(p.running).toBe(1)
        expect(p.rateLimited).toBe(1)
        expect(p.pending).toBe(1)
        expect(p.skipped).toBe(1)
        expect(p.rolledBack).toBe(1)
        expect(p.terminal).toBe(5)
    })

    it('progressText：`done/total · N 失败`，无失败不附加，重试中附加提示', () => {
        expect(progressText(summarizeProgress(states.slice(0, 3)))).toBe('3/3 · 1 失败')
        expect(progressText(summarizeProgress([{ status: 'success' }, { status: 'success' }]))).toBe('2/2')
        expect(progressText(summarizeProgress([{ status: 'success' }, { status: 'rate_limited' }]))).toBe('1/2 · 1 重试中')
        expect(progressText(summarizeProgress([]))).toBe('—')
    })

    it('hasFailedItem 仅 failed 计为失败（限流重试不算）', () => {
        expect(hasFailedItem([{ status: 'failed' }])).toBe(true)
        expect(hasFailedItem([{ status: 'rate_limited' }])).toBe(false)
        expect(hasFailedItem([{ status: 'success' }])).toBe(false)
    })

    it('allItemsTerminal：全部终态 true；存在 pending/running/rate_limited false', () => {
        expect(allItemsTerminal([{ status: 'success' }, { status: 'failed' }, { status: 'skipped' }])).toBe(true)
        expect(allItemsTerminal([{ status: 'success' }, { status: 'running' }])).toBe(false)
        expect(allItemsTerminal([{ status: 'rate_limited' }])).toBe(false)
        expect(allItemsTerminal([])).toBe(false)
    })

    it('progressAnnouncement：终态事件摘要「已完成 N/总数，失败 M」', () => {
        expect(progressAnnouncement(summarizeProgress(states.slice(0, 3)))).toBe('已完成 3/3，失败 1')
        expect(progressAnnouncement(summarizeProgress([{ status: 'success' }]))).toBe('已完成 1/1')
    })
})

// ==================== AC4 分批门控（首批 ≤ floor(总量/2)） ====================

describe('分批门控', () => {
    it('firstBatchCap = floor(total/2) 且至少 1', () => {
        expect(firstBatchCap(12)).toBe(6)
        expect(firstBatchCap(11)).toBe(5)
        expect(firstBatchCap(2)).toBe(1)
        expect(firstBatchCap(1)).toBe(1)
        expect(firstBatchCap(0)).toBe(1)
    })

    it('needsBatching：总量 >1 才分批（≤1 免分批）', () => {
        expect(needsBatching(1)).toBe(false)
        expect(needsBatching(2)).toBe(true)
        expect(needsBatching(12)).toBe(true)
    })

    it('clampBatchSize 钳制到 [1, floor(total/2)]，超限回退上限', () => {
        expect(clampBatchSize(6, 12)).toBe(6)
        expect(clampBatchSize(7, 12)).toBe(6) // 超限 → 上限
        expect(clampBatchSize(0, 12)).toBe(1)
        expect(clampBatchSize(Number.NaN, 12)).toBe(6)
        expect(clampBatchSize(3, 2)).toBe(1)
    })
})

// ==================== AC2 7 步向导：闸门/只读回看/存草稿 ====================

describe('7 步向导闸门', () => {
    const empty: Parameters<typeof canAdvance>[1] = {
        oldCertId: null,
        newCertId: null,
        precheckPassed: false,
        listGenerated: false,
        confirmed: false,
    }

    it('Step1 双选闸门：旧/新证书均已选定才可前进', () => {
        expect(canAdvance(1, empty)).toBe(false)
        expect(canAdvance(1, { ...empty, oldCertId: 'a' })).toBe(false)
        expect(canAdvance(1, { ...empty, oldCertId: 'a', newCertId: 'b' })).toBe(true)
    })

    it('Step2 双预检闸门 / Step3 清单闸门 / Step4 确认闸门', () => {
        expect(canAdvance(2, empty)).toBe(false)
        expect(canAdvance(2, { ...empty, precheckPassed: true })).toBe(true)
        expect(canAdvance(3, empty)).toBe(false)
        expect(canAdvance(3, { ...empty, listGenerated: true })).toBe(true)
        expect(canAdvance(4, empty)).toBe(false)
        expect(canAdvance(4, { ...empty, confirmed: true })).toBe(true)
    })

    it('Step5+ 无常规下一步（false）', () => {
        expect(canAdvance(5, { ...empty, confirmed: true })).toBe(false)
        expect(canAdvance(7, { ...empty, confirmed: true })).toBe(false)
    })

    it('闸门缺失项 tooltip 文案', () => {
        expect(stepGateHint(1)).toContain('旧/新证书均已选定')
        expect(stepGateHint(2)).toContain('新鲜度')
        expect(stepGateHint(3)).toContain('清单')
        expect(stepGateHint(5)).toBe('')
    })

    it('只读回看：查看步 < 当前步（已完成步回看），当前步本身非回看', () => {
        expect(isReadonlyLookback(2, 5)).toBe(true)
        expect(isReadonlyLookback(5, 5)).toBe(false)
        expect(isReadonlyLookback(6, 5)).toBe(false)
    })

    it('存为草稿仅 Step1~4（Step5 起不可存）', () => {
        expect(canSaveDraft(1)).toBe(true)
        expect(canSaveDraft(4)).toBe(true)
        expect(canSaveDraft(5)).toBe(false)
        expect(canSaveDraft(7)).toBe(false)
    })

    it('stepFromStatus：执行态/验证态/终态/待确认落点', () => {
        expect(stepFromStatus('executing')).toBe(5)
        expect(stepFromStatus('verifying')).toBe(6)
        expect(stepFromStatus('completed')).toBe(7)
        expect(stepFromStatus('partial_completed')).toBe(7)
        expect(stepFromStatus('cancelled')).toBe(7)
        expect(stepFromStatus('pending_confirm')).toBe(4)
        expect(stepFromStatus('draft')).toBe(4)
    })

    it('isExecutionPhase：进入执行阶段后向导不可再改选/重生成', () => {
        expect(isExecutionPhase('pending_confirm')).toBe(false)
        expect(isExecutionPhase('executing')).toBe(true)
        expect(isExecutionPhase('verifying')).toBe(true)
        expect(isExecutionPhase('completed')).toBe(true)
    })
})

// ==================== AC2 ?certId= 预选资格 ====================

describe('Step1 预选资格', () => {
    it('完整托管且有引用才预选', () => {
        expect(preselectEligible({ hostingStatus: 'complete', refCount: 12 })).toBe(true)
        expect(preselectEligible({ hostingStatus: 'fingerprint_only', refCount: 12 })).toBe(false)
        expect(preselectEligible({ hostingStatus: 'complete', refCount: 0 })).toBe(false)
    })

    it('不合规提示文案存在（不锁选择器不跳步）', () => {
        expect(PRESELECT_INELIGIBLE_NOTICE).toContain('无活跃引用')
    })
})

// ==================== AC3 Step2 阻断卡映射 ====================

describe('Step2 预检阻断卡', () => {
    it('扫描超期 → 立即扫描引导', () => {
        const b = precheckBlockFromError('SCAN_STALE')
        expect(b.kind).toBe('scan_stale')
        expect(b.action).toBe('scan')
        expect(b.title).toContain('扫描新鲜度')
    })

    it('SAN 不满足 → 阻断 + 返回上一步', () => {
        const b = precheckBlockFromError('SAN_INSUFFICIENT')
        expect(b.kind).toBe('san')
        expect(b.action).toBe('back')
    })

    it('在途互斥 → 查看在途单跳转', () => {
        const b = precheckBlockFromError('CHANGE_IN_FLIGHT')
        expect(b.kind).toBe('mutex')
        expect(b.action).toBe('view-order')
        expect(b.title).toContain('在途变更单')
    })

    it('新证书仅指纹 → 提示补传私钥', () => {
        const b = precheckBlockFromError('NEW_CERT_FINGERPRINT_ONLY')
        expect(b.kind).toBe('fingerprint_only')
        expect(b.body).toContain('补传私钥')
    })

    it('未知错误 → 通用错误卡可重试可返回', () => {
        const b = precheckBlockFromError('INVALID_ENVELOPE')
        expect(b.kind).toBe('error')
        expect(b.action).toBe('back')
    })
})

// ==================== AC3 Step3 清单分区 ====================

describe('Step3 清单分区', () => {
    const items = [
        { itemId: '1', autoChangeable: true, action: 'upload_and_bind', target: { channel: 'cloud_api', cloud: 'aliyun', product: 'dcdn', resourceId: 'dcdn-1' } },
        { itemId: '2', autoChangeable: false, reason: 'ERR_DISCOVERY_ONLY: huawei 首期无部署器', action: 'upload_and_bind', target: { channel: 'cloud_api', cloud: 'huawei', resourceId: 'elb-1' } },
        { itemId: '3', autoChangeable: false, reason: 'K8S_MANAGEMENT_SIGNAL: argocd', action: 'patch_crd', target: { channel: 'k8s_api', kind: 'Ingress', resourceId: 'ing-1' } },
    ] as never as import('@/api/cert').ChangeListItem[]

    it('partitionListItems：可执行/不可执行分区', () => {
        const p = partitionListItems(items)
        expect(p.executable).toHaveLength(1)
        expect(p.blocked).toHaveLength(2)
    })

    it('blockedExit：discovery-only → 二期/手工；K8s 管理权 → 管理链路', () => {
        expect(blockedExit('ERR_DISCOVERY_ONLY: aws 首期无部署器')).toContain('二期')
        expect(blockedExit('K8S_MANAGEMENT_UNPROBED: 管理权探测通道未接入')).toContain('管理链路')
        expect(blockedExit(undefined)).toContain('人工处理')
    })

    it('actionLabel / targetLocationLabel 计划动作与目标文案', () => {
        expect(actionLabel('upload_and_bind')).toBe('替换证书')
        expect(actionLabel('patch_crd')).toBe('替换 TLS Secret')
        expect(targetLocationLabel(items[0]!.target)).toBe('阿里云 · DCDN')
        expect(targetLocationLabel(items[2]!.target)).toBe('K8s · Ingress')
    })
})

// ==================== AC5 逐项徽章 ====================

describe('逐项状态徽章', () => {
    it('五类执行态徽章（成功✓/失败✗/执行中 spinner/限流重试中⚠/待执行○）', () => {
        expect(itemStatusBadge('success')).toMatchObject({ label: '成功', tone: 'success', icon: '✓' })
        expect(itemStatusBadge('failed')).toMatchObject({ label: '失败', tone: 'error', icon: '✗' })
        expect(itemStatusBadge('running')).toMatchObject({ label: '执行中', tone: 'accent', spinner: true })
        expect(itemStatusBadge('rate_limited')).toMatchObject({ label: '限流重试中', tone: 'warning', icon: '⚠' })
        expect(itemStatusBadge('pending')).toMatchObject({ label: '待执行', tone: 'secondary', icon: '○' })
    })

    it('回滚/跳过态徽章', () => {
        expect(itemStatusBadge('rolled_back')).toMatchObject({ label: '已回滚', tone: 'secondary' })
        expect(itemStatusBadge('rollback_failed')).toMatchObject({ label: '回滚失败', tone: 'error' })
        expect(itemStatusBadge('skipped')).toMatchObject({ label: '跳过', tone: 'secondary' })
    })

    it('未知状态回退 secondary 不抛错', () => {
        expect(itemStatusBadge('weird').tone).toBe('secondary')
    })
})

// ==================== AC5 验证窗口倒计时（a11y 策略） ====================

describe('验证窗口倒计时', () => {
    const now = new Date('2026-08-14T12:00:00Z')

    it('countdownParts 分解时/分/秒；过期与非法输入 → expired 全零', () => {
        const parts = countdownParts('2026-08-14T13:59:59Z', now)
        expect(parts.expired).toBe(false)
        expect(parts.hours).toBe(1)
        expect(parts.minutes).toBe(59)
        expect(parts.seconds).toBe(59)
        expect(countdownParts('2026-08-14T11:00:00Z', now).expired).toBe(true)
        expect(countdownParts(null, now).expired).toBe(true)
        expect(countdownParts('not-a-date', now).expired).toBe(true)
    })

    it('countdownText 秒级 `hh:mm:ss`；reduced-motion 隐藏秒位仅显时分', () => {
        const parts = countdownParts('2026-08-15T11:59:59Z', now)
        expect(countdownText(parts)).toBe('23:59:59')
        expect(countdownText(parts, true)).toBe('23:59')
        expect(countdownText(countdownParts('2026-08-14T11:00:00Z', now))).toBe('00:00:00')
    })

    it('countdownAriaLabel 静态描述总时长（小时向上取整）；关闭态文案', () => {
        expect(countdownAriaLabel(countdownParts('2026-08-14T13:00:01Z', now))).toBe('验证窗口剩余约 2 小时')
        expect(countdownAriaLabel(countdownParts('2026-08-14T13:00:00Z', now))).toBe('验证窗口剩余约 1 小时')
        expect(countdownAriaLabel(countdownParts('2026-08-14T11:00:00Z', now))).toBe('验证窗口已关闭')
    })

    it('跨小时档/归零才通告：同档秒级跳动不通告', () => {
        const p1 = countdownParts('2026-08-14T13:30:00Z', now) // ~1.5h → 档 2
        const sameBucket = countdownParts('2026-08-14T13:00:01Z', now) // ~1h → 档 2
        const lowerBucket = countdownParts('2026-08-14T12:30:00Z', now) // 0.5h → 档 1
        expect(shouldAnnounceCountdown(2, 2)).toBe(false)
        expect(shouldAnnounceCountdown(countdownHourBucket(p1), countdownHourBucket(sameBucket))).toBe(false)
        expect(shouldAnnounceCountdown(countdownHourBucket(p1), countdownHourBucket(lowerBucket))).toBe(true)
        expect(shouldAnnounceCountdown(1, -1)).toBe(true) // 归零通告
        expect(shouldAnnounceCountdown(null, 5)).toBe(false) // 首次进入不通告
    })
})

// ==================== Hard Rule：回滚入口三态 + 仅成功项 ====================

describe('回滚 Hard Rule', () => {
    it('canRollbackNow：仅 执行中(有失败项)/验证中/部分完成 三态可见', () => {
        expect(canRollbackNow('executing', true)).toBe(true)
        expect(canRollbackNow('executing', false)).toBe(false) // 执行中无失败项不可回滚
        expect(canRollbackNow('verifying', false)).toBe(true)
        expect(canRollbackNow('partial_completed', false)).toBe(true)
        expect(canRollbackNow('completed', true)).toBe(false)
        expect(canRollbackNow('pending_confirm', true)).toBe(false)
        expect(canRollbackNow('rolled_back', false)).toBe(false)
    })

    it('rollbackScopeItems：仅执行成功项进入回滚范围', () => {
        const states = [
            { itemId: '1', status: 'success' as const },
            { itemId: '2', status: 'failed' as const },
            { itemId: '3', status: 'success' as const },
            { itemId: '4', status: 'rolled_back' as const },
            { itemId: '5', status: 'running' as const },
        ]
        expect(rollbackScopeItems(states).map((s) => s.itemId)).toEqual(['1', '3'])
    })
})

// ==================== AC6 只读恢复视图 ====================

describe('只读恢复模式', () => {
    const inProtect = '2999-01-01T00:00:00Z'
    const outProtect = '2000-01-01T00:00:00Z'

    it('执行中→内嵌 Step5；验证中→内嵌 Step6', () => {
        expect(resumeMode('executing')).toBe('step5')
        expect(resumeMode('verifying')).toBe('step6')
    })

    it('部分完成：保护期内→partial（回滚入口+保护期徽章，无轮询）；过保护期→none', () => {
        expect(resumeMode('partial_completed', inProtect)).toBe('partial')
        expect(resumeMode('partial_completed', outProtect)).toBe('none')
        expect(resumeMode('partial_completed')).toBe('none')
    })

    it('草稿/待确认→继续编辑跳向导；其余终态→无恢复区', () => {
        expect(resumeMode('draft')).toBe('edit')
        expect(resumeMode('pending_confirm')).toBe('edit')
        expect(resumeMode('completed', inProtect)).toBe('none')
        expect(resumeMode('cancelled')).toBe('none')
    })

    it('轮询退避：常态 2s，失败 1 次 4s，≥2 次封顶 10s', () => {
        expect(nextPollDelay(0)).toBe(2_000)
        expect(nextPollDelay(1)).toBe(4_000)
        expect(nextPollDelay(2)).toBe(10_000)
        expect(nextPollDelay(5)).toBe(10_000)
    })
})

// ==================== AC6 报告卡 ====================

describe('报告卡逻辑', () => {
    const items = [
        { itemId: '1', status: 'success', batchNo: 1 },
        { itemId: '2', status: 'failed', batchNo: 1 },
        { itemId: '3', status: 'rate_limited', batchNo: 2 },
        { itemId: '4', status: 'skipped', batchNo: 0 },
    ]

    it('卡2 结果筛选（全部/仅失败/仅限流重试/仅跳过）+ 批次筛选', () => {
        expect(RESULT_FILTER_OPTIONS.map((o) => o.value)).toEqual(['', 'failed', 'rate_limited', 'skipped'])
        expect(filterReportItems(items, '')).toHaveLength(4)
        expect(filterReportItems(items, 'failed').map((i) => i.itemId)).toEqual(['2'])
        expect(filterReportItems(items, 'rate_limited').map((i) => i.itemId)).toEqual(['3'])
        expect(filterReportItems(items, 'skipped').map((i) => i.itemId)).toEqual(['4'])
        expect(filterReportItems(items, '', 1).map((i) => i.itemId)).toEqual(['1', '2'])
        expect(filterReportItems(items, 'failed', 2)).toHaveLength(0)
    })

    it('批次选项去重升序', () => {
        expect(batchOptions(items)).toEqual([0, 1, 2])
        expect(batchOptions([])).toEqual([])
    })

    it('卡3 回滚状态行：仅 rolled_back/rollback_failed 项', () => {
        const withRollback = [
            ...items,
            { itemId: '5', status: 'rolled_back', batchNo: 1 },
            { itemId: '6', status: 'rollback_failed', batchNo: 1 },
        ]
        expect(rollbackReportItems(withRollback).map((i) => i.itemId)).toEqual(['5', '6'])
        expect(rollbackReportItems(items)).toEqual([])
    })

    it('卡4 窗口结论：未开启/关闭摘要（达标/差异/跳过/未达标）', () => {
        expect(verifyConclusion(null)).toContain('验证窗口未开启')
        expect(verifyConclusion(undefined)).toContain('验证窗口未开启')
        const c = verifyConclusion({
            windowUntil: '2026-08-14T18:00:00Z',
            expectedNew: 'fp',
            probePass: 10,
            probeDiff: 2,
            probeSkipped: 1,
            unmet: 2,
        })
        expect(c).toContain('窗口关闭于 2026-08-14 18:00')
        expect(c).toContain('达标 10')
        expect(c).toContain('差异 2')
        expect(c).toContain('未达标 2 项转常规差异告警')
        const ok = verifyConclusion({
            windowUntil: '2026-08-14T18:00:00Z',
            expectedNew: 'fp',
            probePass: 12,
            probeDiff: 0,
            probeSkipped: 0,
            unmet: 0,
        })
        expect(ok).not.toContain('未达标')
    })

    it('卡5 孤儿清理动作文案', () => {
        expect(orphanActionLabel('cleanup')).toContain('删除')
        expect(orphanActionLabel('skip_keep')).toContain('暂留')
    })
})

// ==================== AC2 向导草稿持久化 ====================

describe('向导草稿持久化', () => {
    function memStorage(): Storage {
        const map = new Map<string, string>()
        return {
            get length() {
                return map.size
            },
            clear: () => map.clear(),
            getItem: (k: string) => map.get(k) ?? null,
            key: (i: number) => [...map.keys()][i] ?? null,
            removeItem: (k: string) => void map.delete(k),
            setItem: (k: string, v: string) => void map.set(k, v),
        }
    }

    it('保存 → 读取往返一致；key 固定', () => {
        const s = memStorage()
        saveWizardDraft(
            { orderId: 'CHG-1', oldCertId: 'c1', oldFingerprint: 'fp1', newCertId: 'c2', savedStep: 3, savedAt: '2026-08-14T00:00:00Z' },
            s,
        )
        expect(s.getItem(WIZARD_DRAFT_KEY)).toBeTruthy()
        const d = loadWizardDraft(s)
        expect(d).toEqual({
            orderId: 'CHG-1',
            oldCertId: 'c1',
            oldFingerprint: 'fp1',
            newCertId: 'c2',
            savedStep: 3,
            savedAt: '2026-08-14T00:00:00Z',
        })
    })

    it('无记录/损坏 JSON/缺 savedStep → null 不抛错', () => {
        const s = memStorage()
        expect(loadWizardDraft(s)).toBeNull()
        s.setItem(WIZARD_DRAFT_KEY, '{broken')
        expect(loadWizardDraft(s)).toBeNull()
        s.setItem(WIZARD_DRAFT_KEY, JSON.stringify({ oldCertId: 'c1' }))
        expect(loadWizardDraft(s)).toBeNull()
    })

    it('storage 不可用（null）静默忽略', () => {
        expect(() => saveWizardDraft({ savedStep: 1, savedAt: '' }, null)).not.toThrow()
        expect(loadWizardDraft(null)).toBeNull()
        expect(() => clearWizardDraft(null)).not.toThrow()
    })

    it('清除后读取为 null', () => {
        const s = memStorage()
        saveWizardDraft({ savedStep: 2, savedAt: '' }, s)
        clearWizardDraft(s)
        expect(loadWizardDraft(s)).toBeNull()
    })
})

// ==================== 长文本截断 ====================

describe('长文本 mono 截断', () => {
    it('首 8 + … + 末 8；短值原样', () => {
        expect(truncateMiddle('a1b2c3d4e5f60718293a4b5c6d7e8f90')).toBe('a1b2c3d4…6d7e8f90')
        expect(truncateMiddle('short')).toBe('short')
        expect(truncateMiddle('123456789')).toBe('123456789')
        expect(truncateMiddle('1234567890')).toBe('1234567890')
    })
})
