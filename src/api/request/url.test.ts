// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { appUrlForPath } from './index'

describe('appUrlForPath', () => {
    it('补上 /cam base（router fullPath 不含 base）', () => {
        vi.stubEnv('BASE_URL', '/cam/')
        expect(appUrlForPath('/audit/logs')).toBe(`${window.location.origin}/cam/audit/logs`)
        vi.unstubAllEnvs()
    })

    it('保留 query 与 hash', () => {
        vi.stubEnv('BASE_URL', '/cam/')
        expect(appUrlForPath('/audit/logs?x=1#top')).toBe(`${window.location.origin}/cam/audit/logs?x=1#top`)
        vi.unstubAllEnvs()
    })

    it('base 为根路径时不重复加前缀', () => {
        vi.stubEnv('BASE_URL', '/')
        expect(appUrlForPath('/tasks')).toBe(`${window.location.origin}/tasks`)
        vi.unstubAllEnvs()
    })

    it('不会产生 /cam/cam 重复拼接', () => {
        vi.stubEnv('BASE_URL', '/cam/')
        expect(appUrlForPath('/certs')).not.toContain('/cam/cam')
        vi.unstubAllEnvs()
    })
})
