"""Turn raw painted art into the compressed WebP files under src/assets/art.

Usage: python3 tools/process-art.py <raw-dir>

Raw jets (side views, plus the rear and front-quarter chase-camera views) are
painted on flat magenta and keyed out here. Clouds are painted on
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

# Side views whose exhaust is not a lit blob at the tail: the A-10's engines sit in pods mid-fuselage.
SIDE_NOZZLE_FIXED = {"a10"}

# Side views with an unlit exhaust, as fractions of the cropped sprite.
SIDE_NOZZLE = {"f16": [0.17, 0.62]}


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
        nozzle = [round((nx - x0) / crop.width, 4), round((ny - y0) / crop.height, 4)]
        if jet not in SIDE_NOZZLE_FIXED:
            # The exhaust is the hot blob at the tail end (the left) of a side view.
            tail = crop.crop((0, 0, int(crop.width * 0.42), crop.height))
            blobs = glow_blobs(tail)
            if blobs:
                bx, by, br = min(blobs)
                nozzle = [round((bx + br * 0.6) * 0.42, 4), by]
        meta[jet] = {"aspect": round(crop.width / crop.height, 4), "nozzle": SIDE_NOZZLE.get(jet, nozzle)}
    return meta


PLAYER_CAMS = ["f16", "f15e", "f22", "ea18g", "a10"]
FOE_CAMS = [
    "f104", "alphajet", "f4f", "mig29", "tornado", "typhoon", "f35",
    "f4f_boss", "typhoon_boss", "f35_boss",
]

# Rear views whose livery fools the glow finder, as [x, y, r] fractions of the cropped sprite.
CHASE_NOZZLES = {
    "f4f_boss-rear": [[0.445, 0.875, 0.026], [0.555, 0.875, 0.026]],
    "typhoon_boss-rear": [[0.455, 0.945, 0.034], [0.545, 0.945, 0.034]],
}

# Painted-on underwing stores (and one long exhaust flame) to clear, as [x0, y0, x1, y1] fractions
# of the cropped sprite. The game hangs its own missiles on the pylons so they can be launched.
CHASE_ERASE = {
    "a10-rear": [[0.125, 0.67, 0.195, 0.80], [0.202, 0.70, 0.255, 0.83], [0.745, 0.70, 0.798, 0.83], [0.805, 0.67, 0.875, 0.80]],
    "f104-rear": [[0.21, 0.77, 0.30, 0.91], [0.705, 0.77, 0.80, 0.91]],
    "alphajet-rear": [[0.165, 0.70, 0.23, 0.805], [0.78, 0.70, 0.845, 0.805]],
    "alphajet-front": [[0.105, 0.712, 0.178, 0.795], [0.735, 0.743, 0.858, 0.84]],
    "mig29-rear": [[0.16, 0.703, 0.276, 0.752], [0.724, 0.703, 0.84, 0.752]],
    "typhoon_boss-rear": [[0.103, 0.81, 0.149, 0.885], [0.851, 0.81, 0.897, 0.885]],
    "f35-rear": [[0.43, 0.79, 0.57, 1.0]],
}


def glow_blobs(rgba: Image.Image) -> list:
    """Finds the lit exhausts in a rear view: hot orange or blue-white blobs, as [x, y, r] fractions."""
    small = rgba.resize((rgba.width // 4, rgba.height // 4), Image.BILINEAR)
    a = np.asarray(small).astype(np.int32)
    r, g, b, alpha = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    hot = (r > 205) & (g > 95) & (b < 150) & (r - b > 80)
    cold = (b > 205) & (g > 150) & (r < 175)
    white = (r > 245) & (g > 225) & (b > 190)
    mask = (hot | cold | white) & (alpha > 200)
    h, w = mask.shape
    seen = np.zeros_like(mask)
    blobs = []
    for y0 in range(h):
        for x0 in range(w):
            if not mask[y0, x0] or seen[y0, x0]:
                continue
            stack = [(y0, x0)]
            seen[y0, x0] = True
            pts = []
            while stack:
                y, x = stack.pop()
                pts.append((y, x))
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        stack.append((ny, nx))
            if len(pts) >= max(6, h * w * 0.0012):
                ys = np.array([p[0] for p in pts])
                xs = np.array([p[1] for p in pts])
                blobs.append((len(pts), xs.mean(), ys.mean()))
    blobs.sort(reverse=True)
    out = []
    for area, cx, cy in blobs[:2]:
        if out and area < blobs[0][0] * 0.35:
            break
        out.append([round(cx / w, 4), round(cy / h, 4), round(float(np.sqrt(area / np.pi)) / w, 4)])
    return sorted(out)


def process_chase(src: Path) -> dict:
    """Rear (chase-camera) and front-quarter (attacking) views for the battle stage."""
    meta = {}
    (OUT / "chase").mkdir(parents=True, exist_ok=True)
    jobs = [(f"cam_{j}.jpg", f"{j}-rear", 720, True) for j in PLAYER_CAMS]
    for foe in FOE_CAMS:
        jobs.append((f"rear_{foe}.jpg", f"{foe}-rear", 560, True))
        jobs.append((f"front_{foe}.jpg", f"{foe}-front", 560, False))
    for name, out, width, rear in jobs:
        raw = Image.open(src / name)
        keyed = key_magenta(raw)
        alpha = np.asarray(keyed)[..., 3]
        ys, xs = np.where(alpha > 26)
        pad = 8
        x0, x1 = max(0, xs.min() - pad), min(raw.width, xs.max() + pad)
        y0, y1 = max(0, ys.min() - pad), min(raw.height, ys.max() + pad)
        crop = keyed.crop((x0, y0, x1, y1))
        boxes = CHASE_ERASE.get(out)
        if boxes:
            px = np.array(crop)
            for bx0, by0, bx1, by1 in boxes:
                px[int(by0 * crop.height):int(by1 * crop.height), int(bx0 * crop.width):int(bx1 * crop.width)] = 0
            crop = Image.fromarray(px, "RGBA")
            ys, xs = np.where(px[..., 3] > 26)
            crop = crop.crop((max(0, xs.min() - pad), max(0, ys.min() - pad), min(crop.width, xs.max() + pad), min(crop.height, ys.max() + pad)))
        final = resize_rgba(crop, width)
        final.save(OUT / "chase" / f"{out}.webp", "WEBP", quality=78, method=6)
        meta[out] = {"aspect": round(crop.width / crop.height, 4), "nozzles": CHASE_NOZZLES.get(out) or (glow_blobs(crop) if rear else [])}
    return meta


def save_rgb(src: Path, name: str, out: str, width: int, quality: int):
    img = Image.open(src / name).convert("RGB")
    height = round(img.height * width / img.width)
    img = img.resize((width, height), Image.LANCZOS)
    path = OUT / out
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "WEBP", quality=quality, method=6)


def tileable(img: Image.Image) -> Image.Image:
    """Cross-fades a picture into a half-shifted copy of itself towards its edges, so it repeats without a seam."""
    a = np.asarray(img).astype(np.float32)
    h, w, _ = a.shape
    shifted = np.roll(np.roll(a, h // 2, 0), w // 2, 1)
    edge = np.maximum(np.abs(np.linspace(-1, 1, h))[:, None], np.abs(np.linspace(-1, 1, w))[None, :])
    keep = np.clip((1 - edge) / 0.3, 0, 1)
    keep = (keep * keep * (3 - 2 * keep))[..., None]
    return Image.fromarray(np.clip(a * keep + shifted * (1 - keep), 0, 255).astype(np.uint8), "RGB")


def save_square(src: Path, name: str, out: str, size: int, quality: int):
    """A ground texture for the flight backdrop: square and seamless, so the renderer can tile it."""
    img = tileable(Image.open(src / name).convert("RGB").resize((size, size), Image.LANCZOS))
    path = OUT / out
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "WEBP", quality=quality, method=6)


def write_masks():
    """A coarse map of where each chase sprite is solid, for the test that keeps every anchor on the airframe."""
    out = {}
    for path in sorted((OUT / "chase").glob("*.webp")):
        alpha = Image.open(path).convert("RGBA").getchannel("A")
        w = 128
        h = max(1, round(alpha.height * w / alpha.width))
        cells = np.asarray(alpha.resize((w, h), Image.BOX)) > 110
        # One hex string per row, four cells to a digit, left to right.
        rows = ["".join(f"{int(''.join('1' if c else '0' for c in row[i:i + 4]), 2):x}" for i in range(0, w, 4)) for row in cells]
        out[path.stem] = {"w": w, "h": h, "rows": rows}
    (OUT / "chase-mask.json").write_text(json.dumps(out, separators=(",", ":")) + "\n")


def main():
    src = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/artsrc")
    meta = process_jets(src)
    (OUT / "jets.json").write_text(json.dumps(meta, indent=2) + "\n")
    chase = process_chase(src)
    (OUT / "chase.json").write_text(json.dumps(chase, indent=2) + "\n")
    for name in ["act1", "act2", "act3", "hangar", "shop"]:
        save_rgb(src, f"bg_{name}.jpg", f"scenes/{name}.webp", 1280, 62)
    for act in ["act1", "act2", "act3"]:
        save_rgb(src, f"bg_chase_{act}.jpg", f"scenes/chase-{act}.webp", 1440, 60)
    for act in ["act1", "act2", "act3"]:
        save_square(src, f"ground_{act}.jpg", f"scenes/ground-{act}.webp", 1024, 62)
    for name in ["act1", "act2", "act3"]:
        save_rgb(src, f"fog_{name}.jpg", f"scenes/fog-{name}.webp", 960, 58)
    save_rgb(src, "map_paper.jpg", "scenes/chart.webp", 720, 60)
    for path in sorted(src.glob("ev_*.jpg")):
        save_rgb(src, path.name, f"events/{path.stem[3:]}.webp", 560, 62)
    for path in sorted(src.glob("art_*.jpg")):
        save_rgb(src, path.name, f"cards/{path.stem[4:]}.webp", 340, 64)
    write_masks()
    total = sum(p.stat().st_size for p in OUT.rglob("*.webp"))
    print(f"wrote {len(list(OUT.rglob('*.webp')))} files, {total / 1024:.0f} KiB")


if __name__ == "__main__":
    main()
