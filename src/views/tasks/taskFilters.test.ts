import { describe, expect, it } from 'vitest'
import {
    buildTaskQuery,
    hasBacklog,
    TASK_STATUS_OPTIONS,
    TASK_SUMMARY_STATUSES,
    TASK_TYPE_OPTIONS,
    taskStatusLabel,
    taskTypeLabel,
} from './taskFilters'

describe('TASK_TYPE_OPTIONS', () => {
    it('使用后端真实类型（cam: 前缀）', () => {
        const values = TASK_TYPE_OPTIONS.map((o) => o.value)
        expect(values).toContain('cam:sync_assets')
        expect(values).toContain('cam:sync_billing')
        expect(values.every((v) => v.startsWith('cam:'))).toBe(true)
        expect(values).not.toContain('sync_assets')
    })

    it('覆盖同步资产/发现资产/同步账单/创建云主机', () => {
        expect(TASK_TYPE_OPTIONS.map((o) => o.label)).toEqual([
            '同步资产',
            '发现资产',
            '同步账单',
            '创建云主机',
        ])
    })
})

describe('buildTaskQuery', () => {
    it('空筛选只下发分页参数', () => {
        expect(buildTaskQuery({}, 1, 20)).toEqual({ offset: 0, limit: 20 })
        expect(buildTaskQuery({}, 3, 20)).toEqual({ offset: 40, limit: 20 })
    })

    it('类型与状态下发真实值', () => {
        expect(buildTaskQuery({ type: 'cam:sync_assets', status: 'pending' }, 1, 20)).toEqual({
            offset: 0,
            limit: 20,
            type: 'cam:sync_assets',
            status: 'pending',
        })
    })

    it('页码小于 1 按第 1 页处理', () => {
        expect(buildTaskQuery({}, 0, 20)).toEqual({ offset: 0, limit: 20 })
    })
})

describe('labels', () => {
    it('已知类型/状态给出中文标签', () => {
        expect(taskTypeLabel('cam:sync_assets')).toBe('同步资产')
        expect(taskTypeLabel('cam:sync_billing')).toBe('同步账单')
        expect(taskStatusLabel('pending')).toBe('等待中')
    })

    it('未知类型回退原始值', () => {
        expect(taskTypeLabel('cam:unknown')).toBe('cam:unknown')
        expect(taskStatusLabel('unknown')).toBe('unknown')
    })
})

describe('summary', () => {
    it('概览条包含全部与四个状态', () => {
        expect(TASK_SUMMARY_STATUSES.map((s) => s.key)).toEqual([
            'all',
            'pending',
            'running',
            'completed',
            'failed',
        ])
        expect(TASK_SUMMARY_STATUSES.find((s) => s.key === 'all')?.status).toBeUndefined()
    })

    it('有待执行或执行中即为积压', () => {
        expect(hasBacklog({ pending: 0, running: 0 })).toBe(false)
        expect(hasBacklog({ pending: 1, running: 0 })).toBe(true)
        expect(hasBacklog({ pending: 0, running: 2 })).toBe(true)
    })

    it('状态下拉覆盖五种状态', () => {
        expect(TASK_STATUS_OPTIONS.map((o) => o.value)).toEqual([
            'pending',
            'running',
            'completed',
            'failed',
            'cancelled',
        ])
    })
})
