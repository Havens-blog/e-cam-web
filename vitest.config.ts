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
    },
})
