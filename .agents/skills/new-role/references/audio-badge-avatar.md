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

## Audio registry

Source: `src/games/werewolf/audio/audioRegistry.ts`.

- `ROLE_AUDIO` maps an audio key to `{ begin, end }` clips.
- `STEP_AUDIO` holds only step-specific entries whose key differs from
  a role id (at drafting time: `piperHypnotizedReveal`,
  `awakenedGargoyleConvertReveal`, `cupidLoversReveal`,
  `seedWolfInfectReveal`).
- Lookup order in `resolveWerewolfBeginningAudio` /
  `resolveWerewolfEndingAudio`: role audio, then numbered seer labels,
  then step audio. A missing key throws; there is no silent fallback.
  Every distinct `audioKey` in the new role's steps must resolve.

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
- Role badge art lives in `src/games/werewolf/assets/roleBadges.ts`
  (and `roleBadges.web.ts`); avatar images in
  `src/utils/avatarImages.ts` (and `avatarImages.web.ts`). Raw avatar
  source files live under `assets/avatars/raw/`. The art-production
  workflow (prompts, approval, processing script options) was not
  verified for this draft: follow the scripts in `scripts/` at run time.
