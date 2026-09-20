// @vitest-environment happy-dom
/**
 * 共享导出弹窗 AssetExportDialog 单测（export-dialog-consolidation 任务 1）：
 * 覆盖范围解析三态（current/selected/all）、csv/xlsx 内容生成（BOM+引号转义）、
 * fetchAllRows 全量拉取进度回调、失败降级（ElMessage.error 且不关闭弹窗）、
 * 未提供 fetchAllRows 时 all 退回当前页，以及范围按钮禁用与字段全选/取消全选。
 */
import { flushPromises, mount } from '@vue/test-utils'
import { ElButton, ElCheckbox, ElCheckboxGroup, ElIcon, ElMessage, ElRadioGroup } from 'element-plus'
import { defineComponent, h, nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Asset } from '@/api/types/asset'
import AssetExportDialog from '../AssetExportDialog.vue'
import type { ExportFieldConfig } from '../AssetExportDialog.vue'

/** downloadFile 落盘产物捕获（Blob 内容 + 下载文件名） */
let lastBlob: Blob | null = null
let lastAnchor: HTMLAnchorElement | null = null

/** 转义字符统一经 fromCharCode 构造，避免源码内隐式字符歧义 */
const BOM = String.fromCharCode(0xfeff)
const TAB = String.fromCharCode(9)
const NL = String.fromCharCode(10)

/** el-dialog 替身：modelValue 为真时渲染默认+footer 插槽，规避 overlay/teleport */
const ElDialogStub = defineComponent({
    name: 'ElDialog',
    props: { modelValue: { type: Boolean, default: false } },
    setup(props, { slots }) {
        return () => (props.modelValue ? h('div', { class: 'el-dialog-stub' }, [slots.default?.(), slots.footer?.()]) : null)
    },
})

function makeAsset(id: number, name: string, status: string): Asset {
    return {
        id,
        asset_id: `i-${id}`,
        asset_name: name,
        asset_type: 'ecs',
        tenant_id: 't-1',
        account_id: 1,
        provider: 'aliyun',
        region: 'cn-hangzhou',
        status,
        attributes: { status },
        create_time: 0,
        update_time: 0,
    }
}

/** 名称含双引号，用于断言 csv/xlsx 的 `""` 转义 */
const makeAssets = () => [
    makeAsset(1, '名称"一"', 'RUNNING'),
    makeAsset(2, '名称二', 'RUNNING'),
    makeAsset(3, '名称三', 'STOPPED'),
]

const config: ExportFieldConfig = {
    fields: [
        { key: 'asset_id', label: '云上ID' },
        { key: 'asset_name', label: '名称' },
        { key: 'status', label: '状态' },
    ],
    getValue: (row, key) => {
        if (key === 'asset_id') return row.asset_id
        if (key === 'asset_name') return row.asset_name
        return String(row.attributes?.[key] ?? '')
    },
    filename: '测试资源',
    defaultFields: ['asset_id', 'asset_name', 'status'],
}

interface MountOptions {
    instances?: Asset[]
    selectedIds?: number[]
    total?: number
    fetchAllRows?: (onProgress?: (fetched: number, total: number) => void) => Promise<Asset[]>
}

async function mountDialog(opts: MountOptions = {}) {
    const wrapper = mount(AssetExportDialog, {
        props: {
            visible: true,
            instances: opts.instances ?? makeAssets(),
            selectedIds: opts.selectedIds ?? [],
            total: opts.total ?? 100,
            config,
            fetchAllRows: opts.fetchAllRows,
        },
        global: {
            // vitest 无 unplugin 自动注册，显式注册；el-dialog 用替身规避 overlay/teleport
            components: {
                ElDialog: ElDialogStub,
                ElButton,
                ElRadioGroup,
                ElCheckboxGroup,
                ElCheckbox,
                ElIcon,
            },
        },
    })
    await nextTick()
    return wrapper
}

type DialogWrapper = Awaited<ReturnType<typeof mountDialog>>

/** 找文本精确匹配的按钮（icon 混排导致 text 带空白） */
function findButton(wrapper: DialogWrapper, text: string) {
    const btn = wrapper.findAll('button').find((b) => b.text().trim() === text)
    expect(btn, `按钮「${text}」应存在`).toBeDefined()
    return btn!
}

