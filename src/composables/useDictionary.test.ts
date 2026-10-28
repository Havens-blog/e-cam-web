// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

const getDictByCodeApi = vi.fn()
const batchGetDictByCodesApi = vi.fn()

vi.mock('@/api/dictionary', () => ({
    getDictByCodeApi: (...args: unknown[]) => getDictByCodeApi(...args),
    batchGetDictByCodesApi: (...args: unknown[]) => batchGetDictByCodesApi(...args),
}))

describe('useDictionary', () => {
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

    it('getDictLabel 能按 value 取到中文标签', async () => {
        const { useDictionary } = await import('./useDictionary')
        const { loadDict, getDictLabel } = useDictionary()
        getDictByCodeApi.mockResolvedValue({ data: [{ value: 'create', label: '创建' }] })
        await loadDict('op_label_test')
        expect(getDictLabel('op_label_test', 'create')).toBe('创建')
        expect(getDictLabel('op_label_test', 'missing')).toBe('missing')
    })
})
