import './style.css'
import { loadDataset } from './data'
import { renderLegend } from './legend'
import { createMap } from './map'
import { METRICS, type MetricKey } from './metrics'

const app = document.querySelector<HTMLDivElement>('#app')!
app.innerHTML = `
  <header class="site-header">
    <h1>市区町村別 将来人口マップ</h1>
    <p class="lead" id="lead">読み込み中…</p>
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
  </header>
  <main class="map-area">
    <div class="map-frame" id="map"></div>
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

  const map = createMap(dataset.units)
  document.querySelector('#map')!.append(map.element)
  const legend = document.querySelector<HTMLElement>('#legend')!

  const apply = (key: MetricKey) => {
    const metric = METRICS[key]
    map.setMetric(metric)
    renderLegend(legend, metric)
  }

  document.querySelectorAll<HTMLInputElement>('input[name="metric"]').forEach((input) => {
    input.addEventListener('change', () => apply(input.value as MetricKey))
  })
  apply('rate')
}

main().catch((err: unknown) => {
  document.querySelector('#lead')!.textContent =
    err instanceof Error ? err.message : 'データを読み込めませんでした'
})
