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

## Notes

- This is intended for **local development**. Commit generated mp3 assets only when you actually want to update in-app narration.
- Asset keys must match the filenames referenced by `AudioService` (e.g. `wolf_robot.mp3`, `dark_wolf_king.mp3`).
