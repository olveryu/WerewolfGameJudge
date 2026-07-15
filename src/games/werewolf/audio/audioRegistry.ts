/**
 * Werewolf narration asset registry — strict mapping from game audio keys to clips.
 *
 * Owns role, step, and night narration for the Werewolf client slice. Product BGM
 * and platform playback stay outside this registry.
 */

import type { RoleId } from '@werewolf/game-engine/games/werewolf/public';

import type { AudioAsset, AudioClip } from '@/services/infra/audio/types';

import avengerBegin from '../../../../assets/audio/avenger.mp3';
import awakenedGargoyleBegin from '../../../../assets/audio/awakened_gargoyle.mp3';
import awakenedGargoyleConvertRevealBegin from '../../../../assets/audio/awakened_gargoyle_convert_reveal.mp3';
import crowBegin from '../../../../assets/audio/crow.mp3';
import cupidBegin from '../../../../assets/audio/cupid.mp3';
import cupidLoversRevealBegin from '../../../../assets/audio/cupid_lovers_reveal.mp3';
import darkWolfKingBegin from '../../../../assets/audio/dark_wolf_king.mp3';
import dreamcatcherBegin from '../../../../assets/audio/dreamcatcher.mp3';
import eclipseWolfQueenBegin from '../../../../assets/audio/eclipse_wolf_queen.mp3';
import gargoyleBegin from '../../../../assets/audio/gargoyle.mp3';
import guardBegin from '../../../../assets/audio/guard.mp3';
import hiddenWolfBegin from '../../../../assets/audio/hidden_wolf.mp3';
import hunterBegin from '../../../../assets/audio/hunter.mp3';
import magicianBegin from '../../../../assets/audio/magician.mp3';
import nightBegin from '../../../../assets/audio/night.mp3';
import nightEndBegin from '../../../../assets/audio/night_end.mp3';
import nightmareBegin from '../../../../assets/audio/nightmare.mp3';
import piperBegin from '../../../../assets/audio/piper.mp3';
import piperHypnotizedRevealBegin from '../../../../assets/audio/piper_hypnotized_reveal.mp3';
import poisonerBegin from '../../../../assets/audio/poisoner.mp3';
import psychicBegin from '../../../../assets/audio/psychic.mp3';
import pureWhiteBegin from '../../../../assets/audio/pure_white.mp3';
import seerBegin from '../../../../assets/audio/seer.mp3';
import seer1Begin from '../../../../assets/audio/seer_1.mp3';
import seer2Begin from '../../../../assets/audio/seer_2.mp3';
import shadowBegin from '../../../../assets/audio/shadow.mp3';
import silenceElderBegin from '../../../../assets/audio/silence_elder.mp3';
import slackerBegin from '../../../../assets/audio/slacker.mp3';
import thiefBegin from '../../../../assets/audio/thief.mp3';
import treasureMasterBegin from '../../../../assets/audio/treasure_master.mp3';
import votebanElderBegin from '../../../../assets/audio/voteban_elder.mp3';
import wildChildBegin from '../../../../assets/audio/wild_child.mp3';
import witchBegin from '../../../../assets/audio/witch.mp3';
import wolfBegin from '../../../../assets/audio/wolf.mp3';
import wolfQueenBegin from '../../../../assets/audio/wolf_queen.mp3';
import wolfRobotBegin from '../../../../assets/audio/wolf_robot.mp3';
import wolfWitchBegin from '../../../../assets/audio/wolf_witch.mp3';
import avengerEnd from '../../../../assets/audio_end/avenger.mp3';
import awakenedGargoyleEnd from '../../../../assets/audio_end/awakened_gargoyle.mp3';
import awakenedGargoyleConvertRevealEnd from '../../../../assets/audio_end/awakened_gargoyle_convert_reveal.mp3';
import crowEnd from '../../../../assets/audio_end/crow.mp3';
import cupidEnd from '../../../../assets/audio_end/cupid.mp3';
import cupidLoversRevealEnd from '../../../../assets/audio_end/cupid_lovers_reveal.mp3';
import darkWolfKingEnd from '../../../../assets/audio_end/dark_wolf_king.mp3';
import dreamcatcherEnd from '../../../../assets/audio_end/dreamcatcher.mp3';
import eclipseWolfQueenEnd from '../../../../assets/audio_end/eclipse_wolf_queen.mp3';
import gargoyleEnd from '../../../../assets/audio_end/gargoyle.mp3';
import guardEnd from '../../../../assets/audio_end/guard.mp3';
import hiddenWolfEnd from '../../../../assets/audio_end/hidden_wolf.mp3';
import hunterEnd from '../../../../assets/audio_end/hunter.mp3';
import magicianEnd from '../../../../assets/audio_end/magician.mp3';
import nightmareEnd from '../../../../assets/audio_end/nightmare.mp3';
import piperEnd from '../../../../assets/audio_end/piper.mp3';
import piperHypnotizedRevealEnd from '../../../../assets/audio_end/piper_hypnotized_reveal.mp3';
import poisonerEnd from '../../../../assets/audio_end/poisoner.mp3';
import psychicEnd from '../../../../assets/audio_end/psychic.mp3';
import pureWhiteEnd from '../../../../assets/audio_end/pure_white.mp3';
import seerEnd from '../../../../assets/audio_end/seer.mp3';
import seer1End from '../../../../assets/audio_end/seer_1.mp3';
import seer2End from '../../../../assets/audio_end/seer_2.mp3';
import shadowEnd from '../../../../assets/audio_end/shadow.mp3';
import silenceElderEnd from '../../../../assets/audio_end/silence_elder.mp3';
import slackerEnd from '../../../../assets/audio_end/slacker.mp3';
import thiefEnd from '../../../../assets/audio_end/thief.mp3';
import treasureMasterEnd from '../../../../assets/audio_end/treasure_master.mp3';
import votebanElderEnd from '../../../../assets/audio_end/voteban_elder.mp3';
import wildChildEnd from '../../../../assets/audio_end/wild_child.mp3';
import witchEnd from '../../../../assets/audio_end/witch.mp3';
import wolfEnd from '../../../../assets/audio_end/wolf.mp3';
import wolfQueenEnd from '../../../../assets/audio_end/wolf_queen.mp3';
import wolfRobotEnd from '../../../../assets/audio_end/wolf_robot.mp3';
import wolfWitchEnd from '../../../../assets/audio_end/wolf_witch.mp3';

