/** Shared state identity and snapshot envelopes for room runtimes. */

import type { GameType } from './gameTypes';

export interface BaseGameState<TGameType extends GameType> {
  readonly gameType: TGameType;
  readonly stateVersion: number;
  readonly roomCode: string;
  readonly hostUserId: string;
}

export interface RoomSnapshot<TState extends BaseGameState<GameType>> {
  readonly gameType: TState['gameType'];
  readonly stateVersion: number;
  readonly revision: number;
  readonly state: TState;
}

export interface StateUpdateMessage<
  TState extends BaseGameState<GameType>,
> extends RoomSnapshot<TState> {
  readonly type: 'STATE_UPDATE';
  readonly lastCommandType: string | null;
}

function assertPositiveVersion(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive safe integer`);
  }
}

export function createRoomSnapshot<TState extends BaseGameState<GameType>>(
  state: TState,
  revision: number,
): RoomSnapshot<TState> {
  assertPositiveVersion(state.stateVersion, 'stateVersion');
  assertPositiveVersion(revision, 'revision');
  return {
    gameType: state.gameType,
    stateVersion: state.stateVersion,
    revision,
    state,
  };
}

export function createStateUpdateMessage<TState extends BaseGameState<GameType>>(
  snapshot: RoomSnapshot<TState>,
  lastCommandType: string | null,
): StateUpdateMessage<TState> {
  if (
    snapshot.gameType !== snapshot.state.gameType ||
    snapshot.stateVersion !== snapshot.state.stateVersion
  ) {
    throw new Error('Snapshot identity does not match its state');
  }
  return {
    type: 'STATE_UPDATE',
    ...snapshot,
    lastCommandType,
  };
}
