/**
 * Production-command Werewolf game for the vertical-slice UI tests: the real engine creates,
 * seats, deals and starts a preset board, and the test walks the night with public and system
 * commands, so the screen renders a state the engine actually produced.
 */

import {
  createTemplateFromRoles,
  type GameState,
  getBottomCardCount,
  getPlayerCount,
  isBotOccupant,
  PRESET_TEMPLATES,
  type RoleId,
  type SchemaId,
  type WerewolfActionInput,
  type WerewolfCommand,
  werewolfEngine,
  type WerewolfInternalCommand,
  type WerewolfPublicCommand,
} from '@game-judge/game-engine/games/werewolf/public';
import { createSeededRng, shuffleArray } from '@game-judge/game-engine/platform/random';

const ROOM_CODE = 'TEST01';
const HOST_USER_ID = 'host-uid';
const INITIAL_NOW_MS = 1_000_000;
const RANDOM_SEED = 'board-test-seed';
const ROLE_ASSIGNMENT_SEED = `${RANDOM_SEED}:role-assignment`;

interface CommandActor {
  readonly userId: string;
  readonly controlledSeat: number | null;
}

interface CommandExecution {
  readonly nowMs?: number;
}

/** Who issues a command: a user (optionally controlling a bot seat) or the system. */
type CommandIdentity =
  | {
      readonly actor: { readonly kind: 'user'; readonly userId: string };
      readonly controlledSeat: number | null;
    }
  | {
      readonly actor: { readonly kind: 'system'; readonly effectId: string };
      readonly controlledSeat: null;
    };

export interface EngineGame {
  getGameState(): GameState;
  /** `werewolf.action.submit` from the seat's occupant; throws unless committed. */
  submitActionOrThrow(seat: number, input: WerewolfActionInput, context: string): void;
  dispatchSystemOrThrow(
    command: WerewolfInternalCommand,
    context: string,
    execution?: CommandExecution,
  ): void;
  acknowledgePendingAudioOrThrow(context: string): void;
  assertStep(expectedStepId: SchemaId): void;
}

/**
 * Invert the production Fisher-Yates permutation so the public assign command
 * produces the seat arrangement requested by the fixture.
 */
function rolesForDesiredSeats(desiredSeatRoles: readonly RoleId[]): RoleId[] {
  const shuffledSourceIndexes = shuffleArray(
    Array.from({ length: desiredSeatRoles.length }, (_, index) => index),
    createSeededRng(`${ROLE_ASSIGNMENT_SEED}:roles`),
  );
  const configuredRoles = new Array<RoleId>(desiredSeatRoles.length);
  for (let seat = 0; seat < desiredSeatRoles.length; seat += 1) {
    configuredRoles[shuffledSourceIndexes[seat]!] = desiredSeatRoles[seat]!;
  }
  return configuredRoles;
}

function desiredSeatRolesOf(
  templateRoles: readonly RoleId[],
  roleAssignment: ReadonlyMap<number, RoleId>,
): RoleId[] {
  const playerCount = getPlayerCount(templateRoles);
  if (getBottomCardCount(templateRoles) !== 0 || roleAssignment.size !== playerCount) {
    throw new Error('[FAIL-FAST] The engine game fixture seats every template role directly');
  }
  const desired = Array.from({ length: playerCount }, (_, seat) => {
    const role = roleAssignment.get(seat);
    if (role === undefined) throw new Error(`[FAIL-FAST] Role fixture is missing seat ${seat}`);
    return role;
  });
  if ([...desired].sort().join() !== [...templateRoles].sort().join()) {
    throw new Error('[FAIL-FAST] Requested seat roles do not match the template role multiset');
  }
  return desired;
}