// ---------------------------------------------------------------------------
// Role audio registry
// ---------------------------------------------------------------------------

/** Per-role audio pair: beginning narration + ending narration. */
interface WerewolfRoleAudioEntry {
  readonly begin: AudioAsset;
  readonly end: AudioAsset;
}

/** Programming error raised when engine narration metadata has no client asset. */
export class MissingWerewolfAudioError extends Error {
  constructor(
    readonly phase: 'beginning' | 'ending',
    readonly audioKey: string,
  ) {
    super(`[FAIL-FAST] Missing Werewolf ${phase} audio for ${audioKey}`);
    this.name = 'MissingWerewolfAudioError';
  }
}

/**
 * Main registry — each role with night narration gets a single entry
 * containing both begin and end assets. To register a new role's audio,
 * add one entry here.
 */
const ROLE_AUDIO_ENTRIES = [
  [
    'slacker',
    {
      begin: slackerBegin,
      end: slackerEnd,
    },
  ],
  [
    'wildChild',
    {
      begin: wildChildBegin,
      end: wildChildEnd,
    },
  ],
  [
    'wolfRobot',
    {
      begin: wolfRobotBegin,
      end: wolfRobotEnd,
    },
  ],
  [
    'magician',
    {
      begin: magicianBegin,
      end: magicianEnd,
    },
  ],
  [
    'dreamcatcher',
    {
      begin: dreamcatcherBegin,
      end: dreamcatcherEnd,
    },
  ],
  [
    'gargoyle',
    {
      begin: gargoyleBegin,
      end: gargoyleEnd,
    },
  ],
  [
    'awakenedGargoyle',
    {
      begin: awakenedGargoyleBegin,
      end: awakenedGargoyleEnd,
    },
  ],
  [
    'nightmare',
    {
      begin: nightmareBegin,
      end: nightmareEnd,
    },
  ],
  [
    'guard',
    {
      begin: guardBegin,
      end: guardEnd,
    },
  ],
  [
    'wolf',
    {
      begin: wolfBegin,
      end: wolfEnd,
    },
  ],
  [
    'wolfQueen',
    {
      begin: wolfQueenBegin,
      end: wolfQueenEnd,
    },
  ],
  [
    'eclipseWolfQueen',
    {
      begin: eclipseWolfQueenBegin,
      end: eclipseWolfQueenEnd,
    },
  ],
  [
    'witch',
    {
      begin: witchBegin,
      end: witchEnd,
    },
  ],
  [
    'seer',
    {
      begin: seerBegin,
      end: seerEnd,
    },
  ],
  [
    'mirrorSeer',
    {
      begin: seerBegin,
      end: seerEnd,
    },
  ],
  [
    'drunkSeer',
    {
      begin: seerBegin,
      end: seerEnd,
    },
  ],
  [
    'psychic',
    {
      begin: psychicBegin,
      end: psychicEnd,
    },
  ],
  [
    'hunter',
    {
      begin: hunterBegin,
      end: hunterEnd,
    },
  ],
  [
    'darkWolfKing',
    {
      begin: darkWolfKingBegin,
      end: darkWolfKingEnd,
    },
  ],
  [
    'pureWhite',
    {
      begin: pureWhiteBegin,
      end: pureWhiteEnd,
    },
  ],
  [
    'wolfWitch',
    {
      begin: wolfWitchBegin,
      end: wolfWitchEnd,
    },
  ],
  [
    'silenceElder',
    {
      begin: silenceElderBegin,
      end: silenceElderEnd,
    },
  ],
  [
    'votebanElder',
    {
      begin: votebanElderBegin,
      end: votebanElderEnd,
    },
  ],
  [
    'piper',
    {
      begin: piperBegin,
      end: piperEnd,
    },
  ],
  [
    'shadow',
    {
      begin: shadowBegin,
      end: shadowEnd,
    },
  ],
  [
    'avenger',
    {
      begin: avengerBegin,
      end: avengerEnd,
    },
  ],
  [
    'crow',
    {
      begin: crowBegin,
      end: crowEnd,
    },
  ],
  [
    'hiddenWolf',
    {
      begin: hiddenWolfBegin,
      end: hiddenWolfEnd,
    },
  ],
  [
    'poisoner',
    {
      begin: poisonerBegin,
      end: poisonerEnd,
    },
  ],
  [
    'treasureMaster',
    {
      begin: treasureMasterBegin,
      end: treasureMasterEnd,
    },
  ],
  [
    'thief',
    {
      begin: thiefBegin,
      end: thiefEnd,
    },
  ],
  [
    'cupid',
    {
      begin: cupidBegin,
      end: cupidEnd,
    },
  ],
] as const satisfies readonly (readonly [RoleId, WerewolfRoleAudioEntry])[];

