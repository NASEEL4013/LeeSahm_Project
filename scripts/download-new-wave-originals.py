import argparse
import json
import subprocess
import time
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument("--base", default="HEAD^")
args = parser.parse_args()
current = json.loads((ROOT / "public/artworks/data.json").read_text(encoding="utf-8"))
previous = json.loads(subprocess.check_output(
    ["git", "show", f"{args.base}:public/artworks/data.json"], cwd=ROOT, text=True, encoding="utf-8"
))
drive_files = json.loads((ROOT / "drive-artworks.json").read_text(encoding="utf-8"))
drive_by_title = {file["title"].rsplit(".", 1)[0]: file for file in drive_files if "확대" not in file["title"]}
previous_titles = {artwork["title"] for artwork in previous}
added = [artwork for artwork in current if artwork["title"] not in previous_titles]

for artwork in added:
    file = drive_by_title[artwork["title"]]
    output = ROOT / "hostinger-upload/artworks" / artwork["originalUrl"].removeprefix("/artworks/")
    output.parent.mkdir(parents=True, exist_ok=True)
    if output.exists() and output.stat().st_size == file["size"]:
        continue
    url = f"https://drive.usercontent.google.com/download?id={file['id']}&export=download&confirm=t"
    temp = output.with_suffix(".part")
    for attempt in range(4):
        try:
            urllib.request.urlretrieve(url, temp)
            temp.replace(output)
            break
        except Exception:
            temp.unlink(missing_ok=True)
            if attempt == 3:
                raise
            time.sleep(2 ** attempt)

print(f"Prepared {len(added)} new Wave originals")
