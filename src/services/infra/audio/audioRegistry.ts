/**
 * Audio asset registry — single source of truth for all audio file mappings.
 *
 * Merges begin/end audio into `AUDIO_REGISTRY` so adding a new role only
 * requires a single entry (not two separate maps). Also exports night flow audio,
 * seer label audio, BGM, and contract-test helpers.
 * Contains only `require()` statements and data declarations — zero runtime logic.
 */

import type { RoleId } from '@werewolf/game-engine/models/roles';

import type { AudioAsset } from './types';

// ---------------------------------------------------------------------------
// Role audio registry
// ---------------------------------------------------------------------------

/** Per-role audio pair: beginning narration + ending narration. */
interface RoleAudioEntry {
  readonly begin: AudioAsset;
  readonly end: AudioAsset;
}

/**
 * Main registry — each role with night narration gets a single entry
 * containing both begin and end assets. To register a new role's audio,
 * add one entry here (replaces the old AUDIO_FILES + AUDIO_END_FILES pair).
 */
export const AUDIO_REGISTRY: Partial<Record<RoleId, RoleAudioEntry>> = {
  slacker: {
    begin: require('../../../../assets/audio/slacker.mp3'),
    end: require('../../../../assets/audio_end/slacker.mp3'),
  },
  wildChild: {
    begin: require('../../../../assets/audio/wild_child.mp3'),
    end: require('../../../../assets/audio_end/wild_child.mp3'),
  },
  wolfRobot: {
    begin: require('../../../../assets/audio/wolf_robot.mp3'),
    end: require('../../../../assets/audio_end/wolf_robot.mp3'),
  },
  magician: {
    begin: require('../../../../assets/audio/magician.mp3'),
    end: require('../../../../assets/audio_end/magician.mp3'),
  },
  dreamcatcher: {
    begin: require('../../../../assets/audio/dreamcatcher.mp3'),
    end: require('../../../../assets/audio_end/dreamcatcher.mp3'),
  },
  gargoyle: {
    begin: require('../../../../assets/audio/gargoyle.mp3'),
    end: require('../../../../assets/audio_end/gargoyle.mp3'),
  },
  awakenedGargoyle: {
    begin: require('../../../../assets/audio/awakened_gargoyle.mp3'),
    end: require('../../../../assets/audio_end/awakened_gargoyle.mp3'),
  },
  nightmare: {
    begin: require('../../../../assets/audio/nightmare.mp3'),
    end: require('../../../../assets/audio_end/nightmare.mp3'),
  },
  guard: {
    begin: require('../../../../assets/audio/guard.mp3'),
    end: require('../../../../assets/audio_end/guard.mp3'),
  },
  wolf: {
    begin: require('../../../../assets/audio/wolf.mp3'),
    end: require('../../../../assets/audio_end/wolf.mp3'),
  },
  wolfQueen: {
    begin: require('../../../../assets/audio/wolf_queen.mp3'),
    end: require('../../../../assets/audio_end/wolf_queen.mp3'),
  },
  witch: {
    begin: require('../../../../assets/audio/witch.mp3'),
    end: require('../../../../assets/audio_end/witch.mp3'),
  },
  seer: {
    begin: require('../../../../assets/audio/seer.mp3'),
    end: require('../../../../assets/audio_end/seer.mp3'),
  },
  mirrorSeer: {
    begin: require('../../../../assets/audio/seer.mp3'),
    end: require('../../../../assets/audio_end/seer.mp3'),
  },
  drunkSeer: {
    begin: require('../../../../assets/audio/seer.mp3'),
    end: require('../../../../assets/audio_end/seer.mp3'),
  },
  psychic: {
    begin: require('../../../../assets/audio/psychic.mp3'),
    end: require('../../../../assets/audio_end/psychic.mp3'),
  },
  hunter: {
    begin: require('../../../../assets/audio/hunter.mp3'),
    end: require('../../../../assets/audio_end/hunter.mp3'),
  },
  darkWolfKing: {
    begin: require('../../../../assets/audio/dark_wolf_king.mp3'),
    end: require('../../../../assets/audio_end/dark_wolf_king.mp3'),
  },
  pureWhite: {
    begin: require('../../../../assets/audio/pure_white.mp3'),
    end: require('../../../../assets/audio_end/pure_white.mp3'),
  },
  wolfWitch: {
    begin: require('../../../../assets/audio/wolf_witch.mp3'),
    end: require('../../../../assets/audio_end/wolf_witch.mp3'),
  },
  silenceElder: {
    begin: require('../../../../assets/audio/silence_elder.mp3'),
    end: require('../../../../assets/audio_end/silence_elder.mp3'),
  },
  votebanElder: {
    begin: require('../../../../assets/audio/voteban_elder.mp3'),
    end: require('../../../../assets/audio_end/voteban_elder.mp3'),
  },
  piper: {
    begin: require('../../../../assets/audio/piper.mp3'),
    end: require('../../../../assets/audio_end/piper.mp3'),
  },
  shadow: {
    begin: require('../../../../assets/audio/shadow.mp3'),
    end: require('../../../../assets/audio_end/shadow.mp3'),
  },
  avenger: {
    begin: require('../../../../assets/audio/avenger.mp3'),
    end: require('../../../../assets/audio_end/avenger.mp3'),
  },
  crow: {
    begin: require('../../../../assets/audio/crow.mp3'),
    end: require('../../../../assets/audio_end/crow.mp3'),
  },
  poisoner: {
    begin: require('../../../../assets/audio/poisoner.mp3'),
    end: require('../../../../assets/audio_end/poisoner.mp3'),
  },
  treasureMaster: {
    begin: require('../../../../assets/audio/treasure_master.mp3'),
    end: require('../../../../assets/audio_end/treasure_master.mp3'),
  },
  thief: {
    begin: require('../../../../assets/audio/thief.mp3'),
    end: require('../../../../assets/audio_end/thief.mp3'),
  },
  cupid: {
    begin: require('../../../../assets/audio/cupid.mp3'),
    end: require('../../../../assets/audio_end/cupid.mp3'),
  },
};

