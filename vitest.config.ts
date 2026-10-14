import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
    plugins: [vue()],
    resolve: {
        alias: {
            '@': resolve(__dirname, 'src'),
        },
    },
    test: {
        globals: true,
        // 默认 node（既有纯函数用例零 DOM 依赖）；组件挂载用例以
        // `// @vitest-environment happy-dom` 文件级 pragma 切换（本配置不全局启用 DOM）。
        environment: 'node',
        // scripts/** 为构建/CI 脚本单测（gzip-budget 等，纯 node 无 DOM）；src 下
        // 组件挂载用例仍以 `// @vitest-environment happy-dom` 文件级 pragma 切换。
        include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs'],
        // 平台共享组件包 @haven/ui 的组件内显式 import 了 Element Plus 按需样式
        // （element-plus/es/components/*/style/css，语义等同原先由 ElementPlusResolver
        // 隐式引入的那一份）。这些 .css 由 node_modules 下的 element-plus 提供，vitest
        // 默认不内联 node_modules，会以 "Unknown file extension \".css\"" 直接让整个
        // 测试文件收集失败（0 test），故把 element-plus 纳入内联转换。
        server: {
            deps: {
                inline: [/element-plus/],
            },
        },
    },
})
