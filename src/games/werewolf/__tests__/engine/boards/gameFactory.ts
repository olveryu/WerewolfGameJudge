/** Production-command Werewolf fixture builder for cross-package board tests. */

import {
  buildNightPlan,
  createTemplateFromRoles,
  type GameState,
  getBottomCardCount,
  getPlayerCount,
  PRESET_TEMPLATES,
  type RoleId,
  type SchemaId,
  werewolfEngine,
  type WerewolfPublicCommand,
} from '@game-judge/game-engine/games/werewolf/public';
import type { CommandContext } from '@game-judge/game-engine/platform/engine';
import {
  createRoomCommandResult,
  type RoomCommandResult,
} from '@game-judge/game-engine/platform/protocol/commandResult';
import { createSeededRng, shuffleArray } from '@game-judge/game-engine/platform/random';

import type { GameContext, TestCommandActor, TestCommandExecution } from './gameContext';

const ROOM_CODE = 'TEST01';
const HOST_USER_ID = 'host-uid';
const INITIAL_NOW_MS = 1_000_000;
const DEFAULT_RANDOM_SEED = 'board-test-seed';
const ROLE_ASSIGNMENT_SEED_SUFFIX = 'role-assignment';

interface InternalState {
  state: GameState;
  revision: number;
  commandSequence: number;
  nowMs: number;
  readonly randomSeed: string;
}

interface CreateGameOptions {
  /** Base seed used to derive deterministic, command-scoped random seeds. */
  readonly randomSeed?: string;
}

function assertSameRoleMultiset(actual: readonly RoleId[], expected: readonly RoleId[]): void {
  const count = (roles: readonly RoleId[]): Map<RoleId, number> => {
    const result = new Map<RoleId, number>();
    for (const role of roles) result.set(role, (result.get(role) ?? 0) + 1);
    return result;
  };
  const actualCounts = count(actual);
  const expectedCounts = count(expected);
  if (
    actualCounts.size !== expectedCounts.size ||
    [...actualCounts].some(([role, value]) => expectedCounts.get(role) !== value)
  ) {
    throw new Error('[FAIL-FAST] Requested seat roles do not match the template role multiset');
  }
}

function getDesiredSeatRoles(
  templateRoles: readonly RoleId[],
  roleAssignment: ReadonlyMap<number, RoleId> | undefined,
): RoleId[] {
  const playerCount = getPlayerCount(templateRoles);
  if (roleAssignment === undefined) return templateRoles.slice(0, playerCount);
  if (roleAssignment.size !== playerCount) {
    throw new Error(
      `[FAIL-FAST] Role fixture has ${roleAssignment.size} seats; expected ${playerCount}`,
    );
  }
  return Array.from({ length: playerCount }, (_, seat) => {
    const role = roleAssignment.get(seat);
    if (role === undefined) {
      throw new Error(`[FAIL-FAST] Role fixture is missing seat ${seat}`);
    }
    return role;
  });
}

/**
 * Invert the production Fisher-Yates permutation so the public assign command
 * produces the seat arrangement requested by a deterministic test fixture.
 */
function createTemplateRolesForDesiredSeats(
  templateRoles: readonly RoleId[],
  desiredSeatRoles: readonly RoleId[],
  roleAssignmentSeed: string,
): RoleId[] {
  if (getBottomCardCount(templateRoles) !== 0) return [...templateRoles];
  assertSameRoleMultiset(desiredSeatRoles, templateRoles);

  const shuffledSourceIndexes = shuffleArray(
    Array.from({ length: desiredSeatRoles.length }, (_, index) => index),
    createSeededRng(`${roleAssignmentSeed}:roles`),
  );
  const configuredRoles = new Array<RoleId>(desiredSeatRoles.length);
  for (let seat = 0; seat < desiredSeatRoles.length; seat += 1) {
    configuredRoles[shuffledSourceIndexes[seat]!] = desiredSeatRoles[seat]!;
  }
  return configuredRoles;
}

function assertCommitted(result: RoomCommandResult<GameState>, context: string): void {
  if (result.kind === 'rejected') {
    throw new Error(`[${context}] rejected: ${result.reason}`);
  }
  if (result.outcome.kind === 'domainRejected') {
    throw new Error(`[${context}] domain rejected: ${result.outcome.reason}`);
  }
}

