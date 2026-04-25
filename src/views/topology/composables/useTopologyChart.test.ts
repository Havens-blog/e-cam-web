/**
 * Feature: arms-apm-topology, Property 10: APM 边视觉样式映射
 *
 * Validates: Requirements 5.2, 5.3
 *
 * Property: For any APM edge, line width is in [1, 5] and monotonically
 * increasing with QPS. Color thresholds: error_rate ≤ 1% blue,
 * 1% < error_rate ≤ 5% orange, error_rate > 5% red.
 */
import type { TopoEdge } from '@/api/types/topology'
import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { apmEdgeStyle } from './useTopologyChart'

/** Helper to build a minimal APM TopoEdge with given attributes */
function makeApmEdge(attrs: Record<string, any>): TopoEdge {
    return {
        id: 'test-edge',
        source_id: 'a',
        target_id: 'b',
        relation: 'calls',
        direction: 'outbound',
        source_collector: 'apm',
        status: 'active',
        attributes: attrs,
    }
}

describe('Property 10: APM 边视觉样式映射', () => {
    /**
     * **Validates: Requirements 5.2**
     * Line width must be in [1, 5] range for any non-negative QPS.
     */
    it('line width is always in [1, 5] range', () => {
        fc.assert(
            fc.property(
                fc.float({ min: 0, max: 1_000_000, noNaN: true }),
                (qps) => {
                    const edge = makeApmEdge({ qps, error_rate: 0 })
                    const style = apmEdgeStyle(edge)
                    const width = style.width as number
                    expect(width).toBeGreaterThanOrEqual(1)
                    expect(width).toBeLessThanOrEqual(5)
                },
            ),
            { numRuns: 200 },
        )
    })

    /**
     * **Validates: Requirements 5.2**
     * Line width is monotonically non-decreasing with QPS.
     */
    it('line width is monotonically non-decreasing with QPS', () => {
        fc.assert(
            fc.property(
                fc.float({ min: 0, max: 1_000_000, noNaN: true }),
                fc.float({ min: 0, max: 1_000_000, noNaN: true }),
                (qps1, qps2) => {
                    const [lo, hi] = qps1 <= qps2 ? [qps1, qps2] : [qps2, qps1]
                    const styleLo = apmEdgeStyle(makeApmEdge({ qps: lo, error_rate: 0 }))
                    const styleHi = apmEdgeStyle(makeApmEdge({ qps: hi, error_rate: 0 }))
                    expect(styleHi.width as number).toBeGreaterThanOrEqual(styleLo.width as number)
                },
            ),
            { numRuns: 200 },
        )
    })

    /**
     * **Validates: Requirements 5.3**
     * Color thresholds: error_rate ≤ 1% → blue (#3b82f6),
     * 1% < error_rate ≤ 5% → orange (#f97316),
     * error_rate > 5% → red (#ef4444).
     */
    it('color matches error_rate thresholds', () => {
        fc.assert(
            fc.property(
                fc.float({ min: 0, max: 100, noNaN: true }),
                (errorRate) => {
                    const edge = makeApmEdge({ qps: 10, error_rate: errorRate })
                    const style = apmEdgeStyle(edge)
                    const color = style.color as string

                    if (errorRate > 5) {
                        expect(color).toBe('#ef4444') // red
                    } else if (errorRate > 1) {
                        expect(color).toBe('#f97316') // orange
                    } else {
                        expect(color).toBe('#3b82f6') // blue
                    }
                },
            ),
            { numRuns: 200 },
        )
    })

    /**
     * **Validates: Requirements 5.2, 5.3**
     * Boundary cases: exact threshold values.
     */
    it('boundary: error_rate exactly 1% is blue', () => {
        const style = apmEdgeStyle(makeApmEdge({ qps: 10, error_rate: 1 }))
        expect(style.color).toBe('#3b82f6')
    })

    it('boundary: error_rate exactly 5% is orange', () => {
        const style = apmEdgeStyle(makeApmEdge({ qps: 10, error_rate: 5 }))
        expect(style.color).toBe('#f97316')
    })

    it('boundary: QPS 0 gives minimum width', () => {
        const style = apmEdgeStyle(makeApmEdge({ qps: 0, error_rate: 0 }))
        expect(style.width).toBe(1)
    })

    it('boundary: very high QPS gives maximum width', () => {
        const style = apmEdgeStyle(makeApmEdge({ qps: 1_000_000, error_rate: 0 }))
        expect(style.width).toBe(5)
    })
})
