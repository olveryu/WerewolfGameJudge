# Audio generation scripts

This repo uses pre-generated mp3 narration files under:

- `assets/audio/*.mp3` (night begin + each role begins)
- `assets/audio_end/*.mp3` (each role ends + night end)

## Generate (recommended: Edge TTS, better quality)

If you want much more natural Mandarin voices (and consistent mp3 output), use the Edge TTS generator:

```bash
python3 scripts/generate_audio_edge_tts.py --voice zh-CN-YunxiNeural
```

Generate only one key:

```bash
python3 scripts/generate_audio_edge_tts.py --only night_end
```

List available zh-CN male voices:

```bash
python3 scripts/generate_audio_edge_tts.py --list-voices
```

Notes:
- Generating requires internet access.
- Playback in-app is offline (assets are bundled).

## Generate (macOS `say`, fallback)

The script `scripts/generate_audio.sh` regenerates these files using the built-in macOS TTS (`say`) and attempts to convert them to mp3 using `afconvert`.

### List available voices

```bash
./scripts/generate_audio.sh --list-voices
```

### Dry run (print what would be generated)

```bash
./scripts/generate_audio.sh --dry-run
```

### Generate one role

```bash
./scripts/generate_audio.sh --only nightmare
```

### Choose voice / speed

```bash
./scripts/generate_audio.sh --voice Tingting --speed 175
```

## Notes

- This is intended for **local development**. Commit generated mp3 assets only when you actually want to update in-app narration.
- The text lines in `generate_audio.sh` are the single editable source for the spoken prompts.
- Asset keys must match the filenames referenced by `AudioService` (e.g. `wolf_robot.mp3`, `dark_wolf_king.mp3`).
