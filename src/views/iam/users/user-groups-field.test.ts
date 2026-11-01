/**
 * IAM 用户「用户组」字段名的**读写边界**静态守卫。
 *
 * 背景（2026-11-01 实测）：后端 `/iam/users` 的请求 VO 字段名是 **`user_groups`**、响应也返回 `user_groups`；
 * 而前端曾在**两侧**都写成 `permission_groups`：
 *  - 写侧：`createUserApi/updateUserApi` 的载荷字段名不匹配 ⇒ 用户组分配被**静默丢弃**；
 *  - 读侧：列表/详情模板读 `user.permission_groups` ⇒ 明明有组也显示为空；
 *  - 且编辑弹窗预选为空 ⇒ 一旦修好写侧就会变成"静默清空"，因此两侧必须同时修。
 *
 * 本用例用源码扫描把边界钉住（服务端已有同类做法：internal/shared/daocheck）。
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), 'utf8')

describe('IAM 用户组字段名边界（静态守卫）', () => {
    it('写侧：UserForm 的创建/更新载荷必须使用 user_groups', () => {
        const src = read('src/views/iam/users/components/UserForm.vue')
        expect(src).toMatch(/user_groups:\s*formData\.permission_groups/)
        // 不得再出现"直接把 permission_groups 当接口字段发出"的写法
        expect(src).not.toMatch(/permission_groups:\s*formData\.permission_groups/)
    })

    it('写侧：users/detail.vue 的权限组保存必须使用 user_groups', () => {
        const src = read('src/views/iam/users/detail.vue')
        expect(src).toMatch(/user_groups:\s*selectedGroups\.value/)
        expect(src).not.toMatch(/permission_groups:\s*selectedGroups\.value/)
    })

    it('读侧：列表/详情/预选一律走 userPermissionGroups（user_groups 优先，历史字段兜底）', () => {
        for (const f of [
            'src/views/iam/users/components/UserTable.vue',
            'src/views/iam/users/components/UserForm.vue',
            'src/views/iam/users/detail.vue',
            'src/views/iam/users/index.vue',
        ]) {
            expect(read(f), `${f} 未使用 helper`).toMatch(/userPermissionGroups/)
        }
    })

    it('helper 自身：user_groups 优先，permission_groups 兜底', () => {
        const src = read('src/utils/display-fallbacks.ts')
        expect(src).toMatch(/Array\.isArray\(user\?\.user_groups\)/)
        expect(src).toMatch(/Array\.isArray\(user\?\.permission_groups\)/)
    })
})
