"""社人研の推計結果表と国土数値情報 N03（行政区域）を raw/ にダウンロードする。"""

from __future__ import annotations

import urllib.request
import zipfile
from pathlib import Path

RAW = Path(__file__).parent / "raw"

IPSS_URL = "https://www.ipss.go.jp/pp-shicyoson/j/shicyoson23/2gaiyo_hyo/kekkahyo1.xlsx"
N03_URL = "https://nlftp.mlit.go.jp/ksj/gml/data/N03/N03-2025/N03-20250101_GML.zip"


def download(url: str, dest: Path) -> Path:
    if dest.exists():
        print(f"skip (exists): {dest.name}")
        return dest
    print(f"download: {url}")
    req = urllib.request.Request(url, headers={"User-Agent": "jp-population-map/0.1"})
    with urllib.request.urlopen(req) as res, open(dest, "wb") as f:
        while chunk := res.read(1 << 20):
            f.write(chunk)
    return dest


def main() -> None:
    RAW.mkdir(exist_ok=True)
    download(IPSS_URL, RAW / "kekkahyo1.xlsx")
    zip_path = download(N03_URL, RAW / "N03-20250101_GML.zip")
    out_dir = RAW / "N03"
    if not out_dir.exists():
        with zipfile.ZipFile(zip_path) as z:
            z.extractall(out_dir)
    print("done")


if __name__ == "__main__":
    main()