/** Seats, deals and starts `templateName` with `roleAssignment`, then clears the opening audio. */
export function createEngineGame(
  templateName: string,
  roleAssignment: ReadonlyMap<number, RoleId>,
): EngineGame {
  const templateRoles = PRESET_TEMPLATES.find((preset) => preset.name === templateName)?.roles;
  if (templateRoles === undefined) throw new Error(`Unknown template: ${templateName}`);
  const desiredSeatRoles = desiredSeatRolesOf(templateRoles, roleAssignment);
  const configuredRoles = rolesForDesiredSeats(desiredSeatRoles);
  const template = createTemplateFromRoles(configuredRoles);

  let state = werewolfEngine.createInitialState(
    { templateRoles: configuredRoles, rules: { isSheriffElectionEnabled: false } },
    { roomCode: ROOM_CODE, hostUserId: HOST_USER_ID, nowMs: INITIAL_NOW_MS, commandId: 'create' },
  );
  let commandSequence = 0;
  let nowMs = INITIAL_NOW_MS;

  const runOrThrow = (
    command: WerewolfCommand,
    identity: CommandIdentity,
    context: string,
    execution: CommandExecution & { readonly randomSeed?: string } = {},
  ): void => {
    commandSequence += 1;
    nowMs = execution.nowMs ?? nowMs + 1;
    const decision = werewolfEngine.decide(state, command, {
      ...identity,
      nowMs,
      commandId: `board-command-${commandSequence}`,
      randomSeed: execution.randomSeed ?? `${RANDOM_SEED}:command:${commandSequence}`,
    });
    if (decision.kind === 'reject') throw new Error(`[${context}] rejected: ${decision.reason}`);
    if (decision.outcome.kind === 'domainRejected') {
      throw new Error(`[${context}] domain rejected: ${decision.outcome.reason}`);
    }
    for (const event of decision.events) state = werewolfEngine.evolve(state, event);
    state = werewolfEngine.normalize(state);
  };

  const dispatchOrThrow = (
    command: WerewolfPublicCommand,
    context: string,
    actor: CommandActor = { userId: HOST_USER_ID, controlledSeat: null },
    execution?: CommandExecution & { readonly randomSeed?: string },
  ): void =>
    runOrThrow(
      command,
      { actor: { kind: 'user', userId: actor.userId }, controlledSeat: actor.controlledSeat },
      context,
      execution,
    );

  const dispatchAsSeatOrThrow = (
    seat: number,
    command: WerewolfPublicCommand,
    context: string,
  ): void => {
    const occupant = state.roster[seat];
    if (occupant == null) throw new Error(`[FAIL-FAST] Cannot dispatch as vacant seat ${seat}`);
    const actor: CommandActor = isBotOccupant(occupant)
      ? { userId: HOST_USER_ID, controlledSeat: seat }
      : { userId: occupant.userId, controlledSeat: null };
    dispatchOrThrow(command, context, actor);
  };

  const game: EngineGame = {
    getGameState: () => state,
    submitActionOrThrow: (seat, input, context) =>
      dispatchAsSeatOrThrow(seat, { type: 'werewolf.action.submit', input }, context),
    dispatchSystemOrThrow: (command, context, execution) =>
      runOrThrow(
        command,
        { actor: { kind: 'system', effectId: 'effect:1' }, controlledSeat: null },
        context,
        execution,
      ),
    acknowledgePendingAudioOrThrow: (context) => {
      if (!state.isAudioPlaying || state.pendingAudioEffects.length === 0) {
        throw new Error(`[FAIL-FAST] ${context}: no authoritative audio batch is pending`);
      }
      dispatchOrThrow({ type: 'werewolf.audio.ack', audioBatchId: state.audioBatchId }, context);
    },
    assertStep: (expectedStepId) => {
      const stepId = state.nightStep?.kind === 'inStep' ? state.nightStep.stepId : undefined;
      if (stepId !== expectedStepId) {
        throw new Error(`Step mismatch: expected ${expectedStepId}, got ${String(stepId)}`);
      }
    },
  };

  for (let seat = 0; seat < template.numberOfPlayers; seat += 1) {
    dispatchOrThrow(
      { type: 'room.seat.take', seat, profile: { displayName: `Player ${seat + 1}` } },
      `seat player ${seat}`,
      { userId: seat === 0 ? HOST_USER_ID : `player_${seat}`, controlledSeat: null },
    );
  }
  dispatchOrThrow({ type: 'werewolf.roles.assign' }, 'assign roles', undefined, {
    randomSeed: ROLE_ASSIGNMENT_SEED,
  });
  desiredSeatRoles.forEach((role, seat) => {
    if (state.players[seat]?.role !== role) {
      throw new Error(`[FAIL-FAST] Production role assignment did not satisfy seat ${seat}`);
    }
  });
  for (let seat = 0; seat < template.numberOfPlayers; seat += 1) {
    dispatchAsSeatOrThrow(seat, { type: 'werewolf.role.viewed' }, `view role at seat ${seat}`);
  }
  dispatchOrThrow({ type: 'werewolf.game.begin' }, 'start night');
  game.acknowledgePendingAudioOrThrow('complete initial night audio');
  return game;
}
