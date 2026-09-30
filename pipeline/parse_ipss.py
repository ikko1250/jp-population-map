"""社人研「結果表1」から、地図に塗る単位の総人口を CSV に抽出する。

地図の単位は「政令市の区（東京23区を含む）」「政令市以外の市」「町村」「浜通り地域」。
都道府県計（a）と政令市計（1）は区と二重計上になるため除く。

例外として浜松市は市単位にする。推計は2020年時点の7区だが、2024年1月に3区へ再編され、
旧北区が新しい中央区と浜名区に分かれたため、旧区の推計値を新しい区の境界に割り当てられない。
"""

from __future__ import annotations

from pathlib import Path

import openpyxl
import pandas as pd

HERE = Path(__file__).parent
RAW_XLSX = HERE / "raw" / "kekkahyo1.xlsx"
OUT_CSV = HERE / "work" / "ipss_population.csv"

YEARS = [2020, 2025, 2030, 2035, 2040, 2045, 2050]
HEADER_ROWS = 5  # 表題・注記・見出しの行数

# 市などの別
KIND_WARD = 0  # 政令市の区（東京23区を含む）
KIND_DESIGNATED_CITY = 1
KIND_CITY = 2
KIND_TOWN_VILLAGE = 3
KIND_HAMADORI = 9
KIND_PREFECTURE = "a"
MAP_KINDS = {KIND_WARD, KIND_CITY, KIND_TOWN_VILLAGE, KIND_HAMADORI}

HAMADORI_CODE = "07999"
HAMAMATSU_CODE = "22130"


def read_table(path: Path = RAW_XLSX) -> pd.DataFrame:
    """結果表1を、都道府県計・政令市計も含む全行の DataFrame にする。"""
    ws = openpyxl.load_workbook(path, read_only=True).active
    records = []
    for row in ws.iter_rows(min_row=HEADER_ROWS + 1, values_only=True):
        if row[0] is None:
            continue
        code, kind, pref, name = row[:4]
        pops = row[4 : 4 + len(YEARS)]
        records.append(
            {
                "code": f"{int(code):05d}",
                "kind": kind,
                "pref": pref,
                "name": name if name is not None else pref,
                **{f"pop_{y}": int(p) for y, p in zip(YEARS, pops)},
            }
        )
    return pd.DataFrame.from_records(records)


def map_units(table: pd.DataFrame) -> pd.DataFrame:
    """地図に塗る単位だけを残す。"""
    is_hamamatsu = table["code"] == HAMAMATSU_CODE
    is_hamamatsu_ward = (table["kind"] == KIND_WARD) & table["code"].str.startswith("2213")
    keep = (table["kind"].isin(MAP_KINDS) & ~is_hamamatsu_ward) | is_hamamatsu
    return table[keep].reset_index(drop=True)


def main() -> None:
    units = map_units(read_table())
    OUT_CSV.parent.mkdir(exist_ok=True)
    units.to_csv(OUT_CSV, index=False)
    print(f"{len(units)} units -> {OUT_CSV}")


if __name__ == "__main__":
    main()