function currentYmd() {
    const now = new Date()
    return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
}

async function exportedText() {
    await flushPromises()
    expect(lastBlob, '导出应产出 Blob').not.toBeNull()
    return (lastBlob as Blob).text()
}

beforeEach(() => {
    lastBlob = null
    lastAnchor = null
    Object.defineProperty(URL, 'createObjectURL', {
        value: vi.fn((blob: Blob) => {
            lastBlob = blob
            return 'blob:mock'
        }),
        configurable: true,
    })
    Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true })
    // 捕获 downloadFile 创建的 <a> 以断言文件名（不 mock 其行为，保留真实点击链路）
    const realCreate = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
        const el = realCreate(tag)
        if (tag === 'a') lastAnchor = el as HTMLAnchorElement
        return el
    }) as unknown as typeof document.createElement)
    // ElMessage 替身：避免 happy-dom 下渲染消息体，且便于断言失败降级文案
    const handler = { close: () => {} } as never
    vi.spyOn(ElMessage, 'success').mockImplementation(() => handler)
    vi.spyOn(ElMessage, 'error').mockImplementation(() => handler)
    vi.spyOn(ElMessage, 'warning').mockImplementation(() => handler)
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe('AssetExportDialog 范围解析三态', () => {
    it('current：默认导出当前页全量行（xlsx，BOM + 制表符 + 引号转义）', async () => {
        const wrapper = await mountDialog()
        expect(wrapper.text()).toContain('共计 3 条')
        await findButton(wrapper, '导出').trigger('click')
        const text = await exportedText()
        const expected = [
            [BOM + '"云上ID"', '"名称"', '"状态"'].join(TAB),
            ['"i-1"', '"名称""一"""', '"RUNNING"'].join(TAB),
            ['"i-2"', '"名称二"', '"RUNNING"'].join(TAB),
            ['"i-3"', '"名称三"', '"STOPPED"'].join(TAB),
        ].join(NL)
        expect(text).toBe(expected)
        expect((lastBlob as Blob).type).toBe('application/vnd.ms-excel;charset=utf-8')
        expect(lastAnchor?.download).toBe(`测试资源_${currentYmd()}.xlsx`)
        expect(vi.mocked(ElMessage.success)).toHaveBeenCalledWith('导出成功')
        expect(wrapper.emitted('update:visible')?.at(-1)).toEqual([false])
    })

    it('selected：仅导出 selectedIds 命中的行（打开时自动选中该范围）', async () => {
        const wrapper = await mountDialog({ selectedIds: [1, 3] })
        expect(wrapper.text()).toContain('共计 2 条')
        await findButton(wrapper, '导出').trigger('click')
        const text = await exportedText()
        expect(text).toContain('"i-1"')
        expect(text).toContain('"i-3"')
        expect(text).not.toContain('"i-2"')
    })

    it('all：经 fetchAllRows 全量拉取并导出拉取结果', async () => {
        const allRows = [makeAsset(11, '全量甲', 'RUNNING'), makeAsset(12, '全量乙', 'STOPPED')]
        const fetchAll = vi.fn(async () => allRows)
        const wrapper = await mountDialog({ fetchAllRows: fetchAll, total: 2 })
        await findButton(wrapper, '全部数据').trigger('click')
        expect(wrapper.find('.scope-btn.active').text()).toContain('全部数据')
        expect(wrapper.text()).toContain('共计 2 条')
        await findButton(wrapper, '导出').trigger('click')
        const text = await exportedText()
        expect(fetchAll).toHaveBeenCalledTimes(1)
        expect(text).toContain('"全量甲"')
        expect(text).toContain('"全量乙"')
        expect(text).not.toContain('"i-1"')
    })
})