// ---------------------------------------------------------------------------
// Seer label audio (multi-seer disambiguation)
// ---------------------------------------------------------------------------

/** Multi-seer label audio (used when >=2 seer-like roles are in play). */
export const SEER_LABEL_AUDIO: Record<string, AudioAsset> = {
  seer_1: require('../../../../assets/audio/seer_1.mp3'),
  seer_2: require('../../../../assets/audio/seer_2.mp3'),
};

export const SEER_LABEL_AUDIO_END: Record<string, AudioAsset> = {
  seer_1: require('../../../../assets/audio_end/seer_1.mp3'),
  seer_2: require('../../../../assets/audio_end/seer_2.mp3'),
};

// ---------------------------------------------------------------------------
// Step-specific audio (non-RoleId keys, e.g. multi-step roles)
// ---------------------------------------------------------------------------

/**
 * Audio for night steps whose audioKey differs from their roleId.
 * Lookup fallback chain: AUDIO_REGISTRY → SEER_LABEL_AUDIO → STEP_AUDIO.
 */
export const STEP_AUDIO: Record<string, RoleAudioEntry> = {
  piperHypnotizedReveal: {
    begin: require('../../../../assets/audio/piper_hypnotized_reveal.mp3'),
    end: require('../../../../assets/audio_end/piper_hypnotized_reveal.mp3'),
  },
  awakenedGargoyleConvertReveal: {
    begin: require('../../../../assets/audio/awakened_gargoyle_convert_reveal.mp3'),
    end: require('../../../../assets/audio_end/awakened_gargoyle_convert_reveal.mp3'),
  },
  cupidLoversReveal: {
    begin: require('../../../../assets/audio/cupid_lovers_reveal.mp3'),
    end: require('../../../../assets/audio_end/cupid_lovers_reveal.mp3'),
  },
};

// ---------------------------------------------------------------------------
// Night flow audio
// ---------------------------------------------------------------------------

export const NIGHT_AUDIO: AudioAsset = require('../../../../assets/audio/night.mp3');
export const NIGHT_END_AUDIO: AudioAsset = require('../../../../assets/audio/night_end.mp3');

// ---------------------------------------------------------------------------
// Background music
// ---------------------------------------------------------------------------

/** Available BGM track identifiers. */
export type BgmTrackId = 'finale' | 'speakSoftlyLove' | 'theGodfatherWaltz' | 'theImmigrant';

/** BGM track metadata + asset mapping. */
export interface BgmTrackEntry {
  readonly id: BgmTrackId;
  readonly label: string;
  /** 中文副标题 */
  readonly subtitle: string;
  /** 氛围/风格标签 */
  readonly mood: string;
  readonly asset: AudioAsset;
}

/** All available BGM tracks, ordered for display. */
export const BGM_TRACKS: readonly BgmTrackEntry[] = [
  {
    id: 'theGodfatherWaltz',
    label: 'The Godfather Waltz',
    subtitle: '教父华尔兹',
    mood: '优雅庄重',
    asset: require('../../../../assets/bgm/the_godfather_waltz.m4a'),
  },
  {
    id: 'speakSoftlyLove',
    label: 'Speak Softly Love',
    subtitle: '温柔倾诉',
    mood: '浪漫深情',
    asset: require('../../../../assets/bgm/speak_softly_love.m4a'),
  },
  {
    id: 'theImmigrant',
    label: 'The Immigrant',
    subtitle: '移民者',
    mood: '悠远苍凉',
    asset: require('../../../../assets/bgm/the_immigrant.m4a'),
  },
  {
    id: 'finale',
    label: 'Finale',
    subtitle: '终曲',
    mood: '紧张宏大',
    asset: require('../../../../assets/bgm/finale.m4a'),
  },
] as const;

/** Valid BGM track IDs for runtime validation. */
export const VALID_BGM_TRACK_IDS: ReadonlySet<string> = new Set<BgmTrackId>(
  BGM_TRACKS.map((t) => t.id),
);

/** BGM setting value: a specific track or 'random' (shuffle playlist). */
export type BgmTrackSetting = BgmTrackId | 'random';

/** BGM volume (0.0 to 1.0) — keep low so TTS narration is clearly audible. */
export const BGM_VOLUME = 0.1;

// ---------------------------------------------------------------------------
// Contract-test helpers
// ---------------------------------------------------------------------------

/**
 * Exported for contract testing — verifies audio coverage of NIGHT_STEPS.
 * Since begin & end are co-located in AUDIO_REGISTRY, both arrays are identical.
 * @internal Do not use outside __tests__/.
 */
export const _AUDIO_ROLE_IDS: readonly RoleId[] = Object.keys(AUDIO_REGISTRY) as RoleId[];
export const _AUDIO_END_ROLE_IDS: readonly RoleId[] = Object.keys(AUDIO_REGISTRY) as RoleId[];
