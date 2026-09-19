import argparse
import json
import subprocess
import time
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument("--base", default="HEAD^")
parser.add_argument("--series", choices=("wave", "sahm"), default="wave")
args = parser.parse_args()
catalog = "public/artworks/data.json" if args.series == "wave" else "public/artworks/sahm/data.json"
manifest = "drive-artworks.json" if args.series == "wave" else "drive-sahm.json"
current = json.loads((ROOT / catalog).read_text(encoding="utf-8"))
exists = subprocess.check_output(["git", "ls-tree", "--name-only", args.base, "--", catalog], cwd=ROOT, text=True).strip()
previous = json.loads(subprocess.check_output(
    ["git", "show", f"{args.base}:{catalog}"], cwd=ROOT, text=True, encoding="utf-8"
)) if exists else []
drive_files = json.loads((ROOT / manifest).read_text(encoding="utf-8"))
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
            if temp.stat().st_size != file["size"]:
                raise ValueError(f"Original size mismatch: {file['title']}")
            temp.replace(output)
            break
        except Exception:
            temp.unlink(missing_ok=True)
            if attempt == 3:
                raise
            time.sleep(2 ** attempt)

print(f"Prepared {len(added)} new {args.series} originals")
