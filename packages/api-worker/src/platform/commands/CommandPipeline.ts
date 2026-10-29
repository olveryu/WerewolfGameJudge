/**
 * Game-agnostic room command pipeline: receipt lookup → engine decision → one atomic commit.
 *
 * The commit writes state, receipt, outbox effects and arms the outbox alarm in a single Durable
 * Object transaction. Broadcasting is reported to the caller, never performed here.
 */

import type { CommandContext, GameEffect } from '@game-judge/game-engine/platform/engine';
import {
  createRoomCommandResult,
  type RoomCommandResult,
} from '@game-judge/game-engine/platform/protocol/commandResult';
import type { GameType } from '@game-judge/game-engine/platform/protocol/gameTypes';
import {
  REASON_COMMAND_ID_CONFLICT,
  REASON_NO_STATE,
} from '@game-judge/game-engine/platform/protocol/reasons';
import type { BaseGameState } from '@game-judge/game-engine/platform/protocol/roomSnapshot';

import type {
  RuntimeCommittedDecision,
  RuntimeWorkerGameModule,
  WorkerEffectBusinessContext,
  WorkerGameModuleResolver,
} from '../gameModules/runtimeGameModule';
import {
  derivePlatformRoomEffects,
  getPlatformRoomEffectBusinessKey,
} from '../room/platformEffects';
import type { DispatchRoomCommand, StoredRoomRow } from '../room/types';
import { CommandReceipts, serializeCommandRequest } from './CommandReceipts';
import { type EffectOutbox, type NewOutboxEffect } from './EffectOutbox';
import { requestWakeNoLaterThan } from './roomAlarm';
import type { RoomStateStore } from './RoomStateStore';

type RoomState = BaseGameState<GameType>;

/** Outcome of one pipeline run, including what the room authority must do afterwards. */
export type CommandDispatch =
  | { readonly kind: 'unavailable'; readonly reason: typeof REASON_NO_STATE }
  | {
      readonly kind: 'decided';
      readonly result: RoomCommandResult<RoomState>;
      readonly isReplay: boolean;
      /** True when the authority must broadcast `result.snapshot` to the room. */
      readonly shouldBroadcast: boolean;
      readonly commandType: string | null;
    };

interface CommandPipelineDeps {
  readonly storage: DurableObjectStorage;
  readonly roomState: RoomStateStore;
  readonly outbox: EffectOutbox;
  readonly resolveGameModule: WorkerGameModuleResolver;
}

function createCommandContext(
  request: DispatchRoomCommand,
  nowMs: number,
  randomSeed: string,
): CommandContext {
  if (request.actor.kind === 'system') {
    if (request.controlledSeat !== null) {
      throw new Error('System commands cannot specify controlledSeat');
    }
    return {
      nowMs,
      commandId: request.commandId,
      randomSeed,
      actor: request.actor,
      controlledSeat: null,
    };
  }
  return {
    nowMs,
    commandId: request.commandId,
    randomSeed,
    actor: request.actor,
    controlledSeat: request.controlledSeat,
  };
}

function committedRevision(previous: StoredRoomRow, hasStateEvents: boolean): number {
  return hasStateEvents ? previous.revision + 1 : previous.revision;
}

function buildOutboxEffects(
  room: StoredRoomRow,
  request: DispatchRoomCommand,
  decision: RuntimeCommittedDecision,
  module: RuntimeWorkerGameModule,
  nowMs: number,
): readonly NewOutboxEffect[] {
  const createdRevision = committedRevision(room, decision.hasStateEvents);
  const platformEffects = derivePlatformRoomEffects({
    roomCode: room.roomCode,
    actorUserId: request.actor.kind === 'user' ? request.actor.userId : null,
    commandType: decision.commandType,
    outcomeKind: decision.outcome.kind,
    previousLifecycle: decision.previousLifecycle,
    lifecycle: decision.lifecycle,
    committedRevision: createdRevision,
    nowMs,
  });
  const effectContext: WorkerEffectBusinessContext = {
    originCommandId: request.commandId,
    createdRevision,
  };
  const scoped: readonly {
    readonly scope: 'platform' | 'game';
    readonly effect: GameEffect;
    readonly businessKey: string;
    readonly availableAt: number | null;
  }[] = [
    ...platformEffects.map((effect) => ({
      scope: 'platform' as const,
      effect,
      businessKey: getPlatformRoomEffectBusinessKey(effect),
      availableAt: null,
    })),
    ...decision.effects.map((effect) => ({
      scope: 'game' as const,
      effect,
      businessKey: module.getEffectBusinessKey(effect, effectContext),
      availableAt: module.getEffectDeliveryAt?.(effect, effectContext) ?? null,
    })),
  ];
  return scoped.map(({ scope, effect, businessKey, availableAt }, index) => {
    if (availableAt !== null && (!Number.isSafeInteger(availableAt) || availableAt < 0)) {
      throw new Error(
        `Game module ${room.gameType} produced an invalid effect delivery time: ${availableAt}`,
      );
    }
    return {
      id: `${room.roomCode}:${request.commandId}:${index}`,
      businessKey,
      scope,
      gameType: room.gameType,
      effect,
      availableAt,
    };
  });
}

