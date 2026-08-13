<script setup lang="ts">
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import {
    assignRoles,
    assignUserTenants,
    createUser,
    listRoles,
    listRolesForUser,
    listTenants,
    listTenantsForUser,
    unassignRoles,
    unassignUserTenants,
    updateUser,
} from '@/api/eiam-users'
import { diffSets } from '@/api/eiam-mapper'
import type {
    CreateEiamUserRequest,
    EiamRole,
    EiamUser,
    UpdateEiamUserRequest,
} from '@/api/types/eiam'
import type { EiamTenant } from '@/stores/user-mapper'

const emit = defineEmits<{ (e: 'success'): void }>()

const visible = ref(false)
const submitting = ref(false)
const mode = ref<'create' | 'edit'>('create')
const allRoles = ref<EiamRole[]>([])
const allTenants = ref<EiamTenant[]>([])
const optionsLoading = ref(false)
/** 租户选项加载失败（通常是当前会话不在系统管理空间 → tenant/list 403） */
const tenantsLoadError = ref(false)

/** 编辑态下，打开时快照的角色 code / 租户 id，用于 submit 时 diff */
const initialRoleCodes = ref<string[]>([])
const initialTenantIds = ref<number[]>([])

/** 当前编辑的用户（edit 模式下携带 id 与 username） */
const editing = ref<EiamUser | null>(null)

const formRef = ref<FormInstance>()

const formData = reactive({
    username: '',
    password: '',
    confirmPassword: '',
    nickname: '',
    email: '',
    phone: '',
    jobTitle: '',
    status: 'active' as 'active' | 'disable',
    roleCodes: [] as string[],
    tenantIds: [] as number[],
})

const rules: FormRules = {
    username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
    password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
    confirmPassword: [
        { required: true, message: '请再次输入密码', trigger: 'blur' },
        {
            validator: (_r, value, cb) => {
                if (value !== formData.password) cb(new Error('两次输入的密码不一致'))
                else cb()
            },
            trigger: 'blur',
        },
    ],
}

function resetForm() {
    formData.username = ''
    formData.password = ''
    formData.confirmPassword = ''
    formData.nickname = ''
    formData.email = ''
    formData.phone = ''
    formData.jobTitle = ''
    formData.status = 'active'
    formData.roleCodes = []
    formData.tenantIds = []
    initialRoleCodes.value = []
    initialTenantIds.value = []
    editing.value = null
    formRef.value?.clearValidate()
}

async function loadOptions() {
    optionsLoading.value = true
    // 角色 / 租户各自独立加载：租户列表属系统级接口，当前会话不在系统管理空间时会 403，
    // 不应让租户失败连累已成功加载的角色选项。
    tenantsLoadError.value = false
    allRoles.value = []
    allTenants.value = []
    try {
        const roles = await listRoles({ offset: 0, limit: 200 })
        allRoles.value = roles.roles
    } catch (e) {
        ElMessage.error('加载角色选项失败：' + (e as Error).message)
    }
    try {
        const tenants = await listTenants({ offset: 0, limit: 200 })
        allTenants.value = tenants.tenants
    } catch {
        // tenant/list 仅系统管理空间可调；非系统租户下静默置空，由页面提示条告知用户
        tenantsLoadError.value = true
    } finally {
        optionsLoading.value = false
    }
}

/** 新建：重置后打开 */
async function openCreate() {
    mode.value = 'create'
    resetForm()
    visible.value = true
    await loadOptions()
}

/** 编辑：填入既有字段并加载该用户当前角色/租户 */
async function openEdit(user: EiamUser) {
    mode.value = 'edit'
    resetForm()
    editing.value = user
    formData.username = user.username
    formData.nickname = user.nickname
    formData.email = user.email
    formData.phone = user.phone
    formData.jobTitle = user.jobTitle
    formData.status = user.status === 'disable' ? 'disable' : 'active'
    visible.value = true
    await loadOptions()
    try {
        const [roles, tenants] = await Promise.all([
            listRolesForUser(user.id),
            listTenantsForUser(user.id),
        ])
        const rc = roles.map((r) => r.code)
        const ti = tenants.map((t) => t.id)
        formData.roleCodes = rc
        formData.tenantIds = ti
        // 快照，供 submit diff
        initialRoleCodes.value = [...rc]
        initialTenantIds.value = [...ti]
    } catch (e) {
        ElMessage.error('加载用户当前角色/租户失败：' + (e as Error).message)
    }
}

