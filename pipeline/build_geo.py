"""国土数値情報 N03（行政区域）を地図単位に dissolve・単純化し、TopoJSON にする。

N03 の市区町村コードを、推計の単位コード（unit）に読み替えてから dissolve する。
- 浜通り地域の13市町村 → 07999（推計が1地域にまとめられているため）
- 浜松市の3区 → 22130（parse_ipss.py の注記を参照）
- 北方領土の6村と所属未定地（xx000）→ 推計がないので除く
- それ以外 → N03 のコードをそのまま使う

形の単純化は mapshaper（npm の devDependency）で行う。隣接ポリゴンの境界を共有したまま
単純化されるので、隙間や重なりはできない。
"""

from __future__ import annotations

import os
import subprocess
from pathlib import Path

import pandas as pd
import pyogrio

from parse_ipss import HAMADORI_CODE, HAMAMATSU_CODE

HERE = Path(__file__).parent
REPO = HERE.parent
N03_SHP = HERE / "raw" / "N03" / "N03-20250101.shp"
CODE_MAP_CSV = HERE / "work" / "n03_code_map.csv"
OUT_TOPOJSON = HERE / "work" / "units.topo.json"

HAMADORI_MEMBERS = {
    "07204",  # いわき市
    "07209",  # 相馬市
    "07212",  # 南相馬市
    "07541",  # 広野町
    "07542",  # 楢葉町
    "07543",  # 富岡町
    "07544",  # 川内村
    "07545",  # 大熊町
    "07546",  # 双葉町
    "07547",  # 浪江町
    "07548",  # 葛尾村
    "07561",  # 新地町
    "07564",  # 飯舘村
}
HAMAMATSU_WARDS = {"22138", "22139", "22140"}  # 中央区・浜名区・天竜区（2024年〜）
NORTHERN_TERRITORIES = {"01695", "01696", "01697", "01698", "01699", "01700"}

# mapshaper の単純化で残す頂点の割合。全国表示と区レベルのズームで形が崩れない程度に抑える。
SIMPLIFY_PERCENTAGE = "4%"


def to_unit(code: str) -> str | None:
    """N03 の市区町村コードを地図単位のコードに変換する。対象外なら None。"""
    if code in NORTHERN_TERRITORIES or code.endswith("000"):
        return None
    if code in HAMADORI_MEMBERS:
        return HAMADORI_CODE
    if code in HAMAMATSU_WARDS:
        return HAMAMATSU_CODE
    return code


def build_code_map(shp: Path = N03_SHP) -> pd.DataFrame:
    attrs = pyogrio.read_dataframe(shp, read_geometry=False, columns=["N03_007"])
    codes = sorted(attrs["N03_007"].dropna().unique())
    code_map = pd.DataFrame({"N03_007": codes, "unit": [to_unit(c) for c in codes]})
    return code_map.dropna(subset=["unit"])


def run_mapshaper(code_map_csv: Path, out: Path) -> None:
    cmd = [
        "npx",
        "mapshaper",
        "-i", str(N03_SHP), "encoding=utf8",
        "-join", str(code_map_csv), "keys=N03_007,N03_007", "string-fields=N03_007,unit",
        "-filter", "unit != null",
        "-dissolve", "unit",
        "-simplify", SIMPLIFY_PERCENTAGE, "keep-shapes", "planar",
        "-clean",
        "-rename-layers", "units",
        "-o", str(out), "format=topojson", "quantization=1e5",
    ]  # fmt: skip
    subprocess.run(
        cmd,
        cwd=REPO,
        check=True,
        env={**os.environ, "NODE_OPTIONS": "--max-old-space-size=12288"},
    )


def main() -> None:
    CODE_MAP_CSV.parent.mkdir(exist_ok=True)
    code_map = build_code_map()
    code_map.to_csv(CODE_MAP_CSV, index=False)
    print(f"{code_map['unit'].nunique()} units from {len(code_map)} N03 codes")
    run_mapshaper(CODE_MAP_CSV, OUT_TOPOJSON)
    print(f"-> {OUT_TOPOJSON} ({OUT_TOPOJSON.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
