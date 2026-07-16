/**
 * Game Factory for Integration Tests
 *
 * Fully based on the architecture:
 * - intents -> handlers -> reducer -> GameState
 * - No import of retired GameStateService / NightFlowController
 * - No encoded target protocol
 *
 * Single source of truth: GameState
 */

import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';
import type { SchemaId } from '@game-judge/game-engine/games/werewolf/public';
import type { NightPlan } from '@game-judge/game-engine/games/werewolf/public';
import type { GameState, PlayerMessage } from '@game-judge/game-engine/games/werewolf/public';
import { WEREWOLF_STATE_IDENTITY } from '@game-judge/game-engine/games/werewolf/public';
import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';
import { buildNightPlan } from '@game-judge/game-engine/games/werewolf/public';
import { WOLF_KILL_OVERRIDE_TEXTS } from '@game-judge/game-engine/games/werewolf/public';
import {
  createTemplateFromRoles,
  type GameTemplate,
  getBottomCardCount,
  getPlayerCount,
  PRESET_TEMPLATES,
} from '@game-judge/game-engine/games/werewolf/public';
import type {
  HandlerContext,
  HandlerExecutionContext,
  HandlerResult,
} from '@game-judge/game-engine/games/werewolf/testing';
import type { SubmitActionIntent } from '@game-judge/game-engine/games/werewolf/testing';
import type { StateAction } from '@game-judge/game-engine/games/werewolf/testing';
import { handleSubmitAction as executeSubmitAction } from '@game-judge/game-engine/games/werewolf/testing';
import {
  handleAdvanceNight as executeAdvanceNight,
  handleEndNight as executeEndNight,
} from '@game-judge/game-engine/games/werewolf/testing';
import { handlerSuccess } from '@game-judge/game-engine/games/werewolf/testing';
import { handleSetWolfRobotHunterStatusViewed } from '@game-judge/game-engine/games/werewolf/testing';
import { gameReducer } from '@game-judge/game-engine/games/werewolf/testing';
import { normalizeState } from '@game-judge/game-engine/games/werewolf/testing';
import type { ActionResult } from '@game-judge/game-engine/platform/protocol/actionResult';

import type { CapturedMessage, GameContext } from './gameContext';

// =============================================================================
// Internal State Management
// =============================================================================

interface InternalState {
  state: GameState;
  revision: number;
  nightPlan: NightPlan;
  template: GameTemplate;
  /** Captured messages (for wire protocol contract tests) */
  capturedMessages: CapturedMessage[];
}

function applyActions(current: GameState, actions: StateAction[]): GameState {
  return actions.reduce((s, action) => gameReducer(s, action), current);
}

function createContext(state: GameState): HandlerContext {
  return {
    state,
    myUserId: 'host-uid',
    mySeat: null,
  };
}

const TEST_EXECUTION: HandlerExecutionContext = Object.freeze({
  nowMs: 1_000_000,
  commandId: 'board-test-command',
  randomSeed: 'board-test-seed',
});

// =============================================================================
// Factory Function
// =============================================================================

interface CreateGameOptions {
  /** Treasure Master deck cards (3 cards), required only for 15-role templates */
  bottomCards?: readonly RoleId[];
  /** Server-generated random seed used by deterministic engine decisions. */
  randomSeed?: string;
}

