/**
 * 云账号表单校验规则的**字段名回归**。
 *
 * 背景（2026-10-31/11-01 实测）：`accountFormRules` 原来只给单数 **`region`** 配了 required，
 * 而 `views/accounts/form.vue` 真正绑定的是 **`regions`（多选数组）**：
 *   <el-form-item label="区域" prop="regions"> … v-model="formData.regions"
 * ⇒ 单数 `region` **没有任何输入绑定**，等于"区域不校验"：
 *   用户不选区域即可提交 ⇒ 创建接口因 SDK 的 `Regions binding:"required,min=1"` 返回 400，
 *   错误只能提交后由后端抛出，而不是在表单里即时提示。
 *
 * 本用例把"规则键 = 表单真正绑定的字段"这一不变式钉住，防止字段改名时校验悄悄失效。
 */
import { describe, expect, it } from 'vitest'
import { accountFormRules } from './constants'

describe('accountFormRules 字段名回归', () => {
    it('**回归**：区域规则必须挂在 `regions`（表单真正绑定的字段）上', () => {
        const rules = accountFormRules.regions as Array<Record<string, unknown>> | undefined
        expect(rules, '缺少 regions 规则 ⇒ 区域不校验').toBeDefined()
        // async-validator 对**数组值**的 required 判定按长度 ⇒ 空数组同样会被拦下
        expect(rules?.[0]?.required).toBe(true)
    })

    it('**回归**：不得再给无人绑定的单数 `region` 配规则（那属于"看似校验、实则无效"）', () => {
        expect((accountFormRules as Record<string, unknown>).region).toBeUndefined()
    })

    it('其余必填规则仍在（避免改名时误删）', () => {
        for (const key of ['name', 'provider', 'environment', 'access_key_id', 'access_key_secret']) {
            expect((accountFormRules as Record<string, unknown>)[key], `缺少 ${key} 规则`).toBeDefined()
        }
    })
})
