// 按需注册的 echarts 统一入口（架构审计 Tier 3：替代全量 `import * as echarts from 'echarts'`）
//
// 背景：全量引入打出 1018 KB raw / 336 KB gz 的 echarts chunk，且因 12 处静态导入
// 进了首屏加载链。改为 echarts/core 按需注册后只打包实际用到的图表与组件。
//
// 注册清单来源（2026-02 全量 grep 核实，新增图表/组件时必须同步维护此清单）：
//   - 图表：type: 'bar' | 'line' | 'pie'（chart-options.ts / dashboard / cost /
//     dns / cdn / oss / nas / disk / rds / allocation / LogStats 全部命中，无其他类型）
//   - 组件：title / tooltip / legend / grid（chart-options 与各图标配项）、
//     graphic（dashboard/index.vue 饰水印文本）、
//     AxisPointerComponent（chart-options.ts、LogStats.vue 在 tooltip 内配置
//     axisPointer，小体量保险项）
//   - 渲染器：CanvasRenderer（全部 echarts.init(el) 默认 canvas，无 renderer: 'svg'）
//   - graphic.LinearGradient（CostTrendChart.vue 渐变）由 echarts/core 直接导出
//
// 类型侧（import type { EChartsOption } from 'echarts'）保留原样：type-only 导入
// 构建期擦除，零运行时成本，且完整类型对未注册图表仅是类型宽松，不影响运行时。
//
// ⚠ vite.config.ts manualChunks 以 'echarts/core|charts|components|renderers'
//   子路径命名 chunk；zrender 仅被 echarts 引用，会自动并入该 chunk。

import * as echarts from 'echarts/core'
import { BarChart, LineChart, PieChart } from 'echarts/charts'
import {
  AxisPointerComponent,
  GraphicComponent,
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([
  BarChart,
  LineChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  GraphicComponent,
  AxisPointerComponent,
  CanvasRenderer,
])

export default echarts
export * from 'echarts/core'
