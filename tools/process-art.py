"""Turn raw painted art into the compressed WebP files under src/assets/art.

Usage: python3 tools/process-art.py <raw-dir>

Raw jets are painted on flat magenta and keyed out here. Clouds are painted on
black and composited in the browser with `mix-blend-mode: screen`. Everything
else is resized and compressed. Jet anchors (nozzle position, bounding box) are
written to src/assets/art/jets.json for the renderer.
"""

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "src" / "assets" / "art"

JETS = [
    "f16", "f15e", "f22", "ea18g",
    "f104", "alphajet", "f4f", "f4f_boss", "mig29",
    "tornado_ids", "tornado_ecr", "tornado_marine",
    "typhoon", "typhoon_boss", "f35", "f35_boss", "a10",
]

# Nozzle (afterburner) positions in raw 1280x720 pixels, read off each painting.
NOZZLES = {
    "f16": (310, 467), "f15e": (231, 417), "f22": (241, 407), "ea18g": (365, 451),
    "f104": (238, 403), "alphajet": (300, 411), "f4f": (376, 459), "f4f_boss": (335, 422),
    "mig29": (276, 465), "tornado_ids": (254, 420), "tornado_ecr": (284, 431),
    "tornado_marine": (243, 425), "typhoon": (254, 444), "typhoon_boss": (274, 453),
    "f35": (289, 397), "f35_boss": (310, 384), "a10": (390, 338),
}


def key_magenta(img: Image.Image) -> Image.Image:
    rgb = np.asarray(img.convert("RGB")).astype(np.float32)
    h, w, _ = rgb.shape
    band = max(4, int(min(h, w) * 0.02))
    border = np.concatenate([
        rgb[:band].reshape(-1, 3), rgb[-band:].reshape(-1, 3),
        rgb[:, :band].reshape(-1, 3), rgb[:, -band:].reshape(-1, 3),
    ])
    bg = np.median(border, axis=0)
    dist = np.sqrt(((rgb - bg) ** 2).sum(axis=2))
    alpha = np.clip((dist - 46.0) / (120.0 - 46.0), 0.0, 1.0)
    a3 = alpha[..., None]
    safe = np.maximum(a3, 1e-3)
    fg = np.where(a3 > 0.02, (rgb - (1 - a3) * bg) / safe, rgb)
    fg = np.clip(fg, 0, 255)
    spill = np.minimum(fg[..., 0], fg[..., 2]) - fg[..., 1]
    spill = np.clip(spill, 0, None) * np.clip(1.4 - alpha, 0.35, 1.0)
    fg[..., 0] -= spill
    fg[..., 2] -= spill
    fg = np.clip(fg, 0, 255)
    alpha[alpha < 0.06] = 0
    out = np.dstack([fg, alpha * 255]).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def resize_rgba(img: Image.Image, width: int) -> Image.Image:
    height = round(img.height * width / img.width)
    return img.convert("RGBa").resize((width, height), Image.LANCZOS).convert("RGBA")


def process_jets(src: Path) -> dict:
    meta = {}
    (OUT / "jets").mkdir(parents=True, exist_ok=True)
    for jet in JETS:
        raw = Image.open(src / f"jet_{jet}.jpg")
        keyed = key_magenta(raw)
        alpha = np.asarray(keyed)[..., 3]
        ys, xs = np.where(alpha > 26)
        pad = 10
        x0, x1 = max(0, xs.min() - pad), min(raw.width, xs.max() + pad)
        y0, y1 = max(0, ys.min() - pad), min(raw.height, ys.max() + pad)
        crop = keyed.crop((x0, y0, x1, y1))
        width = 760
        final = resize_rgba(crop, width)
        final.save(OUT / "jets" / f"{jet}.webp", "WEBP", quality=80, method=6)
        nx, ny = NOZZLES[jet]
        meta[jet] = {
            "aspect": round(crop.width / crop.height, 4),
            "nozzle": [round((nx - x0) / crop.width, 4), round((ny - y0) / crop.height, 4)],
        }
    return meta


def save_rgb(src: Path, name: str, out: str, width: int, quality: int):
    img = Image.open(src / name).convert("RGB")
    height = round(img.height * width / img.width)
    img = img.resize((width, height), Image.LANCZOS)
    path = OUT / out
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "WEBP", quality=quality, method=6)


def main():
    src = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/artsrc")
    meta = process_jets(src)
    (OUT / "jets.json").write_text(json.dumps(meta, indent=2) + "\n")
    for name in ["act1", "act2", "act3", "hangar", "shop"]:
        save_rgb(src, f"bg_{name}.jpg", f"scenes/{name}.webp", 1280, 62)
    for name in ["act1", "act2", "act3"]:
        save_rgb(src, f"fog_{name}.jpg", f"scenes/fog-{name}.webp", 960, 58)
    save_rgb(src, "map_paper.jpg", "scenes/chart.webp", 720, 60)
    for path in sorted(src.glob("ev_*.jpg")):
        save_rgb(src, path.name, f"events/{path.stem[3:]}.webp", 560, 62)
    for path in sorted(src.glob("art_*.jpg")):
        save_rgb(src, path.name, f"cards/{path.stem[4:]}.webp", 340, 64)
    total = sum(p.stat().st_size for p in OUT.rglob("*.webp"))
    print(f"wrote {len(list(OUT.rglob('*.webp')))} files, {total / 1024:.0f} KiB")


if __name__ == "__main__":
    main()
