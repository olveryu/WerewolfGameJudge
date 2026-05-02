/**
 * Audio asset registry — single source of truth for all audio file mappings.
 *
 * Merges begin/end audio into `AUDIO_REGISTRY` so adding a new role only
 * requires a single entry (not two separate maps). Also exports night flow audio,
 * seer label audio, BGM, and contract-test helpers.
 * Contains only `require()` statements and data declarations — zero runtime logic.
 */

import type { RoleId } from '@werewolf/game-engine/models/roles';

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
import bgmFinale from '../../../../assets/bgm/finale.m4a';
import bgmSpeakSoftlyLove from '../../../../assets/bgm/speak_softly_love.m4a';
import bgmTheGodfatherWaltz from '../../../../assets/bgm/the_godfather_waltz.m4a';
import bgmTheImmigrant from '../../../../assets/bgm/the_immigrant.m4a';
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
    begin: slackerBegin,
    end: slackerEnd,
  },
  wildChild: {
    begin: wildChildBegin,
    end: wildChildEnd,
  },
  wolfRobot: {
    begin: wolfRobotBegin,
    end: wolfRobotEnd,
  },
  magician: {
    begin: magicianBegin,
    end: magicianEnd,
  },
  dreamcatcher: {
    begin: dreamcatcherBegin,
    end: dreamcatcherEnd,
  },
  gargoyle: {
    begin: gargoyleBegin,
    end: gargoyleEnd,
  },
  awakenedGargoyle: {
    begin: awakenedGargoyleBegin,
    end: awakenedGargoyleEnd,
  },
  nightmare: {
    begin: nightmareBegin,
    end: nightmareEnd,
  },
  guard: {
    begin: guardBegin,
    end: guardEnd,
  },
  wolf: {
    begin: wolfBegin,
    end: wolfEnd,
  },
  wolfQueen: {
    begin: wolfQueenBegin,
    end: wolfQueenEnd,
  },
  eclipseWolfQueen: {
    begin: eclipseWolfQueenBegin,
    end: eclipseWolfQueenEnd,
  },
  witch: {
    begin: witchBegin,
    end: witchEnd,
  },
  seer: {
    begin: seerBegin,
    end: seerEnd,
  },
  mirrorSeer: {
    begin: seerBegin,
    end: seerEnd,
  },
  drunkSeer: {
    begin: seerBegin,
    end: seerEnd,
  },
  psychic: {
    begin: psychicBegin,
    end: psychicEnd,
  },
  hunter: {
    begin: hunterBegin,
    end: hunterEnd,
  },
  darkWolfKing: {
    begin: darkWolfKingBegin,
    end: darkWolfKingEnd,
  },
  pureWhite: {
    begin: pureWhiteBegin,
    end: pureWhiteEnd,
  },
  wolfWitch: {
    begin: wolfWitchBegin,
    end: wolfWitchEnd,
  },
  silenceElder: {
    begin: silenceElderBegin,
    end: silenceElderEnd,
  },
  votebanElder: {
    begin: votebanElderBegin,
    end: votebanElderEnd,
  },
  piper: {
    begin: piperBegin,
    end: piperEnd,
  },
  shadow: {
    begin: shadowBegin,
    end: shadowEnd,
  },
  avenger: {
    begin: avengerBegin,
    end: avengerEnd,
  },
  crow: {
    begin: crowBegin,
    end: crowEnd,
  },
  poisoner: {
    begin: poisonerBegin,
    end: poisonerEnd,
  },
  treasureMaster: {
    begin: treasureMasterBegin,
    end: treasureMasterEnd,
  },
  thief: {
    begin: thiefBegin,
    end: thiefEnd,
  },
  cupid: {
    begin: cupidBegin,
    end: cupidEnd,
  },
};

// ---------------------------------------------------------------------------
// Seer label audio (multi-seer disambiguation)
// ---------------------------------------------------------------------------

/** Multi-seer label audio (used when >=2 seer-like roles are in play). */
export const SEER_LABEL_AUDIO: Record<string, AudioAsset> = {
  seer_1: seer1Begin,
  seer_2: seer2Begin,
};

export const SEER_LABEL_AUDIO_END: Record<string, AudioAsset> = {
  seer_1: seer1End,
  seer_2: seer2End,
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
    begin: piperHypnotizedRevealBegin,
    end: piperHypnotizedRevealEnd,
  },
  awakenedGargoyleConvertReveal: {
    begin: awakenedGargoyleConvertRevealBegin,
    end: awakenedGargoyleConvertRevealEnd,
  },
  cupidLoversReveal: {
    begin: cupidLoversRevealBegin,
    end: cupidLoversRevealEnd,
  },
};

// ---------------------------------------------------------------------------
// Night flow audio
// ---------------------------------------------------------------------------

export const NIGHT_AUDIO: AudioAsset = nightBegin;
export const NIGHT_END_AUDIO: AudioAsset = nightEndBegin;

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
    asset: bgmTheGodfatherWaltz,
  },
  {
    id: 'speakSoftlyLove',
    label: 'Speak Softly Love',
    subtitle: '温柔倾诉',
    mood: '浪漫深情',
    asset: bgmSpeakSoftlyLove,
  },
  {
    id: 'theImmigrant',
    label: 'The Immigrant',
    subtitle: '移民者',
    mood: '悠远苍凉',
    asset: bgmTheImmigrant,
  },
  {
    id: 'finale',
    label: 'Finale',
    subtitle: '终曲',
    mood: '紧张宏大',
    asset: bgmFinale,
  },
] as const;

/** Valid BGM track IDs for runtime validation. */
export const VALID_BGM_TRACK_IDS: ReadonlySet<string> = new Set<BgmTrackId>(
  BGM_TRACKS.map((t) => t.id),
);

/** BGM setting value: a specific track or 'random' (shuffle playlist). */
export type BgmTrackSetting = BgmTrackId | 'random';

/** Default BGM volume (0.0 to 1.0). */
export const BGM_VOLUME = 0.5;

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