export function createGame(
  templateNameOrRoles: string | RoleId[],
  roleAssignment?: Map<number, RoleId>,
  options?: CreateGameOptions,
): GameContext {
  const sourceRoles =
    typeof templateNameOrRoles === 'string'
      ? PRESET_TEMPLATES.find((candidate) => candidate.name === templateNameOrRoles)?.roles
      : templateNameOrRoles;
  if (sourceRoles === undefined) {
    throw new Error(`Unknown template: ${String(templateNameOrRoles)}`);
  }

  const randomSeed = options?.randomSeed ?? DEFAULT_RANDOM_SEED;
  const roleAssignmentSeed = `${randomSeed}:${ROLE_ASSIGNMENT_SEED_SUFFIX}`;
  const desiredSeatRoles = getDesiredSeatRoles(sourceRoles, roleAssignment);
  const configuredRoles = createTemplateRolesForDesiredSeats(
    sourceRoles,
    desiredSeatRoles,
    roleAssignmentSeed,
  );
  const template = createTemplateFromRoles(configuredRoles);

  const internal: InternalState = {
    state: werewolfEngine.createInitialState(
      {
        templateRoles: configuredRoles,
        rules: { isSheriffElectionEnabled: false },
      },
      {
        roomCode: ROOM_CODE,
        hostUserId: HOST_USER_ID,
        nowMs: INITIAL_NOW_MS,
        commandId: 'board-fixture-create',
      },
    ),
    revision: 0,
    commandSequence: 0,
    nowMs: INITIAL_NOW_MS,
    randomSeed,
  };

  const getGameState = (): GameState => internal.state;
  const getRevision = (): number => internal.revision;
  const getNightPlan = () =>
    buildNightPlan(internal.state.templateRoles, internal.state.seerLabelMap);

  const dispatch = (
    command: WerewolfPublicCommand,
    actor: TestCommandActor = { userId: HOST_USER_ID, controlledSeat: null },
    execution: TestCommandExecution = {},
  ): RoomCommandResult<GameState> => {
    internal.commandSequence += 1;
    const commandId = `board-command-${internal.commandSequence}`;
    const nowMs = execution.nowMs ?? internal.nowMs + 1;
    internal.nowMs = nowMs;
    const context: CommandContext = {
      nowMs,
      commandId,
      randomSeed:
        execution.randomSeed ?? `${internal.randomSeed}:command:${internal.commandSequence}`,
      actor: { kind: 'user', userId: actor.userId },
      controlledSeat: actor.controlledSeat,
    };
    const decision = werewolfEngine.decide(internal.state, command, context);
    if (decision.kind === 'reject') {
      return createRoomCommandResult({ kind: 'rejected', commandId, reason: decision.reason });
    }

    for (const event of decision.events) {
      internal.state = werewolfEngine.evolve(internal.state, event);
    }
    internal.state = werewolfEngine.normalize(internal.state);
    if (decision.events.length > 0) internal.revision += 1;
    return createRoomCommandResult({
      kind: 'committed',
      commandId,
      state: internal.state,
      revision: internal.revision,
      outcome: decision.outcome,
    });
  };

  const dispatchAsSeat = (
    seat: number,
    command: WerewolfPublicCommand,
    execution?: TestCommandExecution,
  ): RoomCommandResult<GameState> => {
    const player = internal.state.players[seat];
    if (player === null || player === undefined) {
      throw new Error(`[FAIL-FAST] Cannot dispatch as vacant seat ${seat}`);
    }
    const actor: TestCommandActor = player.isBot
      ? { userId: HOST_USER_ID, controlledSeat: seat }
      : { userId: player.userId, controlledSeat: null };
    return dispatch(command, actor, execution);
  };

  const dispatchOrThrow = (
    command: WerewolfPublicCommand,
    context: string,
    actor?: TestCommandActor,
    execution?: TestCommandExecution,
  ): RoomCommandResult<GameState> => {
    const result = dispatch(command, actor, execution);
    assertCommitted(result, context);
    return result;
  };

  const dispatchAsSeatOrThrow = (
    seat: number,
    command: WerewolfPublicCommand,
    context: string,
    execution?: TestCommandExecution,
  ): RoomCommandResult<GameState> => {
    const result = dispatchAsSeat(seat, command, execution);
    assertCommitted(result, context);
    return result;
  };

  const acknowledgePendingAudioOrThrow = (context: string): void => {
    if (!internal.state.isAudioPlaying || internal.state.pendingAudioEffects?.length === 0) {
      throw new Error(`[FAIL-FAST] ${context}: no authoritative audio batch is pending`);
    }
    dispatchOrThrow({ type: 'werewolf.audio.ack' }, context);
  };

  const assertStep = (expectedStepId: SchemaId): void => {
    const currentStepId = internal.state.currentStepId;
    if (currentStepId !== expectedStepId) {
      throw new Error(`Step mismatch: expected ${expectedStepId}, got ${String(currentStepId)}`);
    }
  };

  const findSeatByRole = (role: RoleId): number => {
    for (const [seatText, player] of Object.entries(internal.state.players)) {
      if (player?.role === role) return Number.parseInt(seatText, 10);
    }
    return -1;
  };

  const getRoleAtSeat = (seat: number): RoleId | null => internal.state.players[seat]?.role ?? null;

  const context: GameContext = {
    getGameState,
    getRevision,
    getNightPlan,
    dispatch,
    dispatchAsSeat,
    dispatchOrThrow,
    dispatchAsSeatOrThrow,
    acknowledgePendingAudioOrThrow,
    assertStep,
    findSeatByRole,
    getRoleAtSeat,
  };

  for (let seat = 0; seat < template.numberOfPlayers; seat += 1) {
    const userId = seat === 0 ? HOST_USER_ID : `player_${seat}`;
    context.dispatchOrThrow(
      {
        type: 'room.seat.take',
        seat,
        profile: { displayName: `Player ${seat + 1}` },
      },
      `seat player ${seat}`,
      { userId, controlledSeat: null },
    );
  }

  context.dispatchOrThrow({ type: 'werewolf.roles.assign' }, 'assign roles', undefined, {
    randomSeed: roleAssignmentSeed,
  });

  if (getBottomCardCount(sourceRoles) === 0) {
    for (let seat = 0; seat < desiredSeatRoles.length; seat += 1) {
      if (internal.state.players[seat]?.role !== desiredSeatRoles[seat]) {
        throw new Error(`[FAIL-FAST] Production role assignment did not satisfy seat ${seat}`);
      }
    }
  } else if (roleAssignment !== undefined) {
    throw new Error(
      '[FAIL-FAST] Bottom-card fixtures must use a production seed and assert the resulting deal',
    );
  }

  for (let seat = 0; seat < template.numberOfPlayers; seat += 1) {
    context.dispatchAsSeatOrThrow(
      seat,
      { type: 'werewolf.role.view' },
      `view role at seat ${seat}`,
    );
  }
  context.dispatchOrThrow({ type: 'werewolf.night.start' }, 'start night');
  context.acknowledgePendingAudioOrThrow('complete initial night audio');

  return context;
}

export function cleanupGame(): void {
  // Each fixture owns isolated state; no process-global cleanup is required.
}
