/** Decrypto per-seat view model: the stage projection every client renders from. */

import { getBotDisplayName } from '../../../platform/room/getBotDisplayName';
import { buildSeatIdentityView } from '../../../platform/room/seatIdentity';
import {
  type DecryptoGame,
  type DecryptoPhaseKind,
  type DecryptoState,
  type DecryptoTeam,
  getDecryptoUserSeat,
  isDecryptoOccupiedSeat,
} from '../state/types';

export interface DecryptoSeatView {
  readonly seat: number;
  readonly displayName: string;
  readonly isBot: boolean;
}

export interface DecryptoViewModel {
  readonly phase: DecryptoPhaseKind;
  readonly mySeat: number | null;
  readonly seats: readonly DecryptoSeatView[];
  readonly myTeam: DecryptoTeam | null;
  readonly game: DecryptoGame | null;
}

/** Whether the automatic reveal has reached this team's result in the current round. */
export function isDecryptoResultRevealed(
  game: DecryptoGame,
  team: DecryptoTeam,
  stage: 'code' | 'decode' | 'intercept',
): boolean {
  const stagesPerTeam = game.round === 1 ? 2 : 3;
  const start = team === 'blue' ? 0 : stagesPerTeam;
  const index = game.revealSequence.findIndex(
    (kind, position) => position >= start && position < start + stagesPerTeam && kind === stage,
  );
  return index >= 0 && game.revealIndex >= index;
}

function projectGame(
  game: DecryptoGame,
  viewerSeat: number | null,
  viewerTeam: DecryptoTeam | null,
  isEnded: boolean,
  viewerIsHost: boolean,
): DecryptoGame {
  const revealAll = isEnded || (game.step === 'tiebreakJudge' && viewerIsHost);
  const keywords =
    game.keywords === null
      ? null
      : {
          blue:
            revealAll || viewerTeam === 'blue'
              ? game.keywords.blue
              : (['隐藏词A', '隐藏词B', '隐藏词C', '隐藏词D'] as const),
          purple:
            revealAll || viewerTeam === 'purple'
              ? game.keywords.purple
              : (['隐藏词E', '隐藏词F', '隐藏词G', '隐藏词H'] as const),
        };
  const clues =
    (game.clues.blue !== null && game.clues.purple !== null) || isEnded
      ? game.clues
      : {
          blue: viewerTeam === 'blue' ? game.clues.blue : null,
          purple: viewerTeam === 'purple' ? game.clues.purple : null,
        };
  const codes = {
    blue:
      revealAll ||
      isDecryptoResultRevealed(game, 'blue', 'code') ||
      (game.step === 'encrypt' && viewerSeat === game.encryptors?.blue)
        ? game.codes.blue
        : ([1, 1, 1] as const),
    purple:
      revealAll ||
      isDecryptoResultRevealed(game, 'purple', 'code') ||
      (game.step === 'encrypt' && viewerSeat === game.encryptors?.purple)
        ? game.codes.purple
        : ([1, 1, 1] as const),
  };
  const decoded = {
    blue:
      revealAll ||
      isDecryptoResultRevealed(game, 'blue', 'decode') ||
      (game.step === 'guess' && viewerTeam === 'blue')
        ? game.decoded.blue
        : null,
    purple:
      revealAll ||
      isDecryptoResultRevealed(game, 'purple', 'decode') ||
      (game.step === 'guess' && viewerTeam === 'purple')
        ? game.decoded.purple
        : null,
  };
  const intercepted = {
    blue:
      revealAll ||
      isDecryptoResultRevealed(game, 'purple', 'intercept') ||
      (game.step === 'guess' && viewerTeam === 'blue')
        ? game.intercepted.blue
        : null,
    purple:
      revealAll ||
      isDecryptoResultRevealed(game, 'blue', 'intercept') ||
      (game.step === 'guess' && viewerTeam === 'purple')
        ? game.intercepted.purple
        : null,
  };
  const tiebreakGuesses = {
    blue: revealAll || viewerTeam === 'blue' ? game.tiebreakGuesses.blue : null,
    purple: revealAll || viewerTeam === 'purple' ? game.tiebreakGuesses.purple : null,
  };
  return { ...game, keywords, clues, codes, decoded, intercepted, tiebreakGuesses };
}

/**
 * Builds the view model for one viewer.
 * @param viewerSeat Seat of the viewer; null for spectators without a seat.
 */
export function getDecryptoViewModel(
  state: DecryptoState,
  viewerSeat: number | null,
  viewerIsHost = false,
): DecryptoViewModel {
  const seats: DecryptoSeatView[] = [];
  for (let seat = 0; seat < state.config.numberOfPlayers; seat += 1) {
    if (!isDecryptoOccupiedSeat(state, seat)) continue;
    seats.push({ ...buildSeatIdentityView(state.roster, seat, getBotDisplayName) });
  }
  const myTeam =
    viewerSeat === null || (state.phase.kind !== 'playing' && state.phase.kind !== 'ended')
      ? null
      : (state.phase.game.assignments[viewerSeat] ?? null);
  const game =
    state.phase.kind === 'playing' || state.phase.kind === 'ended'
      ? projectGame(
          state.phase.game,
          viewerSeat,
          myTeam,
          state.phase.kind === 'ended',
          viewerIsHost,
        )
      : null;
  return {
    phase: state.phase.kind,
    mySeat: viewerSeat,
    seats,
    myTeam,
    game,
  };
}

/** Transport projection applied to every user snapshot, including the host. */
export function projectDecryptoStateForUser(state: DecryptoState, userId: string): DecryptoState {
  if (state.phase.kind !== 'playing' && state.phase.kind !== 'ended') return state;
  const viewerSeat = getDecryptoUserSeat(state, userId);
  const viewerTeam =
    viewerSeat === null ? null : (state.phase.game.assignments[viewerSeat] ?? null);
  const viewerIsHost = userId === state.hostUserId;
  return {
    ...state,
    phase: {
      kind: state.phase.kind,
      game: projectGame(
        state.phase.game,
        viewerSeat,
        viewerTeam,
        state.phase.kind === 'ended',
        viewerIsHost,
      ),
    },
  };
}
