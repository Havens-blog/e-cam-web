// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

const getDictByCodeApi = vi.fn()
const batchGetDictByCodesApi = vi.fn()

vi.mock('@/api/dictionary', () => ({
    getDictByCodeApi: (...args: unknown[]) => getDictByCodeApi(...args),
    batchGetDictByCodesApi: (...args: unknown[]) => batchGetDictByCodesApi(...args),
}))

describe('useDictionary', () => {
    beforeEach(() => {
        // 模块级缓存跨用例共享：重置模块，避免后续同 code 用例命中旧缓存而假绿
        vi.resetModules()
    })

    it('loadDict 完成后 getDictOptions 会重算（缓存必须是响应式的）', async () => {
        const { useDictionary } = await import('./useDictionary')
        const { loadDict, getDictOptions } = useDictionary()
        const options = getDictOptions('operation_type_test')

        // 首次求值：字典尚未加载
        expect(options.value).toEqual([])

        getDictByCodeApi.mockResolvedValue({
            data: [
                { value: 'create', label: '创建' },
                { value: 'delete', label: '删除' },
            ],
        })

        await loadDict('operation_type_test')
        await nextTick()

        // 关键断言：加载完成后必须看到 2 项（普通 Map 会一直为空）
        expect(options.value).toEqual([
            { value: 'create', label: '创建' },
            { value: 'delete', label: '删除' },
        ])
    })

    it('loadDicts 批量加载后 getDictOptions 生效', async () => {
        const { useDictionary } = await import('./useDictionary')
        const { loadDicts, getDictOptions } = useDictionary()
        const options = getDictOptions('batch_code_test')
        expect(options.value).toEqual([])

        batchGetDictByCodesApi.mockResolvedValue({
            data: { batch_code_test: [{ value: 'a', label: 'A' }] },
        })
        await loadDicts(['batch_code_test'])
        await nextTick()
        expect(options.value).toEqual([{ value: 'a', label: 'A' }])
    })

    it('refreshDict 删除缓存后重新拉取并更新 options', async () => {
        const { useDictionary } = await import('./useDictionary')
        const { loadDict, getDictOptions, refreshDict } = useDictionary()
        const options = getDictOptions('refresh_code_test')

        getDictByCodeApi.mockResolvedValue({ data: [{ value: 'v1', label: '旧' }] })
        await loadDict('refresh_code_test')
        await nextTick()
        expect(options.value).toEqual([{ value: 'v1', label: '旧' }])

        getDictByCodeApi.mockResolvedValue({ data: [{ value: 'v2', label: '新' }] })
        await refreshDict('refresh_code_test')
        await nextTick()
        expect(options.value).toEqual([{ value: 'v2', label: '新' }])
    })

    it('getDictLabel 能按 value 取到中文标签', async () => {
        const { useDictionary } = await import('./useDictionary')
        const { loadDict, getDictLabel } = useDictionary()
        getDictByCodeApi.mockResolvedValue({ data: [{ value: 'create', label: '创建' }] })
        await loadDict('op_label_test')
        expect(getDictLabel('op_label_test', 'create')).toBe('创建')
        expect(getDictLabel('op_label_test', 'missing')).toBe('missing')
    })
})
