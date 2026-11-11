/**
 * commandTransport — one COMMAND frame over the live socket and its COMMAND_RESULT.
 *
 * No retry here: delivery policy belongs to `CommandOutbox`. The result's command ID must
 * equal the request's; a mismatch is a protocol violation and rejects the send.
 */
import { RoomCommandProtocolError } from '@game-judge/game-engine/platform/protocol/commandResult';
import type { BaseGameState } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import {
  type CommandResultFrame,
  createCommandFrame,
} from '@game-judge/game-engine/platform/realtime/protocol';

import { API_TIMEOUT_MS } from '@/config/api';
import type { SocketChannel } from '@/platform/realtime/SocketChannel';
import type { DispatchOutcome, PreparedCommand, TimerHandle } from '@/platform/realtime/types';
import { realtimeLog } from '@/utils/logger';

export interface CommandTransport<TState extends BaseGameState<string>> {
  send(prepared: PreparedCommand<object>, signal: AbortSignal): Promise<DispatchOutcome<TState>>;
  /** The live socket generation; null while the link is not live. */
  setLiveGeneration(generation: number | null): void;
  /** Route one COMMAND_RESULT frame to its waiting send. Unknown IDs are ignored. */
  deliver(frame: CommandResultFrame<TState>): void;
}

interface WebSocketCommandTransportTimers {
  readonly setTimeout: (callback: () => void, delayMs: number) => TimerHandle;
  readonly clearTimeout: (handle: TimerHandle) => void;
}

interface PendingSend<TState extends BaseGameState<string>> {
  readonly generation: number;
  readonly signal: AbortSignal;
  readonly onAbort: () => void;
  readonly timer: TimerHandle;
  readonly resolve: (outcome: DispatchOutcome<TState>) => void;
  readonly reject: (error: Error) => void;
}

class WebSocketCommandTransport<
  TState extends BaseGameState<string>,
> implements CommandTransport<TState> {
  readonly #channel: SocketChannel<TState>;
  readonly #timers: WebSocketCommandTransportTimers;
  readonly #pending = new Map<string, PendingSend<TState>>();
  #liveGeneration: number | null = null;

  constructor(channel: SocketChannel<TState>, timers: WebSocketCommandTransportTimers) {
    this.#channel = channel;
    this.#timers = timers;
  }

  async send(
    prepared: PreparedCommand<object>,
    signal: AbortSignal,
  ): Promise<DispatchOutcome<TState>> {
    const generation = this.#liveGeneration;
    if (generation === null) {
      return { kind: 'undelivered', commandId: prepared.commandId, cause: 'network' };
    }
    if (signal.aborted) {
      return { kind: 'cancelled', commandId: prepared.commandId };
    }
    if (this.#pending.has(prepared.commandId)) {
      throw new Error(`[FAIL-FAST] duplicate in-flight command ${prepared.commandId}`);
    }
    const frame = createCommandFrame(
      prepared.commandId,
      prepared.roomCode,
      prepared.command,
      prepared.controlledSeat,
    );
    if (!this.#channel.send(generation, frame)) {
      return { kind: 'undelivered', commandId: prepared.commandId, cause: 'network' };
    }
    return new Promise<DispatchOutcome<TState>>((resolve, reject) => {
      const timer = this.#timers.setTimeout(() => {
        this.#settle(prepared.commandId, {
          kind: 'undelivered',
          commandId: prepared.commandId,
          cause: 'timeout',
        });
      }, API_TIMEOUT_MS);
      const onAbort = (): void => {
        this.#settle(prepared.commandId, { kind: 'cancelled', commandId: prepared.commandId });
      };
      signal.addEventListener('abort', onAbort, { once: true });
      this.#pending.set(prepared.commandId, {
        generation,
        signal,
        onAbort,
        timer,
        resolve,
        reject,
      });
    });
  }

  setLiveGeneration(generation: number | null): void {
    if (generation === this.#liveGeneration) return;
    this.#liveGeneration = generation;
    for (const commandId of [...this.#pending.keys()]) {
      this.#settle(commandId, {
        kind: 'undelivered',
        commandId,
        cause: 'network',
      });
    }
  }

  deliver(frame: CommandResultFrame<TState>): void {
    const pending = this.#pending.get(frame.commandId);
    if (pending === undefined) {
      realtimeLog.warn('ignoring COMMAND_RESULT for an unknown command', {
        commandId: frame.commandId,
      });
      return;
    }
    switch (frame.outcome) {
      case 'decided': {
        if (frame.result.commandId !== frame.commandId) {
          this.#reject(
            frame.commandId,
            new RoomCommandProtocolError(
              `RoomCommandResult commandId mismatch: expected ${frame.commandId}, received ${frame.result.commandId}`,
            ),
          );
          return;
        }
        const result = frame.result;
        if (result.kind === 'rejected') {
          this.#settle(frame.commandId, {
            kind: 'rejected',
            commandId: result.commandId,
            reason: result.reason,
          });
          return;
        }
        this.#settle(frame.commandId, {
          kind: 'committed',
          commandId: result.commandId,
          snapshot: result.snapshot,
          outcome: result.outcome,
        });
        return;
      }
      case 'unavailable':
        this.#settle(frame.commandId, { kind: 'unavailable', commandId: frame.commandId });
        return;
      case 'throttled':
        this.#settle(frame.commandId, {
          kind: 'undelivered',
          commandId: frame.commandId,
          cause: 'throttled',
        });
        return;
    }
  }

  #settle(commandId: string, outcome: DispatchOutcome<TState>): void {
    const pending = this.#pending.get(commandId);
    if (pending === undefined) return;
    this.#pending.delete(commandId);
    this.#timers.clearTimeout(pending.timer);
    pending.signal.removeEventListener('abort', pending.onAbort);
    pending.resolve(outcome);
  }

  #reject(commandId: string, error: Error): void {
    const pending = this.#pending.get(commandId);
    if (pending === undefined) return;
    this.#pending.delete(commandId);
    this.#timers.clearTimeout(pending.timer);
    pending.signal.removeEventListener('abort', pending.onAbort);
    pending.reject(error);
  }
}

export function createWebSocketCommandTransport<TState extends BaseGameState<string>>(
  channel: SocketChannel<TState>,
  timers: WebSocketCommandTransportTimers,
): CommandTransport<TState> {
  return new WebSocketCommandTransport(channel, timers);
}
