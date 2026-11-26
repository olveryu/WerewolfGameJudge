/** Decrypto decision outcomes, stable rejection codes, and domain events. */

import { commit, type Decision } from '../../../platform/engine';
import type { GameCompletionPayload } from '../../../platform/engine/completionEffect';
import { type RosterChange } from '../../../platform/room/seating';
import type { DecryptoCompletionPayload } from '../publicStats';
import type {
  DecryptoAssignments,
  DecryptoEncryptors,
  DecryptoGame,
  DecryptoHumanSeat,
  DecryptoKeywords,
  DecryptoState,
  DecryptoTeam,
} from '../state/types';

export const DECRYPTO_REASONS = {
  config: 'decrypto_config_invalid',
  phase: 'decrypto_phase_invalid',
  notHostStart: 'decrypto_not_host_start',
  notHostRestart: 'decrypto_not_host_restart',
  notHostTeams: 'decrypto_not_host_teams',
  full: 'decrypto_room_not_full',
  occupied: 'decrypto_occupied_seat_out_of_range',
  notTeamMember: 'decrypto_actor_not_team_member',
  notEncryptor: 'decrypto_actor_not_encryptor',
  ineligibleDecoder: 'decrypto_encryptor_cannot_decode',
  duplicateGuess: 'decrypto_guess_already_submitted',
  invalidGuess: 'decrypto_guess_invalid',
  invalidClues: 'decrypto_clues_invalid',
  invalidTeam: 'decrypto_team_invalid',
  stale: 'decrypto_command_stale',
  revealEarly: 'decrypto_reveal_not_due',
  notHostContinue: 'decrypto_not_host_continue',
  notHostJudge: 'decrypto_not_host_judge',
  duplicateTiebreak: 'decrypto_tiebreak_already_submitted',
  notPreparing: 'decrypto_not_preparing',
  wordsInvalid: 'decrypto_words_invalid',
} as const;

export type DecryptoEvent =
  | {
      readonly type: 'decrypto.seats.changed';
      readonly changes: readonly RosterChange<DecryptoHumanSeat>[];
    }
  | { readonly type: 'decrypto.config.updated'; readonly config: DecryptoState['config'] }
  | {
      readonly type: 'decrypto.teams.started';
      readonly assignments: DecryptoAssignments;
      readonly encryptors: Readonly<Record<DecryptoTeam, number | null>>;
      readonly gameSequence: number;
    }
  | {
      readonly type: 'decrypto.teams.updated';
      readonly assignments: DecryptoAssignments;
      readonly encryptors: Readonly<Record<DecryptoTeam, number | null>>;
    }
  | {
      readonly type: 'decrypto.preparation.started';
      readonly assignments: DecryptoGame['assignments'];
      readonly encryptors: DecryptoEncryptors;
      readonly requestId: string;
    }
  | { readonly type: 'decrypto.play.started'; readonly game: DecryptoGame }
  | { readonly type: 'decrypto.game.updated'; readonly game: DecryptoGame }
  | { readonly type: 'decrypto.game.ended'; readonly game: DecryptoGame }
  | { readonly type: 'decrypto.game.returnedToLobby' };

export type DecryptoEffect =
  | {
      readonly type: 'decrypto.words.select';
      readonly payload: {
        readonly requestId: string;
        readonly gameSequence: number;
        readonly participantUserIds: readonly string[];
      };
    }
  | {
      readonly type: 'decrypto.reveal.due';
      readonly payload: {
        readonly gameSequence: number;
        readonly round: number;
        readonly team: DecryptoTeam;
        readonly revealIndex: number;
        readonly revealAt: number;
      };
    }
  | {
      readonly type: 'decrypto.game.completed';
      readonly payload: DecryptoCompletionPayload | GameCompletionPayload;
    };

export type DecryptoDecision = Decision<DecryptoEvent, DecryptoEffect>;

/** Commits domain events and completion effects through the shared runtime. */
export function commitDecrypto(
  events: readonly DecryptoEvent[],
  effects: readonly DecryptoEffect[] = [],
): DecryptoDecision {
  return commit<DecryptoEvent, DecryptoEffect>({ events, effects });
}

export type DecryptoWordSelection = Readonly<Record<DecryptoTeam, DecryptoKeywords>>;
