/**
 * CAM 模块图表配置工具
 * 生成 ECharts 配置对象
 */

import { getProviderConfig } from '@/utils/constants'
import type { EChartsOption } from 'echarts'

/**
 * 生成饼图配置
 * @param data 数据对象 { key: value }
 * @param title 图表标题
 * @param useProviderColors 是否使用云厂商颜色
 * @returns ECharts 配置对象
 */
export function generatePieChartOption(
    data: Record<string, number>,
    title?: string,
    useProviderColors = false
): EChartsOption {
    const chartData = Object.entries(data).map(([name, value]) => {
        const item: any = { name, value }

        // 如果启用云厂商颜色，尝试获取对应的颜色
        if (useProviderColors) {
            const config = getProviderConfig(name)
            if (config) {
                item.itemStyle = { color: config.color }
            }
        }

        return item
    })

    return {
        title: title
            ? {
                text: title,
                left: 'center',
                textStyle: {
                    fontSize: 14,
                    fontWeight: 'normal'
                }
            }
            : undefined,
        tooltip: {
            trigger: 'item',
            formatter: '{b}: {c} ({d}%)'
        },
        legend: {
            orient: 'vertical',
            left: 'left',
            top: 'middle'
        },
        series: [
            {
                type: 'pie',
                radius: '60%',
                center: ['60%', '50%'],
                data: chartData,
                emphasis: {
                    itemStyle: {
                        shadowBlur: 10,
                        shadowOffsetX: 0,
                        shadowColor: 'rgba(0, 0, 0, 0.5)'
                    }
                },
                label: {
                    formatter: '{b}: {d}%'
                }
            }
        ]
    }
}

/**
 * 生成环形图配置
 * @param data 数据对象 { key: value }
 * @param title 图表标题
 * @returns ECharts 配置对象
 */
export function generateDonutChartOption(data: Record<string, number>, title?: string): EChartsOption {
    const chartData = Object.entries(data).map(([name, value]) => ({
        name,
        value
    }))

    return {
        title: title
            ? {
                text: title,
                left: 'center',
                textStyle: {
                    fontSize: 14,
                    fontWeight: 'normal'
                }
            }
            : undefined,
        tooltip: {
            trigger: 'item',
            formatter: '{b}: {c} ({d}%)'
        },
        legend: {
            orient: 'vertical',
            left: 'left',
            top: 'middle'
        },
        series: [
            {
                type: 'pie',
                radius: ['40%', '70%'],
                center: ['60%', '50%'],
                data: chartData,
                emphasis: {
                    itemStyle: {
                        shadowBlur: 10,
                        shadowOffsetX: 0,
                        shadowColor: 'rgba(0, 0, 0, 0.5)'
                    }
                },
                label: {
                    formatter: '{b}: {d}%'
                }
            }
        ]
    }
}

/**
 * 生成柱状图配置
 * @param data 数据对象 { key: value }
 * @param title 图表标题
 * @param xAxisLabel X轴标签
 * @param yAxisLabel Y轴标签
 * @returns ECharts 配置对象
 */
export function generateBarChartOption(
    data: Record<string, number>,
    title?: string,
    xAxisLabel?: string,
    yAxisLabel?: string
): EChartsOption {
    const categories = Object.keys(data)
    const values = Object.values(data)

    return {
        title: title
            ? {
                text: title,
                left: 'center',
                textStyle: {
                    fontSize: 14,
                    fontWeight: 'normal'
                }
            }
            : undefined,
        tooltip: {
            trigger: 'axis',
            axisPointer: {
                type: 'shadow'
            }
        },
        grid: {
            left: '3%',
            right: '4%',
            bottom: '3%',
            containLabel: true
        },
        xAxis: {
            type: 'category',
            data: categories,
            name: xAxisLabel,
            axisLabel: {
                rotate: 45,
                interval: 0
            }
        },
        yAxis: {
            type: 'value',
            name: yAxisLabel
        },
        series: [
            {
                type: 'bar',
                data: values,
                itemStyle: {
                    color: '#3B82F6'
                },
                emphasis: {
                    itemStyle: {
                        color: '#2563EB'
                    }
                }
            }
        ]
    }
}

/**
 * 生成折线图配置
 * @param data 数据数组 [{ date: string, cost: number }]
 * @param title 图表标题
 * @param xAxisLabel X轴标签
 * @param yAxisLabel Y轴标签
 * @returns ECharts 配置对象
 */
export function generateLineChartOption(
    data: Array<{ date: string; cost: number }>,
    title?: string,
    xAxisLabel?: string,
    yAxisLabel?: string
): EChartsOption {
    const dates = data.map((item) => item.date)
    const values = data.map((item) => item.cost)

    return {
        title: title
            ? {
                text: title,
                left: 'center',
                textStyle: {
                    fontSize: 14,
                    fontWeight: 'normal'
                }
            }
            : undefined,
        tooltip: {
            trigger: 'axis',
            formatter: (params: any) => {
                const param = params[0]
                return `${param.name}<br/>${param.seriesName}: ¥${param.value.toFixed(2)}`
            }
        },
        grid: {
            left: '3%',
            right: '4%',
            bottom: '3%',
            containLabel: true
        },
        xAxis: {
            type: 'category',
            data: dates,
            name: xAxisLabel,
            boundaryGap: false
        },
        yAxis: {
            type: 'value',
            name: yAxisLabel,
            axisLabel: {
                formatter: '¥{value}'
            }
        },
        series: [
            {
                name: '成本',
                type: 'line',
                data: values,
                smooth: true,
                itemStyle: {
                    color: '#10B981'
                },
                areaStyle: {
                    color: {
                        type: 'linear',
                        x: 0,
                        y: 0,
                        x2: 0,
                        y2: 1,
                        colorStops: [
                            {
                                offset: 0,
                                color: 'rgba(16, 185, 129, 0.3)'
                            },
                            {
                                offset: 1,
                                color: 'rgba(16, 185, 129, 0.05)'
                            }
                        ]
                    }
                }
            }
        ]
    }
}

/**
 * 生成多系列折线图配置
 * @param series 系列数据数组
 * @param categories X轴分类
 * @param title 图表标题
 * @returns ECharts 配置对象
 */
export function generateMultiLineChartOption(
    series: Array<{ name: string; data: number[] }>,
    categories: string[],
    title?: string
): EChartsOption {
    return {
        title: title
            ? {
                text: title,
                left: 'center',
                textStyle: {
                    fontSize: 14,
                    fontWeight: 'normal'
                }
            }
            : undefined,
        tooltip: {
            trigger: 'axis'
        },
        legend: {
            data: series.map((s) => s.name),
            bottom: 0
        },
        grid: {
            left: '3%',
            right: '4%',
            bottom: '10%',
            containLabel: true
        },
        xAxis: {
            type: 'category',
            data: categories,
            boundaryGap: false
        },
        yAxis: {
            type: 'value'
        },
        series: series.map((s) => ({
            name: s.name,
            type: 'line',
            data: s.data,
            smooth: true
        }))
    }
}
