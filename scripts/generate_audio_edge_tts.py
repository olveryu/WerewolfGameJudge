#!/usr/bin/env python3
"""Generate narration audio files using Microsoft Edge TTS.

Why:
- macOS `say` voice quality varies and MP3 encoding may be unavailable on some machines.
- Edge TTS provides much more natural Chinese voices and can directly output MP3.

Outputs (by default):
- assets/audio/*.mp3      (night begin + each role begins + night_end)
- assets/audio_end/*.mp3  (each role ends)

Notes:
- Generating requires internet access.
- Playback in-app is offline; files are bundled as static assets.

Example:
  python3 scripts/generate_audio_edge_tts.py --voice zh-CN-YunxiNeural
  python3 scripts/generate_audio_edge_tts.py --only night_end
  python3 scripts/generate_audio_edge_tts.py --dry-run
"""

from __future__ import annotations

import argparse
import asyncio
from pathlib import Path

import edge_tts

ROOT_DIR = Path(__file__).resolve().parents[1]
OUT_BEGIN_DIR = ROOT_DIR / "assets" / "audio"
OUT_END_DIR = ROOT_DIR / "assets" / "audio_end"

DEFAULT_VOICE = "zh-CN-YunxiNeural"

# Keep text single-source-of-truth here.
BEGIN_TEXT: dict[str, str] = {
    "night": "天黑请闭眼。",
    "night_end": "天亮了，倒数三秒闭眼举手上警，三，二，一。睁眼。",
    "wolf": "狼人请睁眼，互相确认身份后，请选择要击杀的玩家。",
    "wolf_queen": "狼后请睁眼。",
    "dark_wolf_king": "黑狼王请睁眼。",
    "nightmare": "梦魇请睁眼，请选择要封锁的玩家。",
    "gargoyle": "石像鬼请睁眼，请选择要查验的玩家。",
    "wolf_robot": "机械狼请睁眼，请选择要学习的玩家。",
    "guard": "守卫请睁眼，请选择要守护的玩家。",
    "witch": "女巫请睁眼。",
    "hunter": "猎人请睁眼。",
    "seer": "预言家请睁眼，请选择要查验的玩家。",
    "magician": "魔术师请睁眼，请选择要交换的两名玩家。",
    "psychic": "通灵师请睁眼。",
    "slacker": "懒人请睁眼。",
    "dreamcatcher": "摄梦人请睁眼，请选择摄梦对象。",
}

END_TEXT: dict[str, str] = {
    "wolf": "狼人请闭眼。",
    "wolf_queen": "狼后请闭眼。",
    "dark_wolf_king": "黑狼王请闭眼。",
    "nightmare": "梦魇请闭眼。",
    "gargoyle": "石像鬼请闭眼。",
    "wolf_robot": "机械狼请闭眼。",
    "guard": "守卫请闭眼。",
    "witch": "女巫请闭眼。",
    "hunter": "猎人请闭眼。",
    "seer": "预言家请闭眼。",
    "magician": "魔术师请闭眼。",
    "psychic": "通灵师请闭眼。",
    "slacker": "懒人请闭眼。",
    "dreamcatcher": "摄梦人请闭眼。",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--voice", default=DEFAULT_VOICE, help=f"Edge TTS voice short name (default: {DEFAULT_VOICE})")
    parser.add_argument("--only", default="", help="Generate only one key (e.g. night_end)")
    parser.add_argument("--dry-run", action="store_true", help="Print what would be generated")
    parser.add_argument("--list-voices", action="store_true", help="Print available zh-CN male voices")
    return parser.parse_args()


async def list_voices() -> None:
    voices = await edge_tts.list_voices()
    picks = [v for v in voices if v.get("Locale") == "zh-CN" and v.get("Gender") == "Male"]
    for v in picks:
        print(v.get("ShortName"))


async def generate_one(text: str, voice: str, out_path: Path, dry_run: bool) -> None:
    if dry_run:
        print(f"[dry-run] -> {out_path}")
        return

    out_path.parent.mkdir(parents=True, exist_ok=True)
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(str(out_path))


async def main() -> None:
    args = parse_args()

    if args.list_voices:
        await list_voices()
        return

    only = args.only.strip()

    tasks = []

    for key, text in BEGIN_TEXT.items():
        if only and only != key:
            continue
        tasks.append(generate_one(text, args.voice, OUT_BEGIN_DIR / f"{key}.mp3", args.dry_run))

    for key, text in END_TEXT.items():
        if only and only != key:
            continue
        tasks.append(generate_one(text, args.voice, OUT_END_DIR / f"{key}.mp3", args.dry_run))

    if not tasks:
        raise SystemExit(f"No tasks to run (only={only!r}).")

    # Run sequentially to avoid rate-limit spikes and to keep logs readable.
    for t in tasks:
        await t

    if not args.dry_run:
        print("Done.")
        print("Generated:")
        print(f"  {OUT_BEGIN_DIR}")
        print(f"  {OUT_END_DIR}")


if __name__ == "__main__":
    asyncio.run(main())
