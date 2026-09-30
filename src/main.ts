import './style.css'
import { loadDataset, type Unit } from './data'
import { renderLegend } from './legend'
import { createMap } from './map'
import { METRICS, type MetricKey } from './metrics'
import { setupSearch } from './search'
import { createTooltip } from './tooltip'

const app = document.querySelector<HTMLDivElement>('#app')!
app.innerHTML = `
  <header class="site-header">
    <h1>市区町村別 将来人口マップ</h1>
    <p class="lead" id="lead">読み込み中…</p>
    <div class="controls">
      <fieldset class="metric-switch" aria-label="色分けの指標">
        ${Object.values(METRICS)
          .map(
            (m, i) => `
          <label>
            <input type="radio" name="metric" value="${m.key}" ${i === 0 ? 'checked' : ''} />
            <span>${m.label}</span>
          </label>`,
          )
          .join('')}
      </fieldset>
      <div class="search">
        <input id="search" type="search" placeholder="市区町村名で検索（例：札幌市中央区）"
          role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="search-results"
          aria-label="市区町村名で検索" autocomplete="off" disabled />
        <ul id="search-results" role="listbox" hidden></ul>
      </div>
    </div>
  </header>
  <main class="map-area" id="map-area">
    <div class="map-frame" id="map"></div>
    <div class="zoom-controls">
      <button type="button" data-zoom="in" aria-label="拡大">+</button>
      <button type="button" data-zoom="out" aria-label="縮小">−</button>
      <button type="button" data-zoom="reset" aria-label="全体を表示">全体</button>
    </div>
    <aside class="legend" id="legend" aria-live="polite"></aside>
  </main>
  <footer class="site-footer">
    出典：国立社会保障・人口問題研究所「日本の地域別将来推計人口（令和5年推計）」、
    国土交通省「国土数値情報（行政区域データ）」を加工して作成。
  </footer>
`

async function main() {
  const dataset = await loadDataset()
  document.querySelector('#lead')!.textContent =
    `${dataset.baseYear}年から${dataset.targetYear}年までの人口の変化（社人研の推計）`

  const mapFrame = document.querySelector<HTMLElement>('#map')!
  const tooltip = createTooltip(document.querySelector<HTMLElement>('#map-area')!, dataset)
  let hovered: Unit | null = null
  let selected: Unit | null = null

  // 選択中の単位の位置にツールチップを出す。地図の枠外に出たら隠す。
  const showAtSelected = () => {
    const el = map.selectedElement()
    if (!selected || !el) return tooltip.hide()
    const r = el.getBoundingClientRect()
    const frame = mapFrame.getBoundingClientRect()
    const x = r.left + r.width / 2
    const y = r.top + r.height / 2
    if (x < frame.left || x > frame.right || y < frame.top || y > frame.bottom) return tooltip.hide()
    tooltip.show(selected, x, y)
  }

  const map = createMap(dataset.units, {
    onHover(unit, event) {
      hovered = unit
      if (unit) tooltip.show(unit, event.clientX, event.clientY)
      else showAtSelected()
    },
    onSelect(unit) {
      selected = unit
      if (!hovered) showAtSelected()
    },
    onViewChange() {
      if (!hovered) showAtSelected()
    },
  })
  mapFrame.append(map.element)

  const legend = document.querySelector<HTMLElement>('#legend')!
  const applyMetric = (key: MetricKey) => {
    const metric = METRICS[key]
    map.setMetric(metric)
    renderLegend(legend, metric)
  }
  document.querySelectorAll<HTMLInputElement>('input[name="metric"]').forEach((input) => {
    input.addEventListener('change', () => applyMetric(input.value as MetricKey))
  })
  applyMetric('rate')

  document.querySelectorAll<HTMLButtonElement>('[data-zoom]').forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.dataset.zoom
      if (action === 'in') map.zoomBy(2)
      else if (action === 'out') map.zoomBy(0.5)
      else map.resetZoom()
    })
  })

  const searchInput = document.querySelector<HTMLInputElement>('#search')!
  setupSearch(searchInput, document.querySelector('#search-results')!, dataset.units, (code) =>
    map.select(code, { zoom: true }),
  )
  searchInput.disabled = false
}

main().catch((err: unknown) => {
  document.querySelector('#lead')!.textContent =
    err instanceof Error ? err.message : 'データを読み込めませんでした'
})
