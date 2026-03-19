#!/usr/bin/env python3
"""Generate 512px badge PNGs from raw RGBA avatars.

Raw images are transparent-background RGBA PNGs (from 豆包 + 去背景处理).
This script resizes them to 512x512 badges used by the app.
"""
import sys
from pathlib import Path

from PIL import Image

RAW_DIR = Path(__file__).resolve().parent.parent / "assets" / "avatars" / "raw"
BADGE_DIR = Path(__file__).resolve().parent.parent / "assets" / "badges" / "png" / "512"


def main():
    BADGE_DIR.mkdir(parents=True, exist_ok=True)

    pngs = sorted(RAW_DIR.glob("*.png"))
    if not pngs:
        print(f"No PNG files found in {RAW_DIR}")
        sys.exit(1)

    print(f"Found {len(pngs)} images in {RAW_DIR}\n")

    for i, src in enumerate(pngs, 1):
        role_id = src.stem
        badge_path = BADGE_DIR / f"role_{role_id}.png"

        rgba = Image.open(src).convert("RGBA")
        badge = rgba.resize((512, 512), Image.LANCZOS)
        badge.save(badge_path)

        print(f"[{i:2d}/{len(pngs)}] {role_id}")

    print(f"\nDone! Generated {len(pngs)} badges (512x512).")


if __name__ == "__main__":
    main()
