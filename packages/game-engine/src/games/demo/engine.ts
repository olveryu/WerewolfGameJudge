/** Authoritative Demo engine; delegates persistence and delivery to the platform. */

import {
  buildGameCompletionPayload,
  type CommandContext,
  type CommonGameLifecycle,
  type CreateGameContext,
  type GameEngineDefinition,
  reject,
  resolveSystemActorEffectId,
} from '../../platform/engine';
import { resolveActingSeat } from '../../platform/room/actingSeat';
import { decideMarkBotsViewed, haveAllViewed } from '../../platform/room/identityViewing';
import { getHumanSeatMap } from '../../platform/room/seating';
import type { DemoCommand } from './commands/types';
import {
  commitDemo,
  DEMO_REASONS,
  type DemoDecision,
  type DemoEffect,
  type DemoEvent,
  requireDemoHost,
} from './domain/decision';
import { evolveDemoState } from './domain/evolve';
import { dealDemoIdentities, DEMO_STAGE_DURATION_MS } from './domain/rules';
import { decideDemoRoom } from './domain/seating';
import { normalizeDemoState } from './state/normalize';
import {
  DEMO_GAME_TYPE,
  type DemoConfig,
  type DemoState,
  getDemoOccupiedSeatCount,
  getDemoViewingParticipants,
  isValidDemoConfig,
} from './state/types';
import { DEMO_STATE_VERSION } from './state/version';

function createInitialState(config: DemoConfig, context: CreateGameContext): DemoState {
  if (!isValidDemoConfig(config)) throw new Error(DEMO_REASONS.config);
  return normalizeDemoState({
    gameType: DEMO_GAME_TYPE,
    stateVersion: DEMO_STATE_VERSION,
    roomCode: context.roomCode,
    hostUserId: context.hostUserId,
    phase: { kind: 'lobby' },
    phaseRevision: 0,
    config: { ...config },
    roster: {},
    identities: {},
    roleViewedSeats: [],
    gameSequence: 0,
    xpSettled: false,
  });
}

/** 对局结束时发结算 effect，Worker 据此发 XP 奖励；xpSettled 保证恰好一次。 */
function completionEffect(state: DemoState, context: CommandContext): DemoEffect {
  return {
    type: 'demo.game.completed',
    payload: buildGameCompletionPayload({
      roundId: `demo:game:${state.gameSequence}`,
      completedAt: context.nowMs,
      humans: Object.values(getHumanSeatMap(state.roster, state.config.numberOfPlayers)),
    }),
  };
}

/**
 * Host deals the game (or redeals from ended): assign identities and
 * enter the viewing stage. Dealing never starts play — the host
 * begins the game only once every seat has viewed its identity.
 */
function startGame(state: DemoState, context: CommandContext): DemoDecision {
  const hostRejection = requireDemoHost(state, context, DEMO_REASONS.notHostStart);
  if (hostRejection !== null) return hostRejection;
  if (state.phase.kind !== 'lobby' && state.phase.kind !== 'ended')
    return reject(DEMO_REASONS.phase);
  if (getDemoOccupiedSeatCount(state) !== state.config.numberOfPlayers)
    return reject(DEMO_REASONS.full);
  return commitDemo([
    {
      type: 'demo.game.started',
      identities: dealDemoIdentities(state),
      gameSequence: state.gameSequence + 1,
    },
  ]);
}

/**
 * The scheduled settle effect for the one armed stage deadline. The
 * payload pins the exact arming so the Worker handler can no-op a
 * delivery that arrives after the game already settled or a new game
 * began.
 */
function settleDueEffect(gameSequence: number, deadlineAt: number): DemoEffect {
  return { type: 'demo.settle.due', payload: { gameSequence, deadlineAt } };
}

/**
 * Host begins play from the viewing stage: the identity checkpoint
 * must be complete. The playing stage opens with its deadline armed;
 * the settle.due effect is the correctness path for expiry — no
 * client submission settles the stage.
 */
function beginGame(state: DemoState, context: CommandContext): DemoDecision {
  const hostRejection = requireDemoHost(state, context, DEMO_REASONS.notHostBegin);
  if (hostRejection !== null) return hostRejection;
  if (state.phase.kind !== 'viewing') return reject(DEMO_REASONS.phase);
  if (!haveAllViewed(getDemoViewingParticipants(state), state.roleViewedSeats))
    return reject(DEMO_REASONS.notAllViewed);
  const deadlineAt = context.nowMs + DEMO_STAGE_DURATION_MS;
  return commitDemo(
    [{ type: 'demo.game.begun', deadlineAt }],
    [settleDueEffect(state.gameSequence, deadlineAt)],
  );
}

/**
 * Identity Viewing Protocol: records that the actor's seat viewed its
 * identity. Idempotent, and accepted in any in-game phase; the record
 * only gates the host's begin command in the viewing stage.
 */
function markRoleViewed(state: DemoState, context: CommandContext): DemoDecision {
  if (state.phase.kind === 'lobby' || state.phase.kind === 'ended')
    return reject(DEMO_REASONS.phase);
  const resolved = resolveActingSeat(state, state.config.numberOfPlayers, context);
  if (resolved.kind === 'rejected') return reject(resolved.reason);
  if (state.roleViewedSeats.includes(resolved.value)) return commitDemo([]);
  return commitDemo([{ type: 'demo.role.viewed', seat: resolved.value }]);
}

