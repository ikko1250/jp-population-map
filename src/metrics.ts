import { scaleThreshold, type ScaleThreshold } from 'd3-scale'
import type { UnitProps } from './data'

export type MetricKey = 'rate' | 'diff'

export type Metric = {
  key: MetricKey
  label: string
  legendTitle: string
  value: (p: UnitProps) => number
  scale: ScaleThreshold<number, string>
  format: (v: number) => string
}

// ColorBrewer RdBu（色覚多様性に配慮した発散型）。減少＝赤、増加＝青。
const RED = ['#67001f', '#b2182b', '#d6604d', '#f4a582', '#fddbc7']
const BLUE = ['#d1e5f0', '#92c5de', '#4393c3', '#2166ac']

const signed = (s: string, v: number) => (v > 0 ? `+${s}` : s)
const formatPercent = (v: number) => signed(`${Math.round(v * 100)}%`, v)
const formatPeople = (v: number) => signed(v.toLocaleString('ja-JP'), v)

// 区切りは固定値にして、自治体どうしを同じ物差しで比べられるようにする。
export const METRICS: Record<MetricKey, Metric> = {
  rate: {
    key: 'rate',
    label: '変動率',
    legendTitle: '人口変動率',
    value: (p) => p.rate,
    scale: scaleThreshold<number, string>()
      .domain([-0.3, -0.2, -0.1, 0, 0.05])
      .range([RED[1], RED[2], RED[3], RED[4], BLUE[0], BLUE[2]]),
    format: formatPercent,
  },
  diff: {
    key: 'diff',
    label: '増減数',
    legendTitle: '人口増減数（人）',
    value: (p) => p.diff,
    // 増減数は −4万〜+3万人まで幅が広いため、0 を中心に対数的な間隔で区切る。
    scale: scaleThreshold<number, string>()
      .domain([-10000, -3000, -1000, -300, 0, 300, 3000, 10000])
      .range([...RED, ...BLUE]),
    format: formatPeople,
  },
}

export type LegendItem = { color: string; label: string }

export function legendItems(metric: Metric): LegendItem[] {
  const breaks = metric.scale.domain()
  return metric.scale.range().map((color, i) => {
    const lo = breaks[i - 1]
    const hi = breaks[i]
    let label: string
    if (lo === undefined) label = `${metric.format(hi)} 未満`
    else if (hi === undefined) label = `${metric.format(lo)} 以上`
    else label = `${metric.format(lo)} 〜 ${metric.format(hi)}`
    return { color, label }
  })
}
