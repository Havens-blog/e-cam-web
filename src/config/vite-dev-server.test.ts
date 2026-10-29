/**
 * 契约断言：开发/预览服务器**不自动打开浏览器**。
 *
 * 背景（2026-10-29 使用者反馈并实测）：测试/多实例环境下 vite 被反复拉起
 * （自动化验收固定 `--port 3333`），而 `server.open: true` 会让**每次启动都弹窗**，
 * 且因 `base: '/cam/'` 与默认路由跳转，窗口落在 `/cam/dashboard`，持续干扰使用者。
 *
 * 需要打开时显式使用 `vite --open` / `vite preview --open`；自动化验证脚本自行
 * 导航（headless），无需弹窗。
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const configSource = readFileSync(resolve(__dirname, '..', '..', 'vite.config.ts'), 'utf-8')

/** 截取配置段（避免匹配到其它段落的同名关键字） */
function section(startMarker: string, endMarker?: string): string {
    const start = configSource.indexOf(startMarker)
    expect(start, `未找到配置段 ${startMarker}`).toBeGreaterThan(-1)
    if (!endMarker) return configSource.slice(start)
    const end = configSource.indexOf(endMarker, start)
    return end === -1 ? configSource.slice(start) : configSource.slice(start, end)
}

describe('vite.config:dev/preview 不自动打开浏览器', () => {
    it('server.open 为 false（不再每次启动弹窗到 /cam/dashboard）', () => {
        const serverBlock = section('server: {', 'preview: {')
        expect(serverBlock).toMatch(/open:\s*false/)
        expect(serverBlock).not.toMatch(/open:\s*true/)
    })

    it('preview.open 为 false（预览服务器同样不弹窗）', () => {
        const previewBlock = section('preview: {')
        expect(previewBlock).toMatch(/open:\s*false/)
        expect(previewBlock).not.toMatch(/open:\s*true/)
    })

    it('未在 npm scripts 中隐式追加 --open（保留显式开启能力）', () => {
        const pkg = readFileSync(resolve(__dirname, '..', '..', 'package.json'), 'utf-8')
        expect(pkg).not.toMatch(/"dev":\s*"[^"]*--open/)
        expect(pkg).not.toMatch(/"preview":\s*"[^"]*--open/)
    })
})
