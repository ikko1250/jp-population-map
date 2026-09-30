import pytest

import parse_ipss
from parse_ipss import KIND_PREFECTURE, YEARS, map_units, read_table

pytestmark = pytest.mark.skipif(
    not parse_ipss.RAW_XLSX.exists(), reason="raw/kekkahyo1.xlsx がない（fetch.py を先に実行）"
)

# 社人研 令和5年推計の全国総人口（2020年は国勢調査の確定値）
NATIONAL_2020 = 126_146_099
NATIONAL_2035 = 116_638_900


@pytest.fixture(scope="module")
def table():
    return read_table()


@pytest.fixture(scope="module")
def units(table):
    return map_units(table)


def test_unit_counts(units):
    counts = units["kind"].value_counts().to_dict()
    # 政令市の区 175 + 東京23区（浜松市の7区を除く）、浜松市 1、
    # 浜通りの13市町村を除く市・町村、浜通り地域 1
    assert counts == {0: 191, 1: 1, 2: 769, 3: 916, 9: 1}
    assert units["code"].is_unique


def test_units_sum_to_national_total(units):
    assert units["pop_2020"].sum() == NATIONAL_2020
    assert units["pop_2035"].sum() == NATIONAL_2035


def test_units_sum_to_prefecture_totals(table, units):
    prefs = table[table["kind"] == KIND_PREFECTURE].set_index("pref")
    by_pref = units.groupby("pref")[[f"pop_{y}" for y in YEARS]].sum()
    assert len(prefs) == 47
    assert (by_pref.loc[prefs.index] == prefs[by_pref.columns]).all().all()


def test_codes_are_five_digit(units):
    assert units["code"].str.fullmatch(r"\d{5}").all()
    assert units.loc[units["kind"] == 9, "code"].tolist() == [parse_ipss.HAMADORI_CODE]
    assert units.loc[units["kind"] == 1, "code"].tolist() == [parse_ipss.HAMAMATSU_CODE]