async function handleSubmit() {
    if (!formRef.value) return
    const valid = await formRef.value.validate().catch(() => false)
    if (!valid) return

    submitting.value = true
    try {
        if (mode.value === 'create') {
            await runCreate()
        } else {
            await runEdit()
        }
        ElMessage.success(mode.value === 'create' ? '创建成功' : '更新成功')
        visible.value = false
        emit('success')
    } catch (e) {
        ElMessage.error((e as Error).message || '操作失败')
    } finally {
        submitting.value = false
    }
}

async function runCreate() {
    const payload: CreateEiamUserRequest = {
        username: formData.username,
        password: formData.password,
        confirm_password: formData.confirmPassword,
        nickname: formData.nickname || undefined,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        job_title: formData.jobTitle || undefined,
        status: formData.status,
    }
    const newId = await createUser(payload)

    // 角色：以 username 分配
    if (formData.roleCodes.length) {
        await assignRoles([formData.username], formData.roleCodes)
    }
    // 租户：以 user_id(int64) 分配；eiam 已自动加入创建者租户
    if (formData.tenantIds.length) {
        await assignUserTenants([newId], formData.tenantIds)
    }
}

async function runEdit() {
    const user = editing.value
    if (!user) return

    const payload: UpdateEiamUserRequest = {
        id: user.id,
        nickname: formData.nickname || undefined,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        job_title: formData.jobTitle || undefined,
        status: formData.status,
    }
    await updateUser(payload)

    // 角色 diff（以 username + role_code）
    const roleDiff = diffSets(initialRoleCodes.value, formData.roleCodes)
    if (roleDiff.added.length) await assignRoles([user.username], roleDiff.added)
    if (roleDiff.removed.length) await unassignRoles([user.username], roleDiff.removed)

    // 租户 diff（以 user_id + tenant_id）
    const tenantDiff = diffSets(initialTenantIds.value, formData.tenantIds)
    if (tenantDiff.added.length) await assignUserTenants([user.id], tenantDiff.added)
    if (tenantDiff.removed.length) await unassignUserTenants([user.id], tenantDiff.removed)
}

defineExpose({ openCreate, openEdit })
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="mode === 'create' ? '创建平台用户' : '编辑平台用户'"
    width="560px"
    :close-on-click-modal="false"
    destroy-on-close
  >
    <el-form
      ref="formRef"
      :model="formData"
      :rules="rules"
      label-width="90px"
      label-position="right"
    >
      <el-form-item label="用户名" prop="username">
        <el-input
          v-model="formData.username"
          placeholder="登录用户名"
          :disabled="mode === 'edit'"
        />
      </el-form-item>

      <template v-if="mode === 'create'">
        <el-form-item label="密码" prop="password">
          <el-input v-model="formData.password" type="password" show-password placeholder="初始密码" />
        </el-form-item>
        <el-form-item label="确认密码" prop="confirmPassword">
          <el-input v-model="formData.confirmPassword" type="password" show-password placeholder="再次输入" />
        </el-form-item>
      </template>

      <el-form-item label="昵称">
        <el-input v-model="formData.nickname" placeholder="显示名称" />
      </el-form-item>
      <el-form-item label="邮箱">
        <el-input v-model="formData.email" placeholder="email@example.com" />
      </el-form-item>
      <el-form-item label="手机号">
        <el-input v-model="formData.phone" placeholder="手机号" />
      </el-form-item>
      <el-form-item label="职位">
        <el-input v-model="formData.jobTitle" placeholder="职位 / 头衔" />
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="formData.status">
          <el-option label="启用" value="active" />
          <el-option label="禁用" value="disable" />
        </el-select>
      </el-form-item>

      <el-form-item label="角色">
        <el-select
          v-model="formData.roleCodes"
          multiple
          filterable
          clearable
          placeholder="为该用户分配角色"
          style="width: 100%"
          :loading="optionsLoading"
        >
          <el-option
            v-for="r in allRoles"
            :key="r.code"
            :label="r.name + (r.desc ? `（${r.desc}）` : '')"
            :value="r.code"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="租户">
        <el-select
          v-model="formData.tenantIds"
          multiple
          filterable
          clearable
          :placeholder="tenantsLoadError ? '租户列表不可用，需切换到系统管理空间' : '将该用户加入哪些租户'"
          style="width: 100%"
          :loading="optionsLoading"
          :disabled="tenantsLoadError"
        >
          <el-option
            v-for="t in allTenants"
            :key="t.id"
            :label="t.name + (t.code ? `（${t.code}）` : '')"
            :value="t.id"
          />
        </el-select>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">
        {{ mode === 'create' ? '创建' : '保存' }}
      </el-button>
    </template>
  </el-dialog>
</template>
