// @vitest-environment happy-dom
/**
 * RC#2（platform-console 任务 2.13）AC3：个人设置跳转基址的隐式耦合修复。
 * 基址必须读 VITE_ECMDB_WEB_BASE（ecmdb-web 站点根，过渡期值不变、不受旧登录
 * 入口 301 波及），不得改读登录目标 VITE_LOGIN_TARGET——否则会拼出
 * /console/login/profile/index 死链（tech-design RC#2「隐式耦合第三处」）。
 */
import { mount, type VueWrapper } from '@vue/test-utils'
import { ElDropdown, ElDropdownItem, ElDropdownMenu } from 'element-plus'
import { createPinia, setActivePinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import MainLayout from '../MainLayout.vue'
import { restoreLocation, stubLocation } from '@/test-utils/stub-location'

function createTestRouter(): Router {
    return createRouter({
        history: createMemoryHistory(),
        routes: [
            { path: '/', component: { template: '<div />' }, children: [
                { path: 'dashboard', component: { template: '<div />' } }
            ] }
        ]
    })
}

const realLocation = window.location

/** 本文件所有挂载实例（afterEach 统一卸载） */
const wrappers: VueWrapper[] = []

async function mountLayout() {
    const router = createTestRouter()
    await router.push('/')
    const pinia = createPinia()
    pinia.use(piniaPluginPersistedstate)
    setActivePinia(pinia)
    const wrapper = mount(MainLayout, {
        attachTo: document.body,
        global: {
            plugins: [pinia, router],
            // el-* 显式注册（vitest 无 unplugin 自动注册）；palette/侧栏组件 stub 化，
            // 仅保留 ElDropdown 真实例以派发 command
            components: { ElDropdown, ElDropdownMenu, ElDropdownItem },
            stubs: { TenantSelector: true, PlatformNav: true, CommandPalette: true, teleport: true }
        }
    })
    wrappers.push(wrapper)
    return wrapper
}

beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(window, 'open').mockImplementation(() => null)
})

afterEach(() => {
    while (wrappers.length) {
        wrappers.pop()?.unmount()
    }
    restoreLocation(realLocation)
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
})

describe('个人设置跳转基址（RC#2 拆分后）', () => {
    async function openProfileMenu() {
        const wrapper = await mountLayout()
        const dropdown = wrapper.findComponent(ElDropdown)
        expect(dropdown.exists(), 'MainLayout 应渲染用户下拉菜单').toBe(true)
        dropdown.vm.$emit('command', 'profile')
        await wrapper.vm.$nextTick()
        return wrapper
    }

    it('读 VITE_ECMDB_WEB_BASE 拼 /profile/index（新标签页，基址尾斜杠去除）', async () => {
        vi.stubEnv('VITE_ECMDB_WEB_BASE', 'http://localhost:9999/')
        await openProfileMenu()
        expect(window.open).toHaveBeenCalledWith('http://localhost:9999/profile/index', '_blank')
    })

    it('env 未注入时回退当前站点 origin（与拆分前行为一致）', async () => {
        vi.stubEnv('VITE_ECMDB_WEB_BASE', '')
        stubLocation('http://localhost:8888/cam/dashboard')
        await openProfileMenu()
        expect(window.open).toHaveBeenCalledWith('http://localhost:8888/profile/index', '_blank')
    })

    it('隐式耦合负断言：登录目标 VITE_LOGIN_TARGET 不参与基址，绝不落 /console/login/profile/index', async () => {
        vi.stubEnv('VITE_LOGIN_TARGET', '/console/login')
        vi.stubEnv('VITE_ECMDB_WEB_BASE', '')
        stubLocation('http://localhost:8888/cam/dashboard')
        await openProfileMenu()
        const calls = vi.mocked(window.open).mock.calls.map((args) => String(args[0]))
        expect(calls.length).toBeGreaterThan(0)
        for (const url of calls) {
            expect(url).not.toContain('/console/login/profile/index')
        }
    })
})
