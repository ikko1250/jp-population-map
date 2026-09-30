import type { MultiPoint } from 'geojson'
import { geoMercator, geoPath } from 'd3-geo'
import { select } from 'd3-selection'
import 'd3-transition'
import { zoom, zoomIdentity } from 'd3-zoom'
import type { Unit } from './data'
import type { Metric } from './metrics'

const SVG_NS = 'http://www.w3.org/2000/svg'
const WIDTH = 1000
const PADDING = 8
const MAX_ZOOM = 60
const ZOOM_DURATION_MS = 600
// 検索で選んだ単位が画面に占める割合（周りの様子も見えるように小さめにする）
const ZOOM_FILL = 0.3

// 初期表示の範囲（与那国島〜根室、父島まで）。南鳥島・沖ノ鳥島まで含めると本土が小さくなるので外す。
const VIEW_BOX: MultiPoint = {
  type: 'MultiPoint',
  coordinates: [
    [122.9, 24.0],
    [146.0, 45.6],
  ],
}

export type MapCallbacks = {
  /** マウスで単位に乗ったとき（離れたら null）。タッチ操作では呼ばれない。 */
  onHover: (unit: Unit | null, event: PointerEvent) => void
  /** クリック・タップ・検索で選択が変わったとき。 */
  onSelect: (unit: Unit | null) => void
  /** ズーム・パンで表示が動いたとき。 */
  onViewChange: () => void
}

export type ChoroplethMap = {
  element: SVGSVGElement
  setMetric: (metric: Metric) => void
  select: (code: string | null, options?: { zoom?: boolean }) => void
  /** 選択中の単位の強調表示（ツールチップの位置合わせに使う）。 */
  selectedElement: () => SVGPathElement | null
  zoomBy: (factor: number) => void
  resetZoom: () => void
}

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, className?: string) {
  const el = document.createElementNS(SVG_NS, tag)
  if (className) el.classList.add(className)
  return el
}

export function createMap(units: Unit[], callbacks: MapCallbacks): ChoroplethMap {
  const projection = geoMercator().fitWidth(WIDTH - 2 * PADDING, VIEW_BOX)
  const [[, top], [, bottom]] = geoPath(projection).bounds(VIEW_BOX)
  const height = Math.ceil(bottom - top) + 2 * PADDING
  projection.translate(projection.translate().map((v) => v + PADDING) as [number, number])
  const path = geoPath(projection).digits(1)

  const svg = svgEl('svg', 'map')
  svg.setAttribute('viewBox', `0 0 ${WIDTH} ${height}`)
  svg.setAttribute('role', 'img')
  svg.setAttribute('aria-label', '市区町村別の将来人口の色分け地図')

  const scene = svgEl('g')
  const layer = svgEl('g')
  const hoverOutline = svgEl('path', 'outline-hover')
  const selectedOutline = svgEl('path', 'outline-selected')
  scene.append(layer, hoverOutline, selectedOutline)
  svg.append(scene)

  const indexByCode = new Map(units.map((u, i) => [u.id, i]))
  const paths = units.map((unit) => {
    const el = svgEl('path', 'unit')
    el.setAttribute('d', path(unit) ?? '')
    el.dataset.code = unit.id
    layer.append(el)
    return el
  })

  let selectedCode: string | null = null

  const unitAt = (target: EventTarget | null): Unit | null => {
    const code = target instanceof SVGPathElement ? target.dataset.code : undefined
    const i = code === undefined ? undefined : indexByCode.get(code)
    return i === undefined ? null : units[i]
  }

  const setOutline = (outline: SVGPathElement, unit: Unit | null) => {
    outline.setAttribute('d', unit ? paths[indexByCode.get(unit.id)!].getAttribute('d')! : '')
  }

  // --- ズーム・パン ---
  const zoomBehavior = zoom<SVGSVGElement, unknown>()
    .scaleExtent([1, MAX_ZOOM])
    .translateExtent([
      [0, 0],
      [WIDTH, height],
    ])
    .on('zoom', (event) => {
      scene.setAttribute('transform', event.transform.toString())
      callbacks.onViewChange()
    })
  const svgSelection = select(svg).call(zoomBehavior)

  const zoomToUnit = (unit: Unit) => {
    const [[x0, y0], [x1, y1]] = path.bounds(unit)
    const k = Math.min(MAX_ZOOM, ZOOM_FILL / Math.max((x1 - x0) / WIDTH, (y1 - y0) / height))
    const transform = zoomIdentity
      .translate(WIDTH / 2, height / 2)
      .scale(Math.max(1, k))
      .translate(-(x0 + x1) / 2, -(y0 + y1) / 2)
    svgSelection.transition().duration(ZOOM_DURATION_MS).call(zoomBehavior.transform, transform)
  }

  // --- ホバー・選択 ---
  svg.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse') return
    const unit = unitAt(event.target)
    setOutline(hoverOutline, unit)
    callbacks.onHover(unit, event)
  })
  svg.addEventListener('pointerleave', (event) => {
    setOutline(hoverOutline, null)
    callbacks.onHover(null, event)
  })
  // d3-zoom はドラッグ後の click を抑止するので、パン操作で選択が変わることはない。
  svg.addEventListener('click', (event) => {
    const unit = unitAt(event.target)
    api.select(unit?.id ?? null)
  })

  const api: ChoroplethMap = {
    element: svg,
    setMetric(metric) {
      units.forEach((unit, i) => {
        paths[i].style.fill = metric.scale(metric.value(unit.properties))
      })
    },
    select(code, options = {}) {
      const i = code === null ? undefined : indexByCode.get(code)
      const unit = i === undefined ? null : units[i]
      selectedCode = unit?.id ?? null
      setOutline(selectedOutline, unit)
      if (unit && options.zoom) zoomToUnit(unit)
      callbacks.onSelect(unit)
    },
    selectedElement: () => (selectedCode === null ? null : selectedOutline),
    zoomBy(factor) {
      svgSelection.transition().duration(250).call(zoomBehavior.scaleBy, factor)
    },
    resetZoom() {
      svgSelection.transition().duration(ZOOM_DURATION_MS).call(zoomBehavior.transform, zoomIdentity)
    },
  }
  return api
}
