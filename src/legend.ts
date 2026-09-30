import { legendItems, type Metric } from './metrics'

export function renderLegend(container: HTMLElement, metric: Metric): void {
  const items = legendItems(metric)
    .reverse() // 増加を上、減少を下に並べる
    .map(
      ({ color, label }) =>
        `<li><span class="swatch" style="background:${color}"></span>${label}</li>`,
    )
    .join('')
  container.innerHTML = `<h2>${metric.legendTitle}</h2><ul>${items}</ul>`
}
