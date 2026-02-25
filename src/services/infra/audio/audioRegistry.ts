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
export interface RoleAudioEntry {
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
// Night flow audio
// ---------------------------------------------------------------------------

export const NIGHT_AUDIO: AudioAsset = require('../../../../assets/audio/night.mp3');
export const NIGHT_END_AUDIO: AudioAsset = require('../../../../assets/audio/night_end.mp3');

// ---------------------------------------------------------------------------
// Background music
// ---------------------------------------------------------------------------

export const BGM_NIGHT: AudioAsset = require('../../../../assets/audio/bgm_night.mp3');

/** BGM volume (0.0 to 1.0) — keep very low so TTS narration is clearly audible. */
export const BGM_VOLUME = 0.03;

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
