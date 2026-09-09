/** Stable typed handle; actual room resources exist only while this handle owns a room. */
import type { BaseGameState } from '@game-judge/game-engine/platform/protocol/roomSnapshot';

import type { RealtimeUserEvent } from '@/services/types/IRealtimeTransport';

import type { ActiveRoomSessionOwner } from './ActiveRoomSessionOwner';
import { createIdleSnapshot, type RoomSession } from './RoomSession';
import type {
  ActiveRoomIdentity,
  PreparedRoomCommand,
  RoomCommandDispatchOptions,
  RoomConnectOutcome,
  RoomSessionClient,
  RoomSessionSnapshot,
} from './types';

export class LazyRoomSession<
  TState extends BaseGameState<string>,
  TCommand extends object,
  TEvent extends RealtimeUserEvent,
> implements RoomSessionClient<TState, TCommand, TEvent> {
  readonly #listeners = new Set<() => void>();
  #snapshot: RoomSessionSnapshot<TState> = createIdleSnapshot(0);
  #session: RoomSession<TState, TCommand, TEvent> | null = null;
  #release: (() => void) | null = null;
  #unsubscribe: (() => void) | null = null;
  #userEventHandler: ((event: TEvent) => void | Promise<void>) | null = null;
  #unsubscribeUserEvents: (() => void) | null = null;

  constructor(
    private readonly owner: ActiveRoomSessionOwner,
    private readonly createSession: (epoch: number) => RoomSession<TState, TCommand, TEvent>,
  ) {}

  getSnapshot(): RoomSessionSnapshot<TState> {
    return this.#snapshot;
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /** Allocate one room after acquiring the application-wide exclusive lease. */
  async connect(
    identity: ActiveRoomIdentity<TState['gameType']>,
    signal?: AbortSignal,
  ): Promise<RoomConnectOutcome> {
    if (signal?.aborted) return { kind: 'cancelled' };
    const release = this.owner.acquire();
    try {
      this.#session = this.createSession(this.#snapshot.epoch);
    } catch (error) {
      release();
      throw error;
    }
    this.#release = release;
    const session = this.#session;
    this.#unsubscribe = session.subscribe(() => {
      this.#snapshot = session.getSnapshot();
      this.#publish();
    });
    if (this.#userEventHandler !== null) {
      this.#unsubscribeUserEvents = session.setUserEventHandler(this.#userEventHandler);
    }
    try {
      return await session.connect(identity, signal);
    } finally {
      if (this.#session === session && session.getSnapshot().phase === 'idle') {
        this.disconnect();
      }
    }
  }

  reconnect(signal?: AbortSignal): Promise<RoomConnectOutcome> {
    return this.#requireSession().reconnect(signal);
  }

  /** Release transport, listeners, and the lease before publishing the idle handle. */
  disconnect(): void {
    const session = this.#session;
    if (session === null) return;
    this.#unsubscribe?.();
    this.#unsubscribeUserEvents?.();
    this.#unsubscribe = null;
    this.#unsubscribeUserEvents = null;
    session.dispose();
    this.#snapshot = session.getSnapshot();
    this.#session = null;
    this.#release!();
    this.#release = null;
    this.#publish();
  }

  prepare<TPreparedCommand extends TCommand>(
    command: TPreparedCommand,
    controlledSeat: number | null,
  ): PreparedRoomCommand<TPreparedCommand> {
    return this.#requireSession().prepare(command, controlledSeat);
  }

  dispatch(command: TCommand, options: RoomCommandDispatchOptions) {
    return this.#requireSession().dispatch(command, options);
  }

  dispatchPrepared<TPreparedCommand extends TCommand>(
    prepared: PreparedRoomCommand<TPreparedCommand>,
    label: string,
  ) {
    return this.#requireSession().dispatchPrepared(prepared, label);
  }

  acknowledgeRecoveredCommandRejection(commandId: string): void {
    this.#requireSession().acknowledgeRecoveredCommandRejection(commandId);
  }

  setUserEventHandler(handler: (event: TEvent) => void | Promise<void>): () => void {
    if (this.#userEventHandler !== null) {
      throw new Error('[FAIL-FAST] Room user event handler already registered');
    }
    this.#userEventHandler = handler;
    if (this.#session !== null) {
      this.#unsubscribeUserEvents = this.#session.setUserEventHandler(handler);
    }
    return () => {
      if (this.#userEventHandler !== handler) return;
      this.#unsubscribeUserEvents?.();
      this.#unsubscribeUserEvents = null;
      this.#userEventHandler = null;
    };
  }

  #requireSession(): RoomSession<TState, TCommand, TEvent> {
    if (this.#session === null) throw new Error('[FAIL-FAST] No active room session');
    return this.#session;
  }

  #publish(): void {
    this.#listeners.forEach((listener) => listener());
  }
}
