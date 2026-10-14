# Audio generation scripts

This repo uses pre-generated mp3 narration files, produced by
`scripts/generate_audio_edge_tts.py` (Microsoft Edge TTS):

- `assets/audio/*.mp3` — werewolf: night begin + each role begin + night end
- `assets/audio_end/*.mp3` — werewolf: each role end
- `assets/audio_avalon/*.mp3` — avalon: first-night begins
- `assets/audio_avalon_end/*.mp3` — avalon: first-night ends

Playback in-app is offline (assets are bundled); generation requires
internet access.

## Canonical voice — one narrator for every game

The script's `DEFAULT_*` constants are the single source of truth for the
narration voice. Every batch, for every game, is generated with exactly
these values:

| Parameter | Value                      |
| --------- | -------------------------- |
| Voice     | `zh-CN-YunjianNeural`      |
| Pitch     | `-20Hz`                    |
| Rate      | `-20%`                     |
| Volume    | `+100%`                    |
| Boost     | `+10dB` (ffmpeg post-gain) |

Never generate a batch with different voice parameters. A batch generated
with another voice/pitch/rate sounds like a different narrator — the avalon
assets shipped in Oct 2026 had exactly that defect and were re-recorded
under this set on 2026-10-14. New narration lines are added to the text
tables in the script (`BEGIN_TEXT` / `END_TEXT` / `BEGIN_TEXT_AVALON` /
`END_TEXT_AVALON`); the script is where line wording lives.

## Requirements

- `edge-tts >= 7.2` (`pip install 'edge-tts>=7.2'`). Older releases compute
  a retired Sec-MS-GEC token scheme and Microsoft rejects every synthesis
  handshake with 403.
- `ffmpeg` on PATH (volume boost + trailing-silence post-processing).

## Generate

```bash
# Werewolf (default)
python3 scripts/generate_audio_edge_tts.py

# Avalon
python3 scripts/generate_audio_edge_tts.py --game avalon

# Only one key
python3 scripts/generate_audio_edge_tts.py --only night_end

# Print what would be generated, without generating
python3 scripts/generate_audio_edge_tts.py --dry-run

# Behind a TLS-intercepting corporate proxy (Netskope etc.) whose CA is
# not in certifi's bundle
python3 scripts/generate_audio_edge_tts.py --insecure --only treasure_master

# List available zh-CN male voices (for reference only — see the
# canonical-voice rule above before ever switching)
python3 scripts/generate_audio_edge_tts.py --list-voices
```

## Endpoint migration note

Microsoft retired the legacy read-aloud host (`speech.platform.bing.com`):
the voices list still answers there, but the synthesis handshake rejects
every client. Until a fixed edge-tts release targets the new host
(`api.msedgeservices.com`, see rany2/edge-tts#490), the script carries a
clearly marked stopgap block that rebinds the endpoint constants inside
`edge_tts.communicate`. Delete that block once the installed edge-tts
targets the new host by itself.

## Notes

- `night.mp3` gets 5s of trailing silence appended (iOS Safari workaround);
  see `TRAILING_SILENCE` in the script.
- Asset keys must match the filenames referenced by the client registries
  (e.g. `wolf_robot.mp3`, `dark_wolf_king.mp3`); a missing key fails fast
  at runtime (`MissingAvalonAudioError` / werewolf equivalent).
- This is intended for **local development**. Commit generated mp3 assets
  only when you actually want to update in-app narration.