/**
 * Identity Viewing Protocol scaffold action (host only): marks every
 * unviewed bot seat as viewed. Humans always mark themselves; the
 * engine never auto-marks at deal time.
 */
function markAllBotsViewed(state: DemoState, context: CommandContext): DemoDecision {
  return decideMarkBotsViewed({
    gateRejection:
      state.phase.kind === 'lobby' || state.phase.kind === 'ended'
        ? reject(DEMO_REASONS.phase)
        : requireDemoHost(state, context, DEMO_REASONS.notHostMarkBots),
    participants: getDemoViewingParticipants(state),
    viewedSeats: state.roleViewedSeats,
    noBotSeatsReason: DEMO_REASONS.noBotSeats,
    buildViewedEvent: (seat) => ({ type: 'demo.role.viewed', seat }),
    commit: commitDemo,
  });
}

function returnToLobby(state: DemoState, context: CommandContext): DemoDecision {
  const hostRejection = requireDemoHost(state, context, DEMO_REASONS.notHostReturnToLobby);
  if (hostRejection !== null) return hostRejection;
  if (state.phase.kind !== 'ended') return reject(DEMO_REASONS.phase);
  return commitDemo([{ type: 'demo.game.returnedToLobby' }]);
}

/**
 * 终局接缝。玩法状态机判定出胜负时从这里收口：
 * 一次性发 game.ended 事件 + 结算 effect（xpSettled 防重复）。
 * demo 没有玩法判定，触发点就是阶段截止：`demo.phase.settleExpired`
 * 过门后转调本函数（engine.test.ts 已钉住本接缝的结算形状，不许改形状）。
 */
export function endDemoGame(state: DemoState, context: CommandContext): DemoDecision {
  if (state.phase.kind !== 'playing') return reject(DEMO_REASONS.phase);
  return commitDemo(
    [{ type: 'demo.game.ended' }],
    state.xpSettled ? [] : [completionEffect(state, context)],
  );
}

/**
 * Settle channel for stage-deadline expiry: only the system actor
 * (the scheduled `demo.settle.due` effect handler) may settle, and
 * only once the armed deadline has been reached. Settlement itself
 * runs through the terminal seam above.
 */
function settleExpired(state: DemoState, context: CommandContext): DemoDecision {
  if (state.phase.kind !== 'playing') return reject(DEMO_REASONS.phase);
  const actor = resolveSystemActorEffectId(context);
  if (actor.kind === 'rejected') return reject(actor.reason);
  if (context.nowMs < state.phase.deadlineAt) return reject(DEMO_REASONS.deadline);
  return endDemoGame(state, context);
}

function decideCommand(
  state: DemoState,
  command: DemoCommand,
  context: CommandContext,
): DemoDecision {
  switch (command.type) {
    case 'room.seat.take':
    case 'room.seat.leave':
    case 'room.seat.kick':
    case 'room.seat.clear':
    case 'room.seat.fillBots':
    case 'room.profile.update':
    case 'demo.config.update':
      return decideDemoRoom(state, command, context);
    case 'demo.game.start':
      return startGame(state, context);
    case 'demo.game.begin':
      return beginGame(state, context);
    case 'demo.role.viewed':
      return markRoleViewed(state, context);
    case 'demo.bots.markAllBotsViewed':
      return markAllBotsViewed(state, context);
    case 'demo.phase.settleExpired':
      return settleExpired(state, context);
    case 'demo.game.returnToLobby':
      return returnToLobby(state, context);
    case 'demo.gameplay.example':
      // TODO(gameplay): 示例玩法命令——接上真实玩法后删除或替换。
      return reject(DEMO_REASONS.notImplemented);
    default:
      return reject(DEMO_REASONS.phase);
  }
}

/** Decides public and worker-internal commands against the authoritative state. */
export function decideDemoCommand(
  state: DemoState,
  command: DemoCommand,
  context: CommandContext,
): DemoDecision {
  return decideCommand(state, command, context);
}

/** Projects domain phases into the shared room lifecycle. */
export function getDemoLifecycle(state: DemoState): CommonGameLifecycle {
  return state.phase.kind === 'lobby'
    ? 'setup'
    : state.phase.kind === 'ended'
      ? 'ended'
      : 'ongoing';
}

export const demoEngine = {
  gameType: DEMO_GAME_TYPE,
  stateVersion: DEMO_STATE_VERSION,
  capabilities: {
    nightPhase: false,
    botsAndTakeover: true,
    identityViewing: true,
    revealAnimation: true,
    stageDeadline: true,
    audioOrchestration: false,
    wordLibrary: false,
    gallery: false,
    hostConfig: true,
    botTestScaffold: true,
  },
  createInitialState,
  decide: decideDemoCommand,
  evolve: evolveDemoState,
  normalize: normalizeDemoState,
  getLifecycle: getDemoLifecycle,
} satisfies GameEngineDefinition<
  typeof DEMO_GAME_TYPE,
  DemoState,
  DemoConfig,
  DemoCommand,
  DemoEvent,
  DemoEffect
>;
