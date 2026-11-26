/** Authoritative Decrypto state and lobby configuration. */

import type { GameConfigSchema } from '../../../platform/config/configSchema';
import { isValidConfig } from '../../../platform/config/configSchema';
import type { BaseGameState } from '../../../platform/protocol/roomSnapshot';
import type { RoomSeatProfile } from '../../../platform/room/roster';
import {
  countOccupiedSeats,
  findRosterSeatByUserId,
  type RosterMap,
  type SeatOccupant,
} from '../../../platform/room/seating';

export const DECRYPTO_GAME_TYPE = 'decrypto' as const;
export const DECRYPTO_MIN_PLAYERS = 4;
export const DECRYPTO_MAX_PLAYERS = 8;
export const DECRYPTO_DEFAULT_PLAYERS = 6;
export const DECRYPTO_MAX_ROUNDS = 8;
export const DECRYPTO_REVEAL_INTERVAL_MS = 1400;
export const DECRYPTO_ENCRYPTOR_MODES = ['rotating', 'fixed'] as const;
export const DECRYPTO_TEAMS = ['blue', 'purple'] as const;
export const DECRYPTO_CODES = [1, 2, 3, 4] as const;

export type DecryptoTeam = (typeof DECRYPTO_TEAMS)[number];
export type DecryptoEncryptorMode = (typeof DECRYPTO_ENCRYPTOR_MODES)[number];
export type DecryptoCode = readonly [number, number, number];
export type DecryptoGuess = DecryptoCode;
export type DecryptoKeywords = readonly [string, string, string, string];
export type DecryptoClueTriple = readonly [string, string, string];
export type DecryptoAssignments = Readonly<Record<number, DecryptoTeam>>;
export type DecryptoEncryptors = Readonly<Record<DecryptoTeam, number>>;
export type DecryptoKeywordSets = Readonly<Record<DecryptoTeam, DecryptoKeywords>>;
export type DecryptoClues = Readonly<Record<DecryptoTeam, DecryptoClueTriple | null>>;
export type DecryptoGuesses = Readonly<Record<DecryptoTeam, DecryptoGuess | null>>;
export type DecryptoTiebreakGuesses = Readonly<Record<DecryptoTeam, DecryptoKeywords | null>>;
export type DecryptoTiebreakJudgements = Readonly<Record<DecryptoTeam, readonly boolean[] | null>>;
export type DecryptoHistoryEntry = {
  readonly round: number;
  readonly team: DecryptoTeam;
  readonly code: DecryptoCode;
  readonly clues: DecryptoClueTriple;
  readonly decode: DecryptoGuess;
  readonly intercept: DecryptoGuess | null;
};
export type DecryptoHistory = Readonly<Record<DecryptoTeam, readonly DecryptoHistoryEntry[]>>;
export type DecryptoMarks = Readonly<Record<DecryptoTeam, number>>;
export type DecryptoRevealKind = 'intercept' | 'decode' | 'code';
export type DecryptoOutcome = DecryptoTeam | 'shared';
export type DecryptoPlayStep =
  'encrypt' | 'guess' | 'reveal' | 'continue' | 'tiebreakSubmit' | 'tiebreakJudge';

export interface DecryptoConfig {
  readonly numberOfPlayers: number;
  readonly encryptorMode: DecryptoEncryptorMode;
}

export const DEFAULT_DECRYPTO_CONFIG: DecryptoConfig = {
  numberOfPlayers: DECRYPTO_DEFAULT_PLAYERS,
  encryptorMode: 'rotating',
};

export const DECRYPTO_CONFIG_SCHEMA: GameConfigSchema<DecryptoConfig> = {
  fields: {
    numberOfPlayers: {
      kind: 'count',
      label: '玩家人数',
      hint: '4–8 人，分为两队；可使用机器人补满座位。',
      min: DECRYPTO_MIN_PLAYERS,
      max: DECRYPTO_MAX_PLAYERS,
    },
    encryptorMode: {
      kind: 'choice',
      label: '出题模式',
      hint: '随机轮换：随机首位后按座位轮换；固定出题：每队整局固定一人。',
      options: [
        { value: 'rotating', label: '随机轮换' },
        { value: 'fixed', label: '固定出题' },
      ],
    },
  },
  defaults: DEFAULT_DECRYPTO_CONFIG,
  validate: () => null,
};

/** Checks supported lobby settings without replacing invalid values. */
export function isValidDecryptoConfig(config: DecryptoConfig): boolean {
  return isValidConfig(DECRYPTO_CONFIG_SCHEMA, config);
}

export type DecryptoPhase =
  | { readonly kind: 'lobby' }
  | {
      readonly kind: 'teams';
      readonly assignments: DecryptoAssignments;
      readonly encryptors: Readonly<Record<DecryptoTeam, number | null>>;
    }
  | {
      readonly kind: 'preparing';
      readonly assignments: DecryptoAssignments;
      readonly encryptors: DecryptoEncryptors;
      readonly requestId: string;
    }
  | { readonly kind: 'playing'; readonly game: DecryptoGame }
  | { readonly kind: 'ended'; readonly game: DecryptoGame };

export interface DecryptoGame {
  readonly keywords: DecryptoKeywordSets | null;
  readonly encryptors: DecryptoEncryptors | null;
  readonly assignments: DecryptoAssignments;
  readonly round: number;
  readonly step: DecryptoPlayStep;
  readonly activeTeam: DecryptoTeam | null;
  readonly codes: Readonly<Record<DecryptoTeam, DecryptoCode>>;
  readonly clues: DecryptoClues;
  readonly decoded: DecryptoGuesses;
  readonly intercepted: DecryptoGuesses;
  readonly revealSequence: readonly DecryptoRevealKind[];
  readonly revealIndex: number;
  readonly revealAt: number | null;
  readonly history: DecryptoHistory;
  readonly interceptions: DecryptoMarks;
  readonly miscommunications: DecryptoMarks;
  readonly tiebreakGuesses: DecryptoTiebreakGuesses;
  readonly tiebreakJudgements: DecryptoTiebreakJudgements;
  readonly outcome: DecryptoOutcome | null;
}

export const DECRYPTO_PHASES = ['lobby', 'teams', 'preparing', 'playing', 'ended'] as const;
export type DecryptoPhaseKind = (typeof DECRYPTO_PHASES)[number];

export interface DecryptoHumanSeat extends SeatOccupant {
  readonly profile: RoomSeatProfile;
}

export interface DecryptoState extends BaseGameState<typeof DECRYPTO_GAME_TYPE> {
  readonly phase: DecryptoPhase;
  readonly phaseRevision: number;
  readonly config: DecryptoConfig;
  readonly roster: RosterMap<DecryptoHumanSeat>;
  /** Completed game sequence used for idempotent settlement. */
  readonly gameSequence: number;
  /** Terminal settlement has been emitted for this game. */
  readonly xpSettled: boolean;
}

/** Returns the seat held by a user, or null when they hold no seat. */
export function getDecryptoUserSeat(state: DecryptoState, userId: string): number | null {
  return findRosterSeatByUserId(state.roster, state.config.numberOfPlayers, userId);
}

/** Counts occupied seats (real humans plus bots). */
export function getDecryptoOccupiedSeatCount(state: DecryptoState): number {
  return countOccupiedSeats(state.roster);
}

/** Seat is playable: occupied by a real human or a bot. */
export function isDecryptoOccupiedSeat(state: DecryptoState, seat: number): boolean {
  return state.roster[seat] != null;
}
