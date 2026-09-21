// @vitest-environment happy-dom
/**
 * StateBlock 统一三态块单测（ui-unify-phase2-components 任务 1）：
 * 覆盖四态渲染与响应式切换（loading 骨架屏 / empty 空态 / error 错误态 / success 插槽）、
 * error 态错误信息与错误码/详情透传及 retry 事件、empty 态自定义文案/插画尺寸/图标插槽，
 * 以及 actions 操作插槽在空态与错误态的透传（覆盖 EmptyState/ErrorDisplay 既有能力）。
 */
import { mount } from '@vue/test-utils'
import { ElButton, ElEmpty, ElIcon, ElSkeleton } from 'element-plus'
import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'
import StateBlock from '../StateBlock/index.vue'
import type { StateBlockStatus } from '../StateBlock/index.vue'

interface MountOptions {
    status?: StateBlockStatus
    emptyText?: string
    emptyImageSize?: number
    skeletonRows?: number
    errorText?: string
    errorCode?: string | number
    errorDetail?: string
    retryText?: string
    /** 追加透传插槽（default 固定提供，actions/icon 按用例显式传入） */
    slots?: Record<string, string>
}

/** 挂载辅助：vitest 无 unplugin 自动注册，显式注册用到的 Element Plus 组件 */
async function mountBlock(opts: MountOptions = {}) {
    const { status, slots = {}, ...props } = opts
    const wrapper = mount(StateBlock, {
        props: { status, ...props },
        slots: {
            default: '<div class="success-content">列表内容</div>',
            ...slots,
        },
        global: {
            components: { ElSkeleton, ElEmpty, ElButton, ElIcon },
        },
    })
    await nextTick()
    return wrapper
}

describe('StateBlock 四态渲染', () => {
    it('success：渲染默认插槽内容，不渲染任何状态占位', async () => {
        const wrapper = await mountBlock({ status: 'success' })
        expect(wrapper.find('.success-content').exists()).toBe(true)
        expect(wrapper.find('.el-skeleton').exists()).toBe(false)
        expect(wrapper.find('.el-empty').exists()).toBe(false)
        expect(wrapper.find('.state-block__error-text').exists()).toBe(false)
    })

    it('loading：渲染 el-skeleton 骨架屏且行数透传，不渲染默认插槽', async () => {
        const wrapper = await mountBlock({ status: 'loading', skeletonRows: 2 })
        const skeleton = wrapper.find('.el-skeleton')
        expect(skeleton.exists()).toBe(true)
        expect(skeleton.classes()).toContain('is-animated')
        expect(wrapper.findAll('.el-skeleton__paragraph')).toHaveLength(2)
        expect(wrapper.find('.success-content').exists()).toBe(false)
    })

    it('empty：渲染 el-empty 默认插画与文案，未传 actions 时无底部操作区', async () => {
        const wrapper = await mountBlock({ status: 'empty' })
        expect(wrapper.find('.el-empty').exists()).toBe(true)
        expect(wrapper.text()).toContain('暂无数据')
        expect(wrapper.find('.el-empty__image svg').exists()).toBe(true)
        expect(wrapper.find('.el-empty__bottom').exists()).toBe(false)
    })

    it('empty：支持自定义文案与插画尺寸', async () => {
        const wrapper = await mountBlock({ status: 'empty', emptyText: '暂无主机', emptyImageSize: 160 })
        expect(wrapper.text()).toContain('暂无主机')
        expect(wrapper.find('.el-empty__image').attributes('style')).toContain('width: 160px')
    })

    it('error：默认渲染错误信息与重试按钮，未传错误码/详情时不渲染补充行', async () => {
        const wrapper = await mountBlock({ status: 'error' })
        expect(wrapper.find('.state-block__error-text').text()).toBe('操作失败')
        expect(wrapper.find('button.state-block__retry').exists()).toBe(true)
        expect(wrapper.find('.state-block__error-meta').exists()).toBe(false)
    })

    it('error：错误码与错误详情透传渲染，支持自定义错误文案', async () => {
        const wrapper = await mountBlock({
            status: 'error',
            errorText: '资产列表加载失败',
            errorCode: 500,
            errorDetail: '请求地址: /api/assets',
        })
        expect(wrapper.find('.state-block__error-text').text()).toBe('资产列表加载失败')
        expect(wrapper.text()).toContain('错误代码: 500')
        expect(wrapper.text()).toContain('请求地址: /api/assets')
        expect(wrapper.findAll('.state-block__error-meta')).toHaveLength(2)
    })
})

describe('StateBlock 交互与状态切换', () => {
    it('error 态点击重试按钮 emit retry，支持自定义按钮文案', async () => {
        const wrapper = await mountBlock({ status: 'error' })
        expect(wrapper.text()).toContain('重试')
        await wrapper.find('button.state-block__retry').trigger('click')
        expect(wrapper.emitted('retry')).toHaveLength(1)

        const custom = await mountBlock({ status: 'error', retryText: '重新加载' })
        expect(custom.text()).toContain('重新加载')
        await custom.find('button.state-block__retry').trigger('click')
        expect(custom.emitted('retry')).toHaveLength(1)
    })

    it('status 响应式切换：loading → success → error → empty', async () => {
        const wrapper = await mountBlock({ status: 'loading' })
        expect(wrapper.find('.el-skeleton').exists()).toBe(true)
        await wrapper.setProps({ status: 'success' })
        expect(wrapper.find('.success-content').exists()).toBe(true)
        await wrapper.setProps({ status: 'error' })
        expect(wrapper.find('button.state-block__retry').exists()).toBe(true)
        await wrapper.setProps({ status: 'empty' })
        expect(wrapper.find('.el-empty').exists()).toBe(true)
        expect(wrapper.find('.el-skeleton').exists()).toBe(false)
    })

    it('actions 插槽在 empty 与 error 态渲染，success 态不渲染', async () => {
        const action = '<button class="block-action">添加</button>'
        const empty = await mountBlock({ status: 'empty', slots: { actions: action } })
        expect(empty.find('.el-empty__bottom .block-action').exists()).toBe(true)
        const error = await mountBlock({ status: 'error', slots: { actions: action } })
        expect(error.find('.state-block__actions .block-action').exists()).toBe(true)
        const success = await mountBlock({ status: 'success', slots: { actions: action } })
        expect(success.find('.block-action').exists()).toBe(false)
    })

    it('icon 插槽替换空态默认插画', async () => {
        const wrapper = await mountBlock({
            status: 'empty',
            slots: { icon: '<span class="block-icon">自定义图标</span>' },
        })
        expect(wrapper.find('.el-empty__image .block-icon').exists()).toBe(true)
        expect(wrapper.find('.el-empty__image svg').exists()).toBe(false)
    })
})
