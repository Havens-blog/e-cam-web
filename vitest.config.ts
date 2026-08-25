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
        include: ['src/**/*.test.ts'],
    },
})
