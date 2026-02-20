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
- "night.mp3" has 5s of trailing silence appended (iOS Safari workaround).

Example:
  python3 scripts/generate_audio_edge_tts.py --voice zh-CN-YunxiNeural
  python3 scripts/generate_audio_edge_tts.py --only night_end
  python3 scripts/generate_audio_edge_tts.py --dry-run
"""

from __future__ import annotations

import argparse
import asyncio
import subprocess
import tempfile
from pathlib import Path

import edge_tts

ROOT_DIR = Path(__file__).resolve().parents[1]
OUT_BEGIN_DIR = ROOT_DIR / "assets" / "audio"
OUT_END_DIR = ROOT_DIR / "assets" / "audio_end"

DEFAULT_VOICE = "zh-CN-YunjianNeural"
DEFAULT_PITCH = "-20Hz"  # Lower pitch for deeper voice
DEFAULT_RATE = "-20%"    # Slower rate for more gravitas
DEFAULT_VOLUME = "+100%"  # Max TTS volume so role narration is clearly audible over BGM
DEFAULT_BOOST_DB = 10      # ffmpeg post-processing gain (dB) — edge-tts caps at +100%, this adds extra loudness

# Trailing silence duration in seconds for specific keys.
# "night" needs 5s silence so iOS Safari doesn't break the audio chain.
TRAILING_SILENCE: dict[str, int] = {
    "night": 5,
}

# Keep text single-source-of-truth here.
BEGIN_TEXT: dict[str, str] = {
    "night": "天黑请闭眼。",
    "night_end": "天亮了，倒数三秒闭眼举手上警，三，二，一。睁眼。",
    "wolf": "狼人请睁眼，互相确认身份后，请选择要击杀的玩家。",
    "wolf_queen": "狼美人请睁眼，请选择魅惑的对象。",
    "dark_wolf_king": "黑狼王请睁眼，请确认开枪状态。",
    "nightmare": "梦魇请睁眼，请选择要封锁的玩家。",
    "gargoyle": "石像鬼请睁眼，请选择要查验的玩家。",
    "wolf_robot": "机械狼请睁眼，请选择要学习的玩家。",
    "guard": "守卫请睁眼，请选择要守护的玩家。",
    "witch": "女巫请睁眼，请选择要使用的药水。",
    "hunter": "猎人请睁眼，请确认开枪状态。",
    "seer": "预言家请睁眼，请选择要查验的玩家。",
    "magician": "魔术师请睁眼，请选择要交换的两名玩家。",
    "psychic": "通灵师请睁眼，请选择查验的玩家。",
    "slacker": "混子请睁眼，请选择你的榜样。",
    "dreamcatcher": "摄梦人请睁眼，请选择摄梦对象。",
    "pure_white": "纯白之女请睁眼，请选择要查验的玩家。",
    "wolf_witch": "狼巫请睁眼，请选择要查验的玩家。",
}

END_TEXT: dict[str, str] = {
    "wolf": "狼人请闭眼。",
    "wolf_queen": "狼美人请闭眼。",
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
    "slacker": "混子请闭眼。",
    "dreamcatcher": "摄梦人请闭眼。",
    "pure_white": "纯白之女请闭眼。",
    "wolf_witch": "狼巫请闭眼。",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--voice", default=DEFAULT_VOICE, help=f"Edge TTS voice short name (default: {DEFAULT_VOICE})")
    parser.add_argument("--pitch", default=DEFAULT_PITCH, help=f"Pitch adjustment e.g. -20Hz (default: {DEFAULT_PITCH})")
    parser.add_argument("--rate", default=DEFAULT_RATE, help=f"Rate adjustment e.g. -20%% (default: {DEFAULT_RATE})")
    parser.add_argument("--volume", default=DEFAULT_VOLUME, help=f"Volume adjustment e.g. +50%% (default: {DEFAULT_VOLUME})")
    parser.add_argument("--boost", type=int, default=DEFAULT_BOOST_DB, help=f"ffmpeg volume boost in dB (default: {DEFAULT_BOOST_DB}). 0 to disable")
    parser.add_argument("--only", default="", help="Generate only one key (e.g. night_end)")
    parser.add_argument("--dry-run", action="store_true", help="Print what would be generated")
    parser.add_argument("--list-voices", action="store_true", help="Print available zh-CN male voices")
    return parser.parse_args()


async def list_voices() -> None:
    voices = await edge_tts.list_voices()
    picks = [v for v in voices if v.get("Locale") == "zh-CN" and v.get("Gender") == "Male"]
    for v in picks:
        print(v.get("ShortName"))


async def generate_one(key: str, text: str, voice: str, pitch: str, rate: str, volume: str, out_path: Path, dry_run: bool, boost_db: int = 0) -> None:
    if dry_run:
        silence = TRAILING_SILENCE.get(key, 0)
        parts = []
        if silence:
            parts.append(f"+{silence}s silence")
        if boost_db:
            parts.append(f"+{boost_db}dB boost")
        suffix = f" ({', '.join(parts)})" if parts else ""
        print(f"[dry-run] -> {out_path}{suffix}")
        return

    out_path.parent.mkdir(parents=True, exist_ok=True)

    silence_seconds = TRAILING_SILENCE.get(key, 0)
    needs_ffmpeg = silence_seconds > 0 or boost_db > 0

    if needs_ffmpeg:
        # Generate to temp file, then post-process with ffmpeg (boost + optional silence)
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
            tmp_path = Path(tmp.name)
        try:
            communicate = edge_tts.Communicate(text, voice, pitch=pitch, rate=rate, volume=volume)
            await communicate.save(str(tmp_path))

            cmd: list[str] = ["ffmpeg", "-y", "-i", str(tmp_path)]

            if silence_seconds > 0:
                # Add silence source input
                cmd += ["-f", "lavfi", "-t", str(silence_seconds), "-i", "anullsrc=r=24000:cl=mono"]
                # Build filter: boost volume then concat with silence
                boost_filter = f"volume={boost_db}dB" if boost_db else ""
                if boost_filter:
                    cmd += ["-filter_complex", f"[0:a]{boost_filter}[boosted];[boosted][1:a]concat=n=2:v=0:a=1"]
                else:
                    cmd += ["-filter_complex", "[0:a][1:a]concat=n=2:v=0:a=1"]
            else:
                # Boost only, no silence
                cmd += ["-af", f"volume={boost_db}dB"]

            cmd += ["-b:a", "48k", str(out_path)]

            subprocess.run(cmd, check=True, capture_output=True)

            parts = []
            if silence_seconds:
                parts.append(f"+{silence_seconds}s silence")
            if boost_db:
                parts.append(f"+{boost_db}dB")
            print(f"Generated {out_path} ({', '.join(parts)})")
        finally:
            tmp_path.unlink(missing_ok=True)
    else:
        communicate = edge_tts.Communicate(text, voice, pitch=pitch, rate=rate, volume=volume)
        await communicate.save(str(out_path))
        print(f"Generated {out_path}")


async def main() -> None:
    args = parse_args()

    if args.list_voices:
        await list_voices()
        return

    only = args.only.strip()
    pitch = args.pitch
    rate = args.rate
    volume = args.volume
    boost = args.boost

    if boost:
        print(f"Post-processing: ffmpeg volume boost +{boost}dB")

    tasks = []

    for key, text in BEGIN_TEXT.items():
        if only and only != key:
            continue
        tasks.append(generate_one(key, text, args.voice, pitch, rate, volume, OUT_BEGIN_DIR / f"{key}.mp3", args.dry_run, boost))

    for key, text in END_TEXT.items():
        if only and only != key:
            continue
        tasks.append(generate_one(key, text, args.voice, pitch, rate, volume, OUT_END_DIR / f"{key}.mp3", args.dry_run, boost))

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
