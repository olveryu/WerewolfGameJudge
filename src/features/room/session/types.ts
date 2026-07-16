/** Immutable contracts owned by one active room session. */

import type { RoomCommandResult } from '@game-judge/game-engine/platform/protocol/commandResult';
import type { GameType } from '@game-judge/game-engine/platform/protocol/gameTypes';
import type {
  BaseGameState,
  RoomSnapshot,
} from '@game-judge/game-engine/platform/protocol/roomSnapshot';

import type { RoomConnectionStatus } from '@/features/room/model/RoomConnection';
import type { RoomRecord } from '@/features/room/model/RoomDirectory';

export interface ActiveRoomIdentity<TGameType extends string = GameType> {
  readonly room: RoomRecord<TGameType>;
  readonly userId: string;
}

export interface RoomUserEvent {
  readonly eventId: string;
}

interface RoomSessionSnapshotBase {
  readonly epoch: number;
  readonly connection: RoomConnectionStatus;
}

export type RoomSessionSnapshot<TState extends BaseGameState<string>> =
  | (RoomSessionSnapshotBase & {
      readonly phase: 'idle';
      readonly identity: null;
      readonly snapshot: null;
      readonly lastCommand: null;
      readonly error: null;
    })
  | (RoomSessionSnapshotBase & {
      readonly phase: 'entering';
      readonly identity: ActiveRoomIdentity<TState['gameType']>;
      readonly snapshot: null;
      readonly lastCommand: null;
      readonly error: null;
    })
  | (RoomSessionSnapshotBase & {
      readonly phase: 'ready';
      readonly identity: ActiveRoomIdentity<TState['gameType']>;
      readonly snapshot: RoomSnapshot<TState>;
      readonly lastCommand: {
        readonly revision: number;
        readonly type: string;
      } | null;
      readonly error: null;
    })
  | (RoomSessionSnapshotBase & {
      readonly phase: 'failed';
      readonly identity: ActiveRoomIdentity<TState['gameType']>;
      readonly snapshot: null;
      readonly lastCommand: null;
      readonly error: Error;
    });

export type RoomConnectOutcome =
  | { readonly kind: 'connected' }
  | { readonly kind: 'cancelled' | 'superseded' };

export interface RoomCommandDispatchOptions {
  readonly controlledSeat: number | null;
  readonly label: string;
}

export interface PreparedRoomCommand<TCommand extends object> {
  readonly sessionEpoch: number;
  readonly roomCode: string;
  readonly roomId: string;
  readonly commandId: string;
  readonly command: Readonly<TCommand>;
  readonly controlledSeat: number | null;
}

/** Lossless client delivery envelope around the authoritative Worker decision. */
export type RoomCommandDispatchOutcome<TState extends BaseGameState<string>> =
  | {
      readonly kind: 'decided';
      readonly decision: RoomCommandResult<TState>;
    }
  | {
      readonly kind: 'notDecided' | 'deliveryUnknown';
      readonly commandId: string;
      readonly reason: string;
    };

export interface RoomCommandContext<TState extends BaseGameState<string>, TCommand extends object> {
  dispatch(
    command: TCommand,
    options: RoomCommandDispatchOptions,
  ): Promise<RoomCommandDispatchOutcome<TState>>;
}

export interface RoomSessionClient<
  TState extends BaseGameState<string>,
  TCommand extends object,
  TEvent extends RoomUserEvent,
> extends RoomCommandContext<TState, TCommand> {
  getSnapshot(): RoomSessionSnapshot<TState>;
  subscribe(listener: () => void): () => void;
  connect(
    identity: ActiveRoomIdentity<TState['gameType']>,
    signal?: AbortSignal,
  ): Promise<RoomConnectOutcome>;
  reconnect(signal?: AbortSignal): Promise<RoomConnectOutcome>;
  disconnect(): void;
  prepare<TPreparedCommand extends TCommand>(
    command: TPreparedCommand,
    controlledSeat: number | null,
  ): PreparedRoomCommand<TPreparedCommand>;
  dispatchPrepared<TPreparedCommand extends TCommand>(
    prepared: PreparedRoomCommand<TPreparedCommand>,
    label: string,
  ): Promise<RoomCommandDispatchOutcome<TState>>;
  setUserEventHandler(handler: (event: TEvent) => void | Promise<void>): () => void;
}
