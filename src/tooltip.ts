import type { Dataset, Unit } from './data'
import { METRICS } from './metrics'

const OFFSET = 14

// 地図単位の種別（parse_ipss.py の「市などの別」）ごとの注記
const NOTES: Record<string, string> = {
  '1': '2024年の区再編により、市全体の値を表示しています。',
  '9': '13市町村をまとめた一括推計です（市町村別の推計値はありません）。',
}

export type Tooltip = {
  /** クライアント座標 (x, y) の近くに unit の情報を表示する。 */
  show: (unit: Unit, x: number, y: number) => void
  hide: () => void
}

export function createTooltip(container: HTMLElement, dataset: Dataset): Tooltip {
  const el = document.createElement('div')
  el.className = 'tooltip'
  el.hidden = true
  el.setAttribute('role', 'status')
  container.append(el)

  let shownCode: string | null = null
  const people = (v: number) => `${v.toLocaleString('ja-JP')}人`

  const render = (unit: Unit) => {
    const p = unit.properties
    const note = NOTES[p.kind]
    el.innerHTML = `
      <div class="tooltip-title"><span class="tooltip-pref">${p.pref}</span>${p.name}</div>
      <dl>
        <dt>${dataset.baseYear}年</dt><dd>${people(p.pop_base)}</dd>
        <dt>${dataset.targetYear}年</dt><dd>${people(p.pop_target)}</dd>
        <dt>増減数</dt><dd>${METRICS.diff.format(p.diff)}人</dd>
        <dt>変動率</dt><dd>${(p.rate > 0 ? '+' : '') + (p.rate * 100).toFixed(1)}%</dd>
      </dl>
      ${note ? `<p class="tooltip-note">${note}</p>` : ''}
    `
  }

  return {
    show(unit, x, y) {
      if (shownCode !== unit.id) {
        render(unit)
        shownCode = unit.id
      }
      el.hidden = false
      const box = container.getBoundingClientRect()
      const { width, height } = el.getBoundingClientRect()
      let left = x - box.left + OFFSET
      let top = y - box.top + OFFSET
      if (left + width > box.width) left = Math.max(0, x - box.left - OFFSET - width)
      if (top + height > box.height) top = Math.max(0, y - box.top - OFFSET - height)
      el.style.transform = `translate(${left}px, ${top}px)`
    },
    hide() {
      el.hidden = true
      shownCode = null
    },
  }
}
