import vueTsEslintConfig from '@vue/eslint-config-typescript'
import pluginVue from 'eslint-plugin-vue'

export default [
    {
        // iconfont 生成物（iconfont.cn 原始下载 + trim-iconfont 产物）不参与 lint：
        // 会被 scripts/trim-iconfont.mjs 整体再生成，人工修改无意义
        ignores: [
            'dist/**',
            'node_modules/**',
            'coverage/**',
            '**/*.d.ts',
            'public/**',
            'scripts/iconfont-source/**',
            'src/assets/iconfont/iconfont.js',
        ],
    },
    ...pluginVue.configs['flat/essential'],
    ...vueTsEslintConfig(),
    {
        rules: {
            'vue/multi-word-component-names': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            // '_'-前缀参数是约定占位（如 sendToServer(_logEntry) 预留日志服务接入）
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
        },
    },
]
