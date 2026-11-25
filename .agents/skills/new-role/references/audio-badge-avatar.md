# Audio, badge, and avatar registration — verified surfaces only

## Narration text and voice parameters

Source: `scripts/generate_audio_edge_tts.py`.

- Canonical voice parameters (single source for all narration):
  voice `zh-CN-YunjianNeural`, pitch `-20Hz`, rate `-20%`,
  volume `+100%`, post-processing boost `10` dB (`DEFAULT_VOICE` /
  `DEFAULT_PITCH` / `DEFAULT_RATE` / `DEFAULT_VOLUME` /
  `DEFAULT_BOOST_DB` in the script).
- Narration text lives in `BEGIN_TEXT` / `END_TEXT` dictionaries in the
  same script, keyed by snake-case audio key. A new role needs entries
  for every audio key its steps use. The script supports regenerating
  one key at a time; read its argument handling at run time before
  running it — the exact invocation and output paths were not verified
  for this draft and are not stated here.

## Audio clips and the client registry

- The script's header names its outputs: `assets/audio/` (night begin,
  each role's begin clip, night end) and `assets/audio_end/` (each
  role's end clip). The engine marks end clips with `isEndAudio`
  (`packages/game-engine/src/platform/audio/audioQueue.ts`).
- The web client resolves `audioKey` values through its current
  werewolf audio registry. Update the registry and its contract test at
  `packages/web/src/games/werewolf/audio/__tests__/audioRegistry.test.ts`
  along with engine step declarations. A missing clip is a registration
  failure; do not rely on the removed pre-port registry behavior.

## Badge

Source: `scripts/badge-config.mjs`.

- Add one `EMOJI_MAP` entry: `[folder, file, hasSkinTone]`. Export
  parameters are `EXPORT_SIZES = [128]` and `DEFAULT_OUTDIR =
'assets/badges'`.
- Gap found at drafting time: `cursedFox` has no `EMOJI_MAP` entry.
  Check the map for the new role id and for every existing id you touch.
  Badge output filenames and the generation command were not verified
  for this draft.

## Avatar and role art

- `HAND_DRAWN_AVATAR_IDS` and `AVATAR_RARITY` live in
  `packages/game-engine/src/product/rewards/catalog.ts`. Adding a
  hand-drawn avatar means adding its id and rarity there, following the
  existing entries.
- Hand-drawn portraits for the web client are
  `assets/avatars/web/<id>.webp`, loaded by
  `packages/web/src/components/avatar/avatarSources.ts`, which throws
  at import when an id in `HAND_DRAWN_AVATAR_IDS` has no file. Raw
  avatar source files live under `assets/avatars/raw/`. In-game role
  badge art belongs to the werewolf web client. Update its current role
  presentation mapping and tests when the new role needs custom art.
  The art-production workflow (prompts, approval, processing script
  options) is project-specific; follow the current scripts in
  `scripts/` at run time.
