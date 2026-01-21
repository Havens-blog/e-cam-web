<template>
  <el-form ref="formRef" :model="form" :rules="rules" label-width="100px" class="instance-form">
    <el-form-item label="模型" prop="uid">
      <el-select
        v-model="form.uid"
        placeholder="请选择模型"
        filterable
        :disabled="isEdit"
        style="width: 100%"
      >
        <el-option
          v-for="model in models"
          :key="model.uid"
          :label="model.name"
          :value="model.uid"
        />
      </el-select>
    </el-form-item>

    <el-form-item label="资产ID" prop="asset_id">
      <el-input
        v-model="form.asset_id"
        placeholder="云厂商资产ID，如 i-bp1234567890"
        :disabled="isEdit"
      />
    </el-form-item>

    <el-form-item label="资产名称" prop="asset_name">
      <el-input v-model="form.asset_name" placeholder="资产名称" />
    </el-form-item>

    <el-form-item label="租户ID" prop="tenant_id">
      <el-input
        v-model="form.tenant_id"
        placeholder="租户ID"
        :disabled="isEdit"
      />
    </el-form-item>

    <el-form-item label="云账号ID" prop="account_id">
      <el-input-number
        v-model="form.account_id"
        :min="0"
        placeholder="云账号ID"
        style="width: 100%"
        controls-position="right"
      />
    </el-form-item>

    <el-divider content-position="left">动态属性</el-divider>

    <div class="attributes-editor">
      <div v-for="(attr, index) in attributeList" :key="index" class="attr-row">
        <el-input v-model="attr.key" placeholder="属性名" class="attr-key" />
        <el-input v-model="attr.value" placeholder="属性值" class="attr-value" />
        <el-button type="danger" text @click="removeAttribute(index)">
          <el-icon><Delete /></el-icon>
        </el-button>
      </div>
      <el-button type="primary" text @click="addAttribute">
        <el-icon><Plus /></el-icon>
        添加属性
      </el-button>
    </div>
  </el-form>
</template>

<script setup lang="ts">
import { createCmdbInstanceApi, updateCmdbInstanceApi } from '@/api'
import type { InstanceVO, ModelVO } from '@/api/types/cmdb'
import { Delete, Plus } from '@element-plus/icons-vue'
import type { FormInstance, FormRules } from 'element-plus'
import { reactive, ref, watch } from 'vue'

const props = defineProps<{
  instance: InstanceVO | null
  isEdit: boolean
  models: ModelVO[]
}>()

const formRef = ref<FormInstance>()

const form = reactive({
  uid: '',
  asset_id: '',
  asset_name: '',
  tenant_id: '',
  account_id: undefined as number | undefined,
})

const attributeList = ref<{ key: string; value: string }[]>([])

const rules: FormRules = {
  uid: [{ required: true, message: '请选择模型', trigger: 'change' }],
  asset_id: [{ required: true, message: '请输入资产ID', trigger: 'blur' }],
  tenant_id: [{ required: true, message: '请输入租户ID', trigger: 'blur' }],
}

// 监听实例变化，填充表单
watch(
  () => props.instance,
  (val) => {
    if (val) {
      form.uid = val.uid
      form.asset_id = val.asset_id
      form.asset_name = val.asset_name || ''
      form.tenant_id = val.tenant_id
      form.account_id = val.account_id

      // 解析属性
      if (val.attributes) {
        attributeList.value = Object.entries(val.attributes).map(([key, value]) => ({
          key,
          value: typeof value === 'object' ? JSON.stringify(value) : String(value),
        }))
      } else {
        attributeList.value = []
      }
    } else {
      reset()
    }
  },
  { immediate: true }
)

const addAttribute = () => {
  attributeList.value.push({ key: '', value: '' })
}

const removeAttribute = (index: number) => {
  attributeList.value.splice(index, 1)
}

const buildAttributes = () => {
  const attrs: Record<string, any> = {}
  attributeList.value.forEach(({ key, value }) => {
    if (key.trim()) {
      // 尝试解析 JSON
      try {
        attrs[key.trim()] = JSON.parse(value)
      } catch {
        attrs[key.trim()] = value
      }
    }
  })
  return attrs
}

const submit = async () => {
  await formRef.value?.validate()

  const attributes = buildAttributes()

  if (props.isEdit && props.instance) {
    await updateCmdbInstanceApi(props.instance.id, {
      asset_name: form.asset_name || undefined,
      attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
    })
  } else {
    await createCmdbInstanceApi({
      uid: form.uid,
      asset_id: form.asset_id,
      asset_name: form.asset_name || undefined,
      tenant_id: form.tenant_id,
      account_id: form.account_id,
      attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
    })
  }
}

const reset = () => {
  form.uid = ''
  form.asset_id = ''
  form.asset_name = ''
  form.tenant_id = ''
  form.account_id = undefined
  attributeList.value = []
  formRef.value?.resetFields()
}

defineExpose({ submit, reset })
</script>

<style scoped lang="scss">
.instance-form {
  :deep(.el-divider__text) {
    font-size: 13px;
    color: var(--text-tertiary);
  }
}

.attributes-editor {
  padding: 0 0 0 100px;

  .attr-row {
    display: flex;
    gap: 8px;
    margin-bottom: 10px;

    .attr-key {
      width: 140px;
      flex-shrink: 0;
    }

    .attr-value {
      flex: 1;
    }
  }
}
</style>
