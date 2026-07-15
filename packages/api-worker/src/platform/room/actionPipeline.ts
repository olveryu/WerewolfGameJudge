/** Generic authenticated command pipeline shared by every registered room game. */

import type { CommandContext, GameEffect } from '@werewolf/game-engine/platform/engine';
import {
  createRoomCommandResult,
  type RoomCommandResult,
} from '@werewolf/game-engine/platform/protocol/commandResult';
import type { GameType } from '@werewolf/game-engine/platform/protocol/gameTypes';
import {
  REASON_COMMAND_ID_CONFLICT,
  REASON_NO_STATE,
} from '@werewolf/game-engine/platform/protocol/reasons';
import type { BaseGameState } from '@werewolf/game-engine/platform/protocol/roomSnapshot';

import { derivePlatformRoomEffects, getPlatformRoomEffectBusinessKey } from './platformEffects';
import {
  getCommittedRevision,
  type NewOutboxEffect,
  type RoomRepository,
  serializeCommandRequest,
} from './roomRepository';
import type {
  RuntimeCommittedDecision,
  RuntimeWorkerGameModule,
  WorkerGameModuleResolver,
} from './runtimeGameModule';
import type { DispatchRoomCommand, DispatchRoomResult, StoredRoomRow } from './types';

export interface PipelineDispatchResult {
  readonly rpc: DispatchRoomResult;
  readonly broadcast: 'state' | 'none';
  readonly commandType: string | null;
}

function createRejectedResult(
  commandId: string,
  reason: string,
): RoomCommandResult<BaseGameState<GameType>> {
  return createRoomCommandResult({ kind: 'rejected', commandId, reason });
}

function createCommandContext(
  request: DispatchRoomCommand,
  nowMs: number,
  randomSeed: string,
): CommandContext {
  const execution = {
    nowMs,
    commandId: request.commandId,
    randomSeed,
  };
  if (request.actor.kind === 'system') {
    if (request.controlledSeat !== null) {
      throw new Error('System commands cannot specify controlledSeat');
    }
    return {
      ...execution,
      actor: request.actor,
      controlledSeat: null,
    };
  }
  return {
    ...execution,
    actor: request.actor,
    controlledSeat: request.controlledSeat,
  };
}

function buildOutboxEffects(
  room: StoredRoomRow,
  request: DispatchRoomCommand,
  decision: RuntimeCommittedDecision,
  module: RuntimeWorkerGameModule,
  nowMs: number,
): readonly NewOutboxEffect[] {
  const actorUserId = request.actor.kind === 'user' ? request.actor.userId : null;
  const createdRevision = getCommittedRevision(room, decision.hasStateEvents);
  const platformEffects = derivePlatformRoomEffects({
    roomCode: room.roomCode,
    actorUserId,
    commandType: decision.commandType,
    outcomeKind: decision.outcome.kind,
    previousLifecycle: decision.previousLifecycle,
    lifecycle: decision.lifecycle,
    committedRevision: createdRevision,
    nowMs,
  });
  const scopedEffects: readonly {
    readonly scope: 'platform' | 'game';
    readonly effect: GameEffect;
    readonly businessKey: string;
  }[] = [
    ...platformEffects.map((effect) => ({
      scope: 'platform' as const,
      effect,
      businessKey: getPlatformRoomEffectBusinessKey(effect),
    })),
    ...decision.effects.map((effect) => ({
      scope: 'game' as const,
      effect,
      businessKey: module.getEffectBusinessKey(effect, {
        originCommandId: request.commandId,
        createdRevision,
      }),
    })),
  ];
  return scopedEffects.map(({ scope, effect, businessKey }, index) => {
    const id = `${room.roomCode}:${request.commandId}:${index}`;
    return {
      id,
      businessKey,
      scope,
      gameType: room.gameType,
      effect,
    };
  });
}

function rejectedPipelineResult(commandId: string, reason: string): PipelineDispatchResult {
  return {
    rpc: {
      kind: 'decided',
      result: createRejectedResult(commandId, reason),
      isReplay: false,
    },
    broadcast: 'none',
    commandType: null,
  };
}

/** Execute one command and atomically persist its receipt, state, effects, and alarm. */
export async function dispatchRoomCommand(
  repository: RoomRepository,
  resolveGameModule: WorkerGameModuleResolver,
  request: DispatchRoomCommand,
  nowMs: number,
): Promise<PipelineDispatchResult> {
  const room = repository.readRoom();
  if (room === null) {
    return {
      rpc: { kind: 'unavailable', reason: REASON_NO_STATE },
      broadcast: 'none',
      commandType: null,
    };
  }
  if (request.roomCode !== room.roomCode) {
    throw new Error(
      `Room command code ${request.roomCode} does not match authoritative room ${room.roomCode}`,
    );
  }

  repository.deleteExpiredReceipts(nowMs);
  const module = resolveGameModule(room.gameType);
  const requestJson = serializeCommandRequest(request);
  const receipt = repository.readReceipt(request, requestJson, room, module);
  if (receipt === 'conflict') {
    return rejectedPipelineResult(request.commandId, REASON_COMMAND_ID_CONFLICT);
  }
  if (receipt !== null) {
    return {
      rpc: { kind: 'decided', result: receipt.result, isReplay: true },
      broadcast: 'none',
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
    const result = createRejectedResult(request.commandId, decision.reason);
    await repository.persist({
      previous: room,
      state: room.state,
      request,
      requestJson,
      randomSeed,
      result,
      hasStateEvents: false,
      effects: [],
      decidedAt: nowMs,
    });
    return {
      rpc: { kind: 'decided', result, isReplay: false },
      broadcast: 'none',
      commandType: null,
    };
  }

  const revision = getCommittedRevision(room, decision.hasStateEvents);
  const result = createRoomCommandResult({
    kind: 'committed',
    commandId: request.commandId,
    state: decision.state,
    revision,
    outcome: decision.outcome,
  });
  const effects = buildOutboxEffects(room, request, decision, module, nowMs);
  await repository.persist({
    previous: room,
    state: decision.state,
    request,
    requestJson,
    randomSeed,
    result,
    hasStateEvents: decision.hasStateEvents,
    effects,
    decidedAt: nowMs,
  });

  return {
    rpc: { kind: 'decided', result, isReplay: false },
    broadcast: decision.broadcast,
    commandType: decision.commandType,
  };
}
