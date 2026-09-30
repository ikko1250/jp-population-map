"""境界 TopoJSON と推計人口を地図単位コードで結合し、フロントが読む TopoJSON を書き出す。

指標（要承認事項 A・B で決定）：
- 基準年 2025年（推計値）→ 2035年
- diff = pop_2035 − pop_2025（増減数、人）
- rate = diff / pop_2025（変動率）
"""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

HERE = Path(__file__).parent
IPSS_CSV = HERE / "work" / "ipss_population.csv"
UNITS_TOPOJSON = HERE / "work" / "units.topo.json"
OUT_TOPOJSON = HERE.parent / "public" / "data" / "municipalities.topo.json"

BASE_YEAR = 2025
TARGET_YEAR = 2035
LAYER = "units"


class JoinError(ValueError):
    pass


def load_population(path: Path = IPSS_CSV) -> pd.DataFrame:
    return pd.read_csv(path, dtype={"code": str, "kind": str})


def compute_metrics(pop: pd.DataFrame) -> pd.DataFrame:
    base = pop[f"pop_{BASE_YEAR}"]
    target = pop[f"pop_{TARGET_YEAR}"]
    return pd.DataFrame(
        {
            "code": pop["code"],
            "pref": pop["pref"],
            "name": pop["name"],
            "kind": pop["kind"],
            "pop_base": base,
            "pop_target": target,
            "diff": target - base,
            "rate": ((target - base) / base).round(5),
        }
    )


def join(topology: dict, metrics: pd.DataFrame) -> dict:
    """topology の各ジオメトリに指標を埋め込む。コードの過不足があれば JoinError。"""
    geometries = topology["objects"][LAYER]["geometries"]
    geo_codes = [g["properties"]["unit"] for g in geometries]
    if len(set(geo_codes)) != len(geo_codes):
        raise JoinError("境界側に重複した単位コードがある")

    by_code = metrics.set_index("code")
    only_geo = sorted(set(geo_codes) - set(by_code.index))
    only_pop = sorted(set(by_code.index) - set(geo_codes))
    if only_geo or only_pop:
        raise JoinError(f"コードが一致しない: 境界のみ={only_geo}, 推計のみ={only_pop}")

    for g in geometries:
        row = by_code.loc[g["properties"]["unit"]]
        g["id"] = row.name
        g["properties"] = {
            "pref": row["pref"],
            "name": row["name"],
            "kind": row["kind"],
            "pop_base": int(row["pop_base"]),
            "pop_target": int(row["pop_target"]),
            "diff": int(row["diff"]),
            "rate": float(row["rate"]),
        }
    topology["meta"] = {"base_year": BASE_YEAR, "target_year": TARGET_YEAR}
    return topology


def main() -> None:
    topology = json.loads(UNITS_TOPOJSON.read_text())
    joined = join(topology, compute_metrics(load_population()))
    OUT_TOPOJSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_TOPOJSON.write_text(json.dumps(joined, ensure_ascii=False, separators=(",", ":")))
    n = len(joined["objects"][LAYER]["geometries"])
    print(f"{n} units -> {OUT_TOPOJSON} ({OUT_TOPOJSON.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
