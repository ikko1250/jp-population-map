import type { MultiPoint } from 'geojson'
import { geoMercator, geoPath } from 'd3-geo'
import type { Unit } from './data'
import type { Metric } from './metrics'

const SVG_NS = 'http://www.w3.org/2000/svg'
const WIDTH = 1000
const PADDING = 8

// 初期表示の範囲（与那国島〜根室、父島まで）。南鳥島・沖ノ鳥島まで含めると本土が小さくなるので外す。
const VIEW_BOX: MultiPoint = {
  type: 'MultiPoint',
  coordinates: [
    [122.9, 24.0],
    [146.0, 45.6],
  ],
}

export type ChoroplethMap = {
  element: SVGSVGElement
  setMetric: (metric: Metric) => void
}

export function createMap(units: Unit[]): ChoroplethMap {
  const projection = geoMercator().fitWidth(WIDTH - 2 * PADDING, VIEW_BOX)
  const [[, top], [, bottom]] = geoPath(projection).bounds(VIEW_BOX)
  const height = Math.ceil(bottom - top) + 2 * PADDING
  projection.translate(projection.translate().map((v) => v + PADDING) as [number, number])
  const path = geoPath(projection).digits(1)

  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('viewBox', `0 0 ${WIDTH} ${height}`)
  svg.setAttribute('role', 'img')
  svg.setAttribute('aria-label', '市区町村別の将来人口の色分け地図')
  svg.classList.add('map')

  const layer = document.createElementNS(SVG_NS, 'g')
  svg.append(layer)

  const paths = units.map((unit) => {
    const el = document.createElementNS(SVG_NS, 'path')
    el.setAttribute('d', path(unit) ?? '')
    el.classList.add('unit')
    el.dataset.code = unit.id
    layer.append(el)
    return el
  })

  return {
    element: svg,
    setMetric(metric) {
      units.forEach((unit, i) => {
        paths[i].style.fill = metric.scale(metric.value(unit.properties))
      })
    },
  }
}