describe('AssetExportDialog fetchAllRows 进度与降级', () => {
    it('进度回调：拉取中显示行内进度并禁用导出按钮，完成后关闭弹窗', async () => {
        let resolveAll!: (rows: Asset[]) => void
        const fetchAll = vi.fn((onProgress?: (fetched: number, total: number) => void) => {
            onProgress?.(5, 10)
            return new Promise<Asset[]>((resolve) => {
                resolveAll = resolve
            })
        })
        const wrapper = await mountDialog({ fetchAllRows: fetchAll })
        await findButton(wrapper, '全部数据').trigger('click')
        await findButton(wrapper, '导出').trigger('click')
        await nextTick()
        expect(wrapper.text()).toContain('正在获取全量数据 5/10')
        expect(findButton(wrapper, '导出').attributes('disabled')).toBeDefined()
        resolveAll([makeAsset(11, '全量甲', 'RUNNING')])
        await flushPromises()
        expect(wrapper.text()).not.toContain('正在获取全量数据')
        expect(vi.mocked(ElMessage.success)).toHaveBeenCalledWith('导出成功')
        expect(wrapper.emitted('update:visible')?.at(-1)).toEqual([false])
    })

    it('失败降级：reject Error 时 ElMessage.error 透出 message 且弹窗不关闭', async () => {
        const fetchAll = vi.fn(async () => {
            throw new Error('后端超时')
        })
        const wrapper = await mountDialog({ fetchAllRows: fetchAll })
        await findButton(wrapper, '全部数据').trigger('click')
        await findButton(wrapper, '导出').trigger('click')
        await flushPromises()
        expect(vi.mocked(ElMessage.error)).toHaveBeenCalledWith('后端超时')
        expect(wrapper.emitted('update:visible')).toBeUndefined()
        // 失败后状态复位：进度文案消失，导出按钮恢复可用
        expect(wrapper.text()).not.toContain('正在获取全量数据')
        expect(findButton(wrapper, '导出').attributes('disabled')).toBeUndefined()
    })

    it('失败降级：reject 非 Error 时提示兜底文案', async () => {
        const fetchAll = vi.fn(async () => {
            throw 'unknown'
        })
        const wrapper = await mountDialog({ fetchAllRows: fetchAll })
        await findButton(wrapper, '全部数据').trigger('click')
        await findButton(wrapper, '导出').trigger('click')
        await flushPromises()
        expect(vi.mocked(ElMessage.error)).toHaveBeenCalledWith('全量数据获取失败，请重试')
        expect(wrapper.emitted('update:visible')).toBeUndefined()
    })

    it('未提供 fetchAllRows：all 范围退回当前页数据', async () => {
        const wrapper = await mountDialog({ total: 100 })
        await findButton(wrapper, '全部数据').trigger('click')
        expect(wrapper.text()).toContain('共计 100 条')
        await findButton(wrapper, '导出').trigger('click')
        const text = await exportedText()
        expect(text).toContain('"i-1"')
        expect(text).toContain('"i-2"')
        expect(text).toContain('"i-3"')
    })
})

describe('AssetExportDialog 格式与字段交互', () => {
    it('csv：格式卡切换后导出逗号分隔 + text/csv 类型 + .csv 文件名', async () => {
        const wrapper = await mountDialog()
        const csvCard = wrapper.findAll('.format-card')[1]
        expect(csvCard, 'CSV 格式卡应存在').toBeDefined()
        await csvCard!.trigger('click')
        await findButton(wrapper, '导出').trigger('click')
        const text = await exportedText()
        const expected = [
            [BOM + '云上ID', '名称', '状态'].join(','),
            ['"i-1"', '"名称""一"""', '"RUNNING"'].join(','),
            ['"i-2"', '"名称二"', '"RUNNING"'].join(','),
            ['"i-3"', '"名称三"', '"STOPPED"'].join(','),
        ].join(NL)
        expect(text).toBe(expected)
        expect((lastBlob as Blob).type).toBe('text/csv;charset=utf-8')
        expect(lastAnchor?.download).toBe(`测试资源_${currentYmd()}.csv`)
    })

    it('已选中无数据时范围按钮禁用；取消全选禁用导出、全选恢复', async () => {
        const wrapper = await mountDialog()
        expect(findButton(wrapper, '已选中数据').attributes('disabled')).toBeDefined()
        await findButton(wrapper, '取消全选').trigger('click')
        expect(findButton(wrapper, '导出').attributes('disabled')).toBeDefined()
        await findButton(wrapper, '全选').trigger('click')
        expect(findButton(wrapper, '导出').attributes('disabled')).toBeUndefined()
    })
})