const ROLE_AUDIO = new Map<string, WerewolfRoleAudioEntry>(ROLE_AUDIO_ENTRIES);
if (ROLE_AUDIO.size !== ROLE_AUDIO_ENTRIES.length) {
  throw new Error('[FAIL-FAST] Duplicate Werewolf role audio registration');
}

// ---------------------------------------------------------------------------
// Seer label audio (multi-seer disambiguation)
// ---------------------------------------------------------------------------

/** Multi-seer label audio (used when >=2 seer-like roles are in play). */
const SEER_LABEL_AUDIO = new Map<string, AudioAsset>([
  ['seer_1', seer1Begin],
  ['seer_2', seer2Begin],
]);

/** End-of-reveal audio map for multi-seer scenarios. */
const SEER_LABEL_AUDIO_END = new Map<string, AudioAsset>([
  ['seer_1', seer1End],
  ['seer_2', seer2End],
]);

// ---------------------------------------------------------------------------
// Step-specific audio (non-RoleId keys, e.g. multi-step roles)
// ---------------------------------------------------------------------------

/**
 * Audio for night steps whose audioKey differs from their roleId.
 * Lookup order: role audio, numbered Seer labels, then step-specific audio.
 */
const STEP_AUDIO = new Map<string, WerewolfRoleAudioEntry>([
  [
    'piperHypnotizedReveal',
    {
      begin: piperHypnotizedRevealBegin,
      end: piperHypnotizedRevealEnd,
    },
  ],
  [
    'awakenedGargoyleConvertReveal',
    {
      begin: awakenedGargoyleConvertRevealBegin,
      end: awakenedGargoyleConvertRevealEnd,
    },
  ],
  [
    'cupidLoversReveal',
    {
      begin: cupidLoversRevealBegin,
      end: cupidLoversRevealEnd,
    },
  ],
]);

// ---------------------------------------------------------------------------
// Night flow audio
// ---------------------------------------------------------------------------

/** “天黑请闭眼” audio clip. */
const NIGHT_AUDIO: AudioClip = { key: 'night', asset: nightBegin };
/** “天亮请睁眼” audio clip. */
const NIGHT_END_AUDIO: AudioClip = { key: 'night_end', asset: nightEndBegin };

export function resolveWerewolfBeginningAudio(audioKey: string): AudioClip {
  const asset =
    ROLE_AUDIO.get(audioKey)?.begin ??
    SEER_LABEL_AUDIO.get(audioKey) ??
    STEP_AUDIO.get(audioKey)?.begin;
  if (asset === undefined) {
    throw new MissingWerewolfAudioError('beginning', audioKey);
  }
  return { key: `role_begin_${audioKey}`, asset };
}

export function resolveWerewolfEndingAudio(audioKey: string): AudioClip {
  const asset =
    ROLE_AUDIO.get(audioKey)?.end ??
    SEER_LABEL_AUDIO_END.get(audioKey) ??
    STEP_AUDIO.get(audioKey)?.end;
  if (asset === undefined) {
    throw new MissingWerewolfAudioError('ending', audioKey);
  }
  return { key: `role_end_${audioKey}`, asset };
}

export function getWerewolfNightAudio(): AudioClip {
  return NIGHT_AUDIO;
}

export function getWerewolfNightEndAudio(): AudioClip {
  return NIGHT_END_AUDIO;
}

export function getWerewolfPreloadAudio(roles: readonly RoleId[]): readonly AudioClip[] {
  const clips = new Map<string, AudioClip>([
    [NIGHT_AUDIO.key, NIGHT_AUDIO],
    [NIGHT_END_AUDIO.key, NIGHT_END_AUDIO],
  ]);
  for (const role of roles) {
    const entry = ROLE_AUDIO.get(role);
    if (entry === undefined) continue;
    clips.set(`role_begin_${role}`, { key: `role_begin_${role}`, asset: entry.begin });
    clips.set(`role_end_${role}`, { key: `role_end_${role}`, asset: entry.end });
  }
  return [...clips.values()];
}
