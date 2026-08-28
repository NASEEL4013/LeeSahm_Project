import concurrent.futures
import argparse
import json
import re
import time
import urllib.request
from collections import defaultdict
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
F50_RATIO = 116.8 / 91.0
PICKER_SIZES = (600, 1000)
SERIES = {
    "wave": {"manifest": "drive-artworks.json", "prefix": "", "id_start": 1},
    "notes": {"manifest": "drive-notes.json", "prefix": "notes/", "id_start": 10001},
}


def normalize_f50(image):
    """Remove small camera margins by cropping every work to the 50-ho ratio."""
    ratio = F50_RATIO if image.width >= image.height else 1 / F50_RATIO
    width, height = image.size
    if width / height > ratio:
        target_width = round(height * ratio)
        left = (width - target_width) // 2
        return image.crop((left, 0, left + target_width, height))
    target_height = round(width / ratio)
    top = (height - target_height) // 2
    return image.crop((0, top, width, top + target_height))


def color_tags(path):
    scores = defaultdict(float)
    with Image.open(path) as image:
        image = ImageOps.exif_transpose(image).convert("RGB")
        image.thumbnail((96, 96), Image.Resampling.LANCZOS)
        for hue, saturation, value in image.convert("HSV").get_flattened_data():
            weight = 0.15 if value > 245 and saturation < 18 else 1.0
            degrees = hue * 360 / 255
            if saturation < 28:
                group = "neutral"
            elif saturation < 70 and 30 <= degrees < 75:
                group = "yellow"
            elif degrees < 45 or degrees >= 345:
                group = "red"
            elif degrees < 80:
                group = "yellow"
            elif degrees < 170:
                group = "green"
            elif degrees < 260:
                group = "blue"
            else:
                group = "purple"
            scores[group] += weight
    ranked = sorted(scores, key=scores.get, reverse=True)
    tags = ranked[:1]
    if len(ranked) > 1 and scores[ranked[1]] >= scores[ranked[0]] * 0.28 and scores[ranked[1]] >= sum(scores.values()) * 0.07:
        tags.append(ranked[1])
    return tags


def number(title):
    match = re.search(r"(?:wave-|SAHMLEE)(\d+)", title, re.IGNORECASE)
    return int(match.group(1)) if match else 999999


def prepare(item, series, originals, previews):
    order, file = item
    base = f"{number(file['title']):03d}-{file['id'][:8]}"
    original = originals / f"{base}.jpg"
    preview = previews / f"{base}.webp"
    picker_previews = {size: previews / f"{base}-{size}.webp" for size in PICKER_SIZES}

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

    with Image.open(original) as image:
        image = ImageOps.exif_transpose(image)
        if series == "wave":
            image = normalize_f50(image)
        for size, path in picker_previews.items():
            picker_image = image.copy()
            picker_image.thumbnail((size, size), Image.Resampling.LANCZOS)
            picker_image.convert("RGB").save(path, "WEBP", quality=88, method=6)
        image.thumbnail((1400, 1400), Image.Resampling.LANCZOS)
        image.convert("RGB").save(preview, "WEBP", quality=82, method=6)

    return {
        "id": SERIES[series]["id_start"] + order,
        "series": series,
        "title": file["title"].rsplit(".", 1)[0],
        "pickerUrl": f"/artworks/{SERIES[series]['prefix']}previews/{picker_previews[600].name}",
        "pickerLargeUrl": f"/artworks/{SERIES[series]['prefix']}previews/{picker_previews[1000].name}",
        "previewUrl": f"/artworks/{SERIES[series]['prefix']}previews/{preview.name}",
        "originalUrl": f"/artworks/{SERIES[series]['prefix']}originals/{original.name}",
        "colors": color_tags(preview),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--series", choices=SERIES, default="wave")
    series = parser.parse_args().series
    config = SERIES[series]
    manifest = ROOT / config["manifest"]
    originals = ROOT / "hostinger-upload" / "artworks" / config["prefix"] / "originals"
    previews = ROOT / "public" / "artworks" / config["prefix"] / "previews"
    data = ROOT / "public" / "artworks" / config["prefix"] / "data.json"
    files = json.loads(manifest.read_text(encoding="utf-8"))
    files = [file for file in files if "확대" not in file["title"]]
    files.sort(key=lambda file: (number(file["title"]), file["title"], file["id"]))
    files = list({file["title"].rsplit(".", 1)[0]: file for file in reversed(files)}.values())[::-1]
    originals.mkdir(parents=True, exist_ok=True)
    previews.mkdir(parents=True, exist_ok=True)
    data.parent.mkdir(parents=True, exist_ok=True)

    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        artworks = list(pool.map(lambda item: prepare(item, series, originals, previews), enumerate(files)))

    data.write_text(json.dumps(artworks, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Prepared {len(artworks)} {series} originals and previews")


if __name__ == "__main__":
    main()
