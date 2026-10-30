import { describe, expect, it } from 'vitest'
import { isChunkLoadError } from './chunk-error'

describe('isChunkLoadError（懒加载 chunk 失败识别）', () => {
    it('识别 Chromium/Firefox 的动态 import 失败（真实环境下实测到的原文）', () => {
        const err = new TypeError(
            'Failed to fetch dynamically imported module: http://localhost:3333/cam/src/views/iam/users/index.vue',
        )
        expect(isChunkLoadError(err)).toBe(true)
    })

    it('识别 Safari / Webpack 风格文案', () => {
        expect(isChunkLoadError(new Error('Importing a module script failed.'))).toBe(true)
        expect(isChunkLoadError(new Error('Loading chunk 12 failed.'))).toBe(true)
        expect(isChunkLoadError('error loading dynamically imported module')).toBe(true)
    })

    it('普通业务错误不误判（不应提示刷新）', () => {
        expect(isChunkLoadError(new Error('Request failed with status code 500'))).toBe(false)
        expect(isChunkLoadError(new Error('Network Error'))).toBe(false)
        expect(isChunkLoadError(new Error('canceled'))).toBe(false)
    })

    it('空值/非字符串 message 安全返回 false', () => {
        expect(isChunkLoadError(null)).toBe(false)
        expect(isChunkLoadError(undefined)).toBe(false)
        expect(isChunkLoadError({} as never)).toBe(false)
        expect(isChunkLoadError(new Error(''))).toBe(false)
    })
})
