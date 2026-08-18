import concurrent.futures
import json
import time
import urllib.request
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "drive-artworks.json"
ORIGINALS = ROOT / "hostinger-upload" / "artworks" / "originals"
PREVIEWS = ROOT / "public" / "artworks" / "previews"
DATA = ROOT / "public" / "artworks" / "data.json"


def number(title):
    try:
        return int(title.lower().split("wave-", 1)[1].split(".", 1)[0].split("확대", 1)[0])
    except (IndexError, ValueError):
        return 999999


def prepare(item):
    order, file = item
    base = f"{number(file['title']):03d}-{file['id'][:8]}"
    original = ORIGINALS / f"{base}.jpg"
    preview = PREVIEWS / f"{base}.webp"

    if not original.exists() or original.stat().st_size != file["size"]:
        url = f"https://drive.usercontent.google.com/download?id={file['id']}&export=download&confirm=t"
        temp = original.with_suffix(".part")
        for attempt in range(4):
            try:
                urllib.request.urlretrieve(url, temp)
                temp.replace(original)
                break
            except Exception:
                temp.unlink(missing_ok=True)
                if attempt == 3:
                    raise
                time.sleep(2 ** attempt)

    if not preview.exists():
        with Image.open(original) as image:
            image = ImageOps.exif_transpose(image)
            image.thumbnail((1400, 1400), Image.Resampling.LANCZOS)
            image.convert("RGB").save(preview, "WEBP", quality=82, method=6)

    return {
        "id": order + 1,
        "title": file["title"].rsplit(".", 1)[0],
        "previewUrl": f"/artworks/previews/{preview.name}",
        "originalUrl": f"/artworks/originals/{original.name}",
    }


def main():
    files = json.loads(MANIFEST.read_text(encoding="utf-8"))
    files.sort(key=lambda file: (number(file["title"]), file["title"], file["id"]))
    ORIGINALS.mkdir(parents=True, exist_ok=True)
    PREVIEWS.mkdir(parents=True, exist_ok=True)

    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        artworks = list(pool.map(prepare, enumerate(files)))

    DATA.write_text(json.dumps(artworks, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Prepared {len(artworks)} originals and previews")


if __name__ == "__main__":
    main()
