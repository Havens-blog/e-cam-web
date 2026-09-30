// @vitest-environment happy-dom
/**
 * RC#2（platform-console 任务 2.13）登录目标切换用例：
 * - 登录目标 = VITE_LOGIN_TARGET（默认 /console/login），不再指向 ecmdb-web /login；
 * - redirectToLogin 携带 ?redirect= 回跳、不清共享 cookie ecmdb-token-key（401 只是
 *   本应用的局部判断，清共享凭证会把其他服务的登录态一并清掉——index.ts 顶部注释契约）；
 * - 防重复跳转守卫（并发 401 只跳一次）；
 * - 变量拆分契约：VITE_ECMDB_LOGIN_URL 全仓（src + env）无残留、无散落的 '/login'
 *   硬编码（Hard Rule：机制 = build 期 env 注入，不得散落硬编码）。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveLoginTarget } from './index'
import { restoreLocation, stubLocation } from '@/test-utils/stub-location'

const realLocation = window.location

beforeEach(() => {
    // 共享凭证固定值：断言 401 路径"不清 cookie"的探针（对齐 Story 6 AC / AC#2）
    document.cookie = 'ecmdb-token-key=rc2-shared-cookie; path=/'
})

afterEach(() => {
    restoreLocation(realLocation)
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
})

describe('resolveLoginTarget（登录目标唯一取值处）', () => {
    it('env 未注入时默认控制台登录页 /console/login', () => {
        vi.stubEnv('VITE_LOGIN_TARGET', '')
        expect(resolveLoginTarget()).toBe('/console/login')
    })

    it('env 注入后使用 VITE_LOGIN_TARGET', () => {
        vi.stubEnv('VITE_LOGIN_TARGET', 'http://localhost:8888/console/login')
        expect(resolveLoginTarget()).toBe('http://localhost:8888/console/login')
    })
})

describe('redirectToLogin（401/会话过期路径）', () => {
    /**
     * redirectToLogin 的防重复标志是模块级单次置位，静态导入的模块实例一旦触发
     * 就不再跳转。各用例经 vi.resetModules + 动态 import 取全新实例，互不污染。
     */
    async function freshModule() {
        vi.resetModules()
        return await import('./index')
    }

    it('跳转 VITE_LOGIN_TARGET 并携带 ?redirect= 回跳', async () => {
        vi.stubEnv('VITE_LOGIN_TARGET', 'http://localhost:8888/console/login')
        const current = 'http://localhost:8888/cam/dashboard?tab=cert'
        stubLocation(current)
        const { redirectToLogin } = await freshModule()
        redirectToLogin()
        expect(window.location.href).toBe(
            `http://localhost:8888/console/login?redirect=${encodeURIComponent(current)}`
        )
    })

    it('env 未注入时落到默认 /console/login（不再指向 ecmdb-web /login）', async () => {
        vi.stubEnv('VITE_LOGIN_TARGET', '')
        stubLocation('http://localhost:8888/cam/assets')
        const { redirectToLogin } = await freshModule()
        redirectToLogin()
        // 相对目标按当前 origin 解析（浏览器语义）：/console/login → http://localhost:8888/console/login
        expect(window.location.href).toBe(
            `http://localhost:8888/console/login?redirect=${encodeURIComponent('http://localhost:8888/cam/assets')}`
        )
    })

    it('不清共享 cookie ecmdb-token-key（局部 401 不得扩散为全平台掉线）', async () => {
        vi.stubEnv('VITE_LOGIN_TARGET', '')
        stubLocation('http://localhost:8888/cam/dashboard')
        const { redirectToLogin } = await freshModule()
        redirectToLogin()
        expect(document.cookie).toContain('ecmdb-token-key=rc2-shared-cookie')
    })

    it('防重复守卫：并发 401 只跳一次', async () => {
        vi.stubEnv('VITE_LOGIN_TARGET', '')
        const fake = stubLocation('http://localhost:8888/cam/a')
        const { redirectToLogin } = await freshModule()
        redirectToLogin()
        const firstHref = window.location.href
        expect(firstHref).toContain('/console/login?redirect=')
        // 第二次触发（另一个并发 401）必须早退：href 不再被改写
        fake.href = 'http://localhost:8888/cam/b'
        redirectToLogin()
        expect(window.location.href).toBe('http://localhost:8888/cam/b')
    })
})

describe('变量拆分契约（Hard Rule：机制 = build 期 env 注入，不得散落硬编码）', () => {
    const repoRoot = resolve(__dirname, '..', '..', '..')

    /** 递归收集 src 下所有源码文件（排除测试文件自身——断言里会出现旧变量名字面量） */
    function collectSourceFiles(dir: string, acc: string[] = []): string[] {
        for (const entry of readdirSync(dir)) {
            const full = join(dir, entry)
            if (statSync(full).isDirectory()) {
                if (entry === 'node_modules' || entry === 'dist') continue
                collectSourceFiles(full, acc)
            } else if (/\.(ts|vue)$/.test(entry) && !entry.includes('.test.')) {
                acc.push(full)
            }
        }
        return acc
    }

    const sourceFiles = collectSourceFiles(join(repoRoot, 'src'))

    it('旧变量 VITE_ECMDB_LOGIN_URL 在 src 源码与 env 文件中零残留', () => {
        const envFiles = ['.env', '.env.development', '.env.docker', '.env.production'].map((f) =>
            join(repoRoot, f)
        )
        const offenders = [...sourceFiles, ...envFiles].filter((f) => {
            try {
                return readFileSync(f, 'utf-8').includes('VITE_ECMDB_LOGIN_URL')
            } catch {
                return false
            }
        })
        expect(offenders, `旧变量残留于: ${offenders.join(', ')}`).toEqual([])
    })

    it('登录目标不再散落 "/login" 硬编码（location.href 赋值面）', () => {
        const offenders = sourceFiles.filter((f) =>
            /location\.href\s*=\s*['"`]\/login['"`]/.test(readFileSync(f, 'utf-8'))
        )
        expect(offenders, `散落的 /login 硬编码: ${offenders.join(', ')}`).toEqual([])
    })

    it('三处改读点各自引用拆分后的变量/取值函数', () => {
        const read = (p: string) => readFileSync(join(repoRoot, p), 'utf-8')
        // 登录目标：index.ts 与 user.ts 改读 VITE_LOGIN_TARGET（经 resolveLoginTarget）
        expect(read('src/api/request/index.ts')).toContain('VITE_LOGIN_TARGET')
        expect(read('src/stores/user.ts')).toContain('resolveLoginTarget')
        // 个人设置基址：MainLayout 改读 VITE_ECMDB_WEB_BASE（语义正名、值不变），
        // 且绝不经 import.meta.env 读登录目标（防 /console/login/profile/index 死链）
        expect(read('src/layouts/MainLayout.vue')).toContain('VITE_ECMDB_WEB_BASE')
        expect(read('src/layouts/MainLayout.vue')).not.toContain('import.meta.env.VITE_LOGIN_TARGET')
    })
})