export class CommandPipeline {
  readonly #deps: CommandPipelineDeps;
  readonly #receipts: CommandReceipts;

  constructor(deps: CommandPipelineDeps) {
    this.#deps = deps;
    this.#receipts = new CommandReceipts(deps.storage.sql);
  }

  async dispatch(request: DispatchRoomCommand, nowMs: number): Promise<CommandDispatch> {
    const room = this.#deps.roomState.read();
    if (room === null) return { kind: 'unavailable', reason: REASON_NO_STATE };
    if (request.roomCode !== room.roomCode) {
      throw new Error(
        `Room command code ${request.roomCode} does not match authoritative room ${room.roomCode}`,
      );
    }

    this.#receipts.deleteExpired(nowMs);
    const module = this.#deps.resolveGameModule(room.gameType);
    const requestJson = serializeCommandRequest(request);
    const receipt = this.#receipts.read(request, requestJson, room, module);
    if (receipt === 'conflict') {
      return {
        kind: 'decided',
        result: createRoomCommandResult<RoomState>({
          kind: 'rejected',
          commandId: request.commandId,
          reason: REASON_COMMAND_ID_CONFLICT,
        }),
        isReplay: false,
        shouldBroadcast: false,
        commandType: null,
      };
    }
    if (receipt !== null) {
      return {
        kind: 'decided',
        result: receipt.result,
        isReplay: true,
        shouldBroadcast: false,
        commandType: null,
      };
    }

    const randomSeed = crypto.randomUUID();
    const context = createCommandContext(request, nowMs, randomSeed);
    const decision =
      request.actor.kind === 'user'
        ? module.decidePublic(room.state, request.command, context)
        : module.decideInternal(room.state, request.command, context);

    if (decision.kind === 'reject') {
      const result = createRoomCommandResult<RoomState>({
        kind: 'rejected',
        commandId: request.commandId,
        reason: decision.reason,
      });
      await this.#deps.storage.transaction(async () => {
        this.#receipts.insert({
          request,
          requestJson,
          room,
          randomSeed,
          result,
          revision: room.revision,
          decidedAt: nowMs,
        });
      });
      return {
        kind: 'decided',
        result,
        isReplay: false,
        shouldBroadcast: false,
        commandType: null,
      };
    }

    const revision = committedRevision(room, decision.hasStateEvents);
    const nextStateJson = JSON.stringify(decision.state);
    if (!decision.hasStateEvents && nextStateJson !== room.stateJson) {
      throw new Error('A command changed state without committing a state event');
    }
    const result = createRoomCommandResult<RoomState>({
      kind: 'committed',
      commandId: request.commandId,
      state: decision.state,
      revision,
      outcome: decision.outcome,
    });
    const effects = buildOutboxEffects(room, request, decision, module, nowMs);

    await this.#deps.storage.transaction(async () => {
      if (decision.hasStateEvents) {
        this.#deps.roomState.commitState(room.revision, nextStateJson, revision, nowMs);
      }
      this.#receipts.insert({
        request,
        requestJson,
        room,
        randomSeed,
        result,
        revision,
        decidedAt: nowMs,
      });
      this.#deps.outbox.insertMany(request.commandId, effects, revision, nowMs);
      this.#receipts.deleteExpired(nowMs);
      await this.#armOutboxAlarm(effects, nowMs);
    });

    return {
      kind: 'decided',
      result,
      isReplay: false,
      shouldBroadcast: decision.broadcast === 'state',
      commandType: decision.commandType,
    };
  }

  /** Never push an already-armed earlier alarm later: parked effects keep their wake time. */
  async #armOutboxAlarm(effects: readonly NewOutboxEffect[], nowMs: number): Promise<void> {
    if (effects.length === 0) return;
    let earliest = Number.POSITIVE_INFINITY;
    for (const effect of effects) earliest = Math.min(earliest, effect.availableAt ?? nowMs);
    await requestWakeNoLaterThan(this.#deps.storage, earliest);
  }
}
