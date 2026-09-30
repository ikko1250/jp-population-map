import json

import pandas as pd
import pytest

import join
from build_geo import to_unit
from join import LAYER, JoinError, compute_metrics


def _pop(codes):
    return pd.DataFrame(
        {
            "code": codes,
            "pref": ["X県"] * len(codes),
            "name": [f"市{c}" for c in codes],
            "kind": ["2"] * len(codes),
            "pop_2025": [1000] * len(codes),
            "pop_2035": [900] * len(codes),
        }
    )


def _topology(codes):
    return {
        "type": "Topology",
        "objects": {
            LAYER: {
                "type": "GeometryCollection",
                "geometries": [{"type": "Polygon", "arcs": [[0]], "properties": {"unit": c}} for c in codes],
            }
        },
        "arcs": [[[0, 0], [1, 0], [0, 1], [-1, -1]]],
    }


def test_compute_metrics():
    m = compute_metrics(_pop(["01100"])).iloc[0]
    assert m["diff"] == -100
    assert m["rate"] == pytest.approx(-0.1)


def test_join_embeds_properties():
    out = join.join(_topology(["01100", "01202"]), compute_metrics(_pop(["01100", "01202"])))
    g = out["objects"][LAYER]["geometries"][0]
    assert g["id"] == "01100"
    assert g["properties"]["pop_base"] == 1000
    assert g["properties"]["diff"] == -100
    assert out["meta"] == {"base_year": 2025, "target_year": 2035}


@pytest.mark.parametrize(
    ("geo", "pop"),
    [(["01100", "01202"], ["01100"]), (["01100"], ["01100", "01202"]), (["01100", "01100"], ["01100"])],
)
def test_join_rejects_code_mismatch(geo, pop):
    with pytest.raises(JoinError):
        join.join(_topology(geo), compute_metrics(_pop(pop)))


def test_to_unit():
    assert to_unit("13101") == "13101"
    assert to_unit("07204") == "07999"  # いわき市 → 浜通り地域
    assert to_unit("22139") == "22130"  # 浜松市浜名区 → 浜松市
    assert to_unit("01695") is None  # 北方領土
    assert to_unit("13000") is None  # 所属未定地


@pytest.mark.skipif(not join.OUT_TOPOJSON.exists(), reason="生成物がない（join.py を先に実行）")
def test_generated_output():
    topo = json.loads(join.OUT_TOPOJSON.read_text())
    props = [g["properties"] for g in topo["objects"][LAYER]["geometries"]]
    assert len(props) == 1878
    assert sum(p["pop_base"] for p in props) == 123_262_450  # 2025年 全国
    assert sum(p["pop_target"] for p in props) == 116_638_900  # 2035年 全国
    rates = [p["rate"] for p in props]
    assert -0.6 < min(rates) and max(rates) < 0.5
