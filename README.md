# 市区町村別 将来人口マップ

市区町村別の約10年後（2035年）の将来推計人口を、日本地図上で色分け表示する静的サイト。GitHub Pages で公開する。

## データ

- 人口：国立社会保障・人口問題研究所「日本の地域別将来推計人口（令和5年推計）」結果表1 を加工して作成
  （https://www.ipss.go.jp/pp-shicyoson/j/shicyoson23/t-page.asp 、公共データ利用規約 第1.0版）
- 境界：国土交通省「国土数値情報（行政区域データ）」2025年1月1日時点 を加工して作成
  （https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N03-2025.html 、CC BY 4.0）

指標は 2025年（推計値）→ 2035年 の増減数と変動率。

### 地図単位の注意

- 政令市は区単位で表示する。ただし浜松市は市単位（2024年の区再編で旧区の推計値を新しい区に割り当てられないため）。
- 福島県浜通り地域の13市町村は、社人研の推計が1地域にまとめられているため、1つの領域として表示する。
- 北方領土と所属未定地は推計がないため表示しない。

## データの再生成

生成物 `public/data/municipalities.topo.json` はコミット済み。作り直すときだけ実行する。

```sh
npm ci                       # mapshaper を入れる
cd pipeline
uv sync
uv run python fetch.py       # 社人研 xlsx と N03（約600MB）を raw/ に取得
uv run python parse_ipss.py  # → work/ipss_population.csv
uv run python build_geo.py   # → work/units.topo.json
uv run python join.py        # → ../public/data/municipalities.topo.json
uv run pytest
```

## 開発

```sh
npm run dev
npm run build
```

main に push すると `.github/workflows/deploy.yml` が GitHub Pages にデプロイする（リポジトリの Settings → Pages → Source を「GitHub Actions」にしておく）。
