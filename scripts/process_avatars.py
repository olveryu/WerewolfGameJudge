#!/usr/bin/env python3
"""Generate optimized avatar and badge assets from raw RGBA PNGs.

Raw images are transparent-background RGBA PNGs (from 豆包 + 去背景处理).
This script produces:
  - 512px PNG badges (existing)
  - 512px WebP avatars for web (quality 80, ~50-80KB each vs ~4MB PNG)
  - 128px WebP badge thumbnails for web (quality 80, ~8-15KB each vs ~400KB PNG)
"""
import sys
from pathlib import Path

from PIL import Image

RAW_DIR = Path(__file__).resolve().parent.parent / "assets" / "avatars" / "raw"
BADGE_DIR = Path(__file__).resolve().parent.parent / "assets" / "badges" / "png" / "512"
AVATAR_WEB_DIR = Path(__file__).resolve().parent.parent / "assets" / "avatars" / "web"
BADGE_WEB_DIR = Path(__file__).resolve().parent.parent / "assets" / "badges" / "web"

WEBP_QUALITY = 80


def main():
    BADGE_DIR.mkdir(parents=True, exist_ok=True)
    AVATAR_WEB_DIR.mkdir(parents=True, exist_ok=True)
    BADGE_WEB_DIR.mkdir(parents=True, exist_ok=True)

    pngs = sorted(RAW_DIR.glob("*.png"))
    if not pngs:
        print(f"No PNG files found in {RAW_DIR}")
        sys.exit(1)

    print(f"Found {len(pngs)} images in {RAW_DIR}\n")

    for i, src in enumerate(pngs, 1):
        role_id = src.stem
        rgba = Image.open(src).convert("RGBA")

        # 512px PNG badge (existing behavior)
        badge_path = BADGE_DIR / f"role_{role_id}.png"
        badge = rgba.resize((512, 512), Image.LANCZOS)
        badge.save(badge_path)

        # 512px WebP avatar for web
        avatar_web_path = AVATAR_WEB_DIR / f"{role_id}.webp"
        avatar_web = rgba.resize((512, 512), Image.LANCZOS)
        avatar_web.save(avatar_web_path, "WEBP", quality=WEBP_QUALITY)

        # 128px WebP badge thumbnail for web
        badge_web_path = BADGE_WEB_DIR / f"role_{role_id}.webp"
        badge_web = rgba.resize((128, 128), Image.LANCZOS)
        badge_web.save(badge_web_path, "WEBP", quality=WEBP_QUALITY)

        print(f"[{i:2d}/{len(pngs)}] {role_id}")

    print(f"\nDone! Generated {len(pngs)} badges (512px PNG)"
          f" + {len(pngs)} avatar WebPs (512px)"
          f" + {len(pngs)} badge WebPs (128px).")


if __name__ == "__main__":
    main()
