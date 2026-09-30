import type { Feature, MultiPolygon, Polygon } from 'geojson'
import type { GeometryCollection, Topology } from 'topojson-specification'
import { feature } from 'topojson-client'

export type UnitProps = {
  pref: string
  name: string
  kind: string
  pop_base: number
  pop_target: number
  diff: number
  rate: number
}

export type Unit = Feature<Polygon | MultiPolygon, UnitProps> & { id: string }

export type Dataset = {
  units: Unit[]
  baseYear: number
  targetYear: number
}

type PopulationTopology = Topology<{ units: GeometryCollection<UnitProps> }> & {
  meta: { base_year: number; target_year: number }
}

export async function loadDataset(): Promise<Dataset> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/municipalities.topo.json`)
  if (!res.ok) throw new Error(`データを読み込めませんでした（HTTP ${res.status}）`)
  const topo = (await res.json()) as PopulationTopology
  const collection = feature(topo, topo.objects.units)
  return {
    units: collection.features as Unit[],
    baseYear: topo.meta.base_year,
    targetYear: topo.meta.target_year,
  }
}
