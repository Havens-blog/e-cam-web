/**
 * **提交契约守卫**：前端各表单提交的字段名，必须覆盖后端 VO 的 `binding:"required"` 字段。
 *
 * 由来（2026-11-01，一条线上连中两次）：
 *  - `accounts/form.vue` 的区域规则挂在**无人绑定**的 `region` 上 ⇒ 后端 `Regions required,min=1` 只能靠 400 兜住；
 *  - `iam/sync` 创建任务漏发 `target_type`/`provider` ⇒ 直接 400（另见 Issue #192，语义待确认）；
 *  - `iam/users` 的 `permission_groups` vs 后端 `user_groups` ⇒ **组分配静默丢弃**（写读两侧，见 #194）。
 * 这些都是"前端提交字段 ≠ 后端校验契约"，且**代码检查不报、构建不报、单测也未必报**。
 *
 * 本守卫用源码扫描把"必须发出去的字段"钉住。新增/修改表单时若漏字段，这里会先红。
 * 后端对应契约（grep 可复核）：
 *  - alert/web/vo.go            CreateRuleReq   {name, type, channel_ids}
 *  - alert/web/vo.go            CreateChannelReq{name, type, config}
 *  - iam/web/vo.go              CreateUserGroupVO{name, cloud_platforms(min=1)}
 *  - iam/web/vo.go              CreateUserVO     {username, user_type, cloud_account_id}
 *  - cam/dns/domain.go          CreateRecordReq  {account_id, rr, type, value}
 *  - cam/template/domain.go     DirectProvisionReq{provider, cloud_account_id, region, instance_type, count}
 *  - cam/domain/account.go      Regions required,min=1（账户表单绑定字段为 regions）
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), 'utf8')

/** 断言某文件（表单）里出现了这些"提交字段"（形如 `key:` 或 `key =`）。 */
function expectFieldsIn(file: string, fields: string[]) {
    const src = read(file)
    for (const f of fields) {
        const re = new RegExp(`(^|[^\\w.])${f}\\s*[:=]`, 'm')
        expect(re.test(src), `${file} 未找到提交字段 ${f}（后端绑定为 required）`).toBe(true)
    }
}

describe('提交契约守卫：前端表单字段 ⊇ 后端 required', () => {
    it('告警规则：name / type / channel_ids', () => {
        expectFieldsIn('src/views/alert/rules/components/RuleFormDialog.vue', ['name', 'type', 'channel_ids'])
    })

    it('告警渠道：name / type / config', () => {
        expectFieldsIn('src/views/alert/channels/components/ChannelFormDialog.vue', ['name', 'type', 'config'])
    })

    it('IAM 权限组：name / cloud_platforms', () => {
        expectFieldsIn('src/views/iam/groups/components/GroupForm.vue', ['name', 'cloud_platforms'])
    })

    it('IAM 用户：username / user_type / cloud_account_id', () => {
        expectFieldsIn('src/views/iam/users/components/UserForm.vue', ['username', 'user_type', 'cloud_account_id'])
    })

    it('DNS 记录：account_id / rr / type / value', () => {
        expectFieldsIn('src/views/network/dns/components/RecordFormDialog.vue', ['account_id', 'rr', 'type', 'value'])
    })

    it('直接开通主机：provider / cloud_account_id / region / instance_type / count', () => {
        expectFieldsIn('src/views/compute/provision/index.vue', ['provider', 'cloud_account_id', 'region', 'instance_type', 'count'])
    })

    it('云账号：区域校验必须绑定表单字段 regions（后端 Regions required,min=1）', () => {
        const src = read('src/views/accounts/form.vue')
        expect(src).toMatch(/prop="regions"/)
        expect(read('src/utils/constants.ts')).toMatch(/regions:\s*\[\{\s*required:\s*true/)
    })

    it('云账号创建：选了区域时必须发 regions（后端 Regions required,min=1）', () => {
        const src = read('src/views/accounts/form.vue')
        expect(src).toMatch(/createData\.regions\s*=\s*formData\.regions/)
    })
})
