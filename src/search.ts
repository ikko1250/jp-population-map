import type { Unit } from './data'

const MAX_RESULTS = 8

const normalize = (s: string) => s.normalize('NFKC').replace(/\s+/g, '')

type Entry = { code: string; label: string; name: string; key: string }

// 地図上で他の単位にまとめてある自治体の名前でも検索できるようにする（pipeline/build_geo.py を参照）
const ALIASES: { pref: string; names: string[]; code: string; suffix: string }[] = [
  {
    pref: '福島県',
    names: ['いわき市', '相馬市', '南相馬市', '広野町', '楢葉町', '富岡町', '川内村', '大熊町', '双葉町', '浪江町', '葛尾村', '新地町', '飯舘村'],
    code: '07999',
    suffix: '（浜通り地域）',
  },
  { pref: '静岡県', names: ['浜松市中央区', '浜松市浜名区', '浜松市天竜区'], code: '22130', suffix: '（浜松市）' },
]

const aliasEntries = (): Entry[] =>
  ALIASES.flatMap(({ pref, names, code, suffix }) =>
    names.map((name) => ({
      code,
      label: `${pref} ${name}${suffix}`,
      name: normalize(name),
      key: normalize(pref + name),
    })),
  )

/**
 * 市区町村名の検索ボックス（combobox）。候補を選ぶと onPick にコードを渡す。
 * 「港区」のように同名の単位があるので、候補には都道府県名も出す。
 */
export function setupSearch(
  input: HTMLInputElement,
  list: HTMLUListElement,
  units: Unit[],
  onPick: (code: string) => void,
): void {
  const entries: Entry[] = [
    ...units.map((u) => ({
      code: u.id,
      label: `${u.properties.pref} ${u.properties.name}`,
      name: normalize(u.properties.name),
      key: normalize(u.properties.pref + u.properties.name),
    })),
    ...aliasEntries(),
  ]

  let results: Entry[] = []
  let active = -1

  const close = () => {
    list.hidden = true
    input.setAttribute('aria-expanded', 'false')
    input.removeAttribute('aria-activedescendant')
    active = -1
  }

  const renderList = () => {
    list.innerHTML = results
      .map(
        (e, i) =>
          `<li id="search-option-${i}" role="option" data-index="${i}" aria-selected="${i === active}">${e.label}</li>`,
      )
      .join('')
    list.hidden = results.length === 0
    input.setAttribute('aria-expanded', String(!list.hidden))
    if (active >= 0) input.setAttribute('aria-activedescendant', `search-option-${active}`)
    else input.removeAttribute('aria-activedescendant')
  }

  const pick = (entry: Entry | undefined) => {
    if (!entry) return
    input.value = entry.label
    close()
    onPick(entry.code)
  }

  input.addEventListener('input', () => {
    const q = normalize(input.value)
    if (!q) {
      results = []
      close()
      return
    }
    // 名前の前方一致を先に、部分一致（都道府県名を含む）を後に並べる
    const prefix = entries.filter((e) => e.name.startsWith(q))
    const partial = entries.filter((e) => !e.name.startsWith(q) && e.key.includes(q))
    results = [...prefix, ...partial].slice(0, MAX_RESULTS)
    active = results.length > 0 ? 0 : -1
    renderList()
  })

  input.addEventListener('keydown', (event) => {
    if (list.hidden) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      active = (active + step + results.length) % results.length
      renderList()
    } else if (event.key === 'Enter') {
      event.preventDefault()
      pick(results[active])
    } else if (event.key === 'Escape') {
      close()
    }
  })

  // blur より先に選択を確定させるため mousedown で拾う
  list.addEventListener('mousedown', (event) => {
    const li = (event.target as HTMLElement).closest('li')
    if (!li) return
    event.preventDefault()
    pick(results[Number(li.dataset.index)])
  })

  input.addEventListener('blur', close)
}
