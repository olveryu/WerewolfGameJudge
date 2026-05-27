/**
 * buildInitialGameState — constructs the initial GameState for a room
 *
 * Responsibility: constructs the initial game state ("unseated" phase) from roomCode + hostUserId + template.
 * Used when the host creates a room, ensuring the DB and in-memory store share the same initial state (DRY).
 * Pure function; no side effects, no dependencies on React Native / Expo / IO. *
 * ❗ All required array fields must be initialized to `[]`; `undefined` is not allowed. */

import { GameStatus, type GameTemplate } from '../../models';
import type { GameState } from '../../protocol/types';

export function buildInitialGameState(
  roomCode: string,
  hostUserId: string,
  template: GameTemplate,
): GameState {
  const players: GameState['players'] = {};
  for (let i = 0; i < template.numberOfPlayers; i++) {
    players[i] = null;
  }

  return {
    roomCode,
    hostUserId,
    status: GameStatus.Unseated,
    templateRoles: template.roles,
    players,
    roster: {},
    currentStepIndex: -1,
    isAudioPlaying: false,
    actions: [],
    pendingRevealAcks: [],
    hypnotizedSeats: [],
    piperRevealAcks: [],
    conversionRevealAcks: [],
    cupidLoversRevealAcks: [],
  };
}