export function createGame(
  templateNameOrRoles: string | RoleId[],
  roleAssignment?: Map<number, RoleId>,
  options?: CreateGameOptions,
): GameContext {
  const execution: HandlerExecutionContext = {
    ...TEST_EXECUTION,
    randomSeed: options?.randomSeed ?? TEST_EXECUTION.randomSeed,
  };
  let template: GameTemplate;
  if (typeof templateNameOrRoles === 'string') {
    const preset = PRESET_TEMPLATES.find((t) => t.name === templateNameOrRoles);
    if (!preset) throw new Error(`Unknown template: ${templateNameOrRoles}`);
    template = createTemplateFromRoles(preset.roles);
  } else {
    template = createTemplateFromRoles(templateNameOrRoles);
  }

  const initialPlayers: Record<number, GameState['players'][number]> = {};
  const roster: Record<string, { displayName: string }> = {};
  for (let i = 0; i < template.numberOfPlayers; i++) {
    initialPlayers[i] = {
      userId: `player_${i}`,
      seat: i,
      role: null,
      hasViewedRole: false,
    };
    roster[`player_${i}`] = { displayName: `Player ${i + 1}` };
  }

  let state: GameState = {
    ...WEREWOLF_STATE_IDENTITY,
    roomCode: 'TEST01',
    hostUserId: 'host-uid',
    status: GameStatus.Seated,
    templateRoles: template.roles,
    players: initialPlayers,
    currentStepIndex: 0,
    isAudioPlaying: false,
    actions: [],
    pendingRevealAcks: [],
    hypnotizedSeats: [],
    piperRevealAcks: [],
    conversionRevealAcks: [],
    cupidLoversRevealAcks: [],
    roster,
  };

  const assignments: Record<number, RoleId> = {};
  if (roleAssignment) {
    roleAssignment.forEach((role, seat) => {
      assignments[seat] = role;
    });
  } else {
    // Auto-assign: first N roles to seats, rest become bottom cards
    const playerCount = getPlayerCount(template.roles);
    template.roles.forEach((role, idx) => {
      if (idx < playerCount) {
        assignments[idx] = role;
      }
    });
  }

  // Bottom card roles (treasureMaster / thief): derive bottomCards and seat
  const hasBottomCardRole =
    template.roles.includes('treasureMaster') || template.roles.includes('thief');
  let bottomCards: readonly RoleId[] | undefined;
  let treasureMasterSeat: number | undefined;
  let thiefSeat: number | undefined;

  if (hasBottomCardRole) {
    if (options?.bottomCards) {
      bottomCards = options.bottomCards;
    } else {
      // Auto-derive: last N roles in templateRoles that are not assigned
      const assignedRoles = new Set(Object.values(assignments));
      const remaining = template.roles.filter((r) => !assignedRoles.has(r));
      const cardCount = getBottomCardCount(template.roles);
      bottomCards = remaining.slice(0, cardCount);
    }

    // Find bottom card role seats
    for (const [seatStr, role] of Object.entries(assignments)) {
      if (role === 'treasureMaster') {
        treasureMasterSeat = Number.parseInt(seatStr, 10);
      } else if (role === 'thief') {
        thiefSeat = Number.parseInt(seatStr, 10);
      }
    }
  }

  // Cupid seat
  let cupidSeat: number | undefined;
  for (const [seatStr, role] of Object.entries(assignments)) {
    if (role === 'cupid') {
      cupidSeat = Number.parseInt(seatStr, 10);
      break;
    }
  }

  state = gameReducer(state, {
    type: 'ASSIGN_ROLES',
    payload: { assignments, bottomCards, treasureMasterSeat, thiefSeat, cupidSeat },
  });

  for (let i = 0; i < template.numberOfPlayers; i++) {
    state = gameReducer(state, {
      type: 'PLAYER_VIEWED_ROLE',
      payload: { seat: i },
    });
  }

  const nightPlan = buildNightPlan(template.roles, state.seerLabelMap);
  const firstStepId = nightPlan.steps[0]?.stepId;
  if (!firstStepId) {
    throw new Error('Night plan has no steps');
  }

  state = gameReducer(state, {
    type: 'START_NIGHT',
    payload: {
      currentStepIndex: 0,
      currentStepId: firstStepId,
    },
  });

  // Poisoner present: night-1 wolfKillOverride (consistent with handleStartNight behavior)
  if (template.roles.includes('poisoner')) {
    state = gameReducer(state, {
      type: 'SET_WOLF_KILL_OVERRIDE',
      payload: {
        override: {
          source: 'poisoner',
          ui: WOLF_KILL_OVERRIDE_TEXTS.poisoner,
        },
      },
    });
  }

  const revision = 1;
  const internal: InternalState = {
    state,
    revision,
    nightPlan,
    template,
    capturedMessages: [],
  };

  const getGameState = (): GameState => internal.state;
  const getRevision = (): number => internal.revision;
  const getNightPlan = (): NightPlan => internal.nightPlan;
  const getCapturedMessages = (): readonly CapturedMessage[] => internal.capturedMessages;
  const clearCapturedMessages = (): void => {
    internal.capturedMessages = [];
  };

  const findSeatByRole = (role: RoleId): number => {
    for (const [seatStr, player] of Object.entries(internal.state.players)) {
      if (player?.role === role) {
        return Number.parseInt(seatStr, 10);
      }
    }
    return -1;
  };

  const getRoleAtSeat = (seat: number): RoleId | null => {
    return internal.state.players[seat]?.role ?? null;
  };

  const assertStep = (expectedStepId: SchemaId): void => {
    const current = internal.state.currentStepId;
    if (current !== expectedStepId) {
      throw new Error(`Step mismatch: expected ${expectedStepId}, got ${current}`);
    }
  };

  const executeHandler = (result: HandlerResult): ActionResult => {
    if (result.kind === 'error') {
      return { success: false, reason: result.reason };
    }
    // 'success' | 'rejection': apply actions (mirror production gameStateManager)
    // (e.g. ACTION_REJECTED must be applied so gameState.actionRejected is set)
    internal.state = normalizeState(applyActions(internal.state, result.actions));
    internal.revision++;
    if (result.kind === 'rejection') {
      return { success: false, reason: result.reason };
    }
    return { success: true };
  };

  const advanceNight = (): ActionResult => {
    const context = createContext(internal.state);
    const result = executeAdvanceNight({ type: 'ADVANCE_NIGHT' }, context, execution);
    return executeHandler(result);
  };

  /**
   * Advance to the next night step (fail-fast version)
   *
   * Logic identical to stepByStepRunner.advanceNightOrThrow:
   * - Call advanceNight()
   * - Throw if success: false
   *
   * Two implementations stay behaviorally consistent to avoid circular dependency.
   * Logic is minimal (call + throw) — no drift risk.
   *
   * @param context - Context info (used for error messages)
   * @throws if advanceNight returns success: false
   */
  const advanceNightOrThrow = (context: string): void => {
    const result = advanceNight();
    if (!result.success) {
      const currentStepId = internal.state.currentStepId;
      throw new Error(
        `[advanceNightOrThrow] failed at ${context}: ` +
          `currentStepId=${currentStepId ?? 'null'}, ` +
          `reason=${result.reason ?? 'unknown'}`,
      );
    }
  };

  /**
   * End the night, trigger death settlement
   *
   * FAIL-FAST: Only allowed once the night plan is complete (currentStepId is null).
   * Mid-flight calls throw because they violate NightFlow invariants.
   *
   * Reuses production handleEndNight handler — does not fabricate deaths.
   * Goes through unified executeHandler pipeline (applyActions + normalizeState).
   */
  const endNight = (): { success: boolean; deaths: number[] } => {
    const context = createContext(internal.state);
    const result = executeEndNight({ type: 'END_NIGHT' }, context, execution);
    if (result.kind !== 'success') {
      // FAIL-FAST: night_not_complete means test code tried to endNight mid-flight, an architectural violation
      if (result.kind === 'error' && result.reason === 'night_not_complete') {
        throw new Error(
          `endNight() called before night plan completed. currentStepId=${internal.state.currentStepId}. ` +
            `You must advanceNight() through all steps first.`,
        );
      }
      return { success: false, deaths: [] };
    }
    executeHandler(result);
    return {
      success: true,
      deaths: internal.state.lastNightDeaths ?? [],
    };
  };

  const sendPlayerMessage = (msg: PlayerMessage): ActionResult => {
    // Capture messages for wire protocol contract tests
    internal.capturedMessages.push({
      stepId: internal.state.currentStepId ?? null,
      message: msg,
    });

    const context = createContext(internal.state);

    switch (msg.type) {
      case 'ACTION': {
        const intent: SubmitActionIntent = {
          type: 'SUBMIT_ACTION',
          payload: {
            seat: msg.seat,
            role: msg.role,
            target: msg.target,
            extra: msg.extra,
          },
        };
        const result = executeSubmitAction(intent, context, execution);
        return executeHandler(result);
      }

      case 'WOLF_VOTE': {
        const intent: SubmitActionIntent = {
          type: 'SUBMIT_ACTION',
          payload: {
            seat: msg.seat,
            role: state.players[msg.seat]?.role ?? 'wolf',
            target: msg.target === -1 ? null : msg.target,
            extra: {},
          },
        };
        const result = executeSubmitAction(intent, context, execution);
        return executeHandler(result);
      }

      case 'REVEAL_ACK': {
        // Mirror production handleRevealAck:
        // - no pending acks → fail (idempotent no-op guard)
        // - dispatch CLEAR_REVEAL_ACKS through reducer (clears ALL acks, not just current step)
        if (!internal.state.pendingRevealAcks || internal.state.pendingRevealAcks.length === 0) {
          return { success: false, reason: 'no_pending_acks' };
        }
        const revealAckResult: HandlerResult = handlerSuccess(
          [{ type: 'CLEAR_REVEAL_ACKS' as const }],
          [{ type: 'BROADCAST_STATE' as const }],
        );
        return executeHandler(revealAckResult);
      }

      case 'WOLF_ROBOT_HUNTER_STATUS_VIEWED': {
        const result = handleSetWolfRobotHunterStatusViewed(context, {
          type: 'SET_WOLF_ROBOT_HUNTER_STATUS_VIEWED',
          seat: msg.seat,
        });
        return executeHandler(result);
      }

      default:
        return {
          success: false,
          reason: `Unsupported message type: ${(msg as { type: string }).type}`,
        };
    }
  };

  return {
    getGameState,
    getRevision,
    getNightPlan,
    sendPlayerMessage,
    advanceNight,
    advanceNightOrThrow,
    endNight,
    assertStep,
    findSeatByRole,
    getRoleAtSeat,
    template,
    getCapturedMessages,
    clearCapturedMessages,
  };
}

export function cleanupGame(): void {
  // No singleton — nothing to clean up
}
