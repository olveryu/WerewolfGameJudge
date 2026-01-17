/**
 * Host Game Factory for Integration Tests
 */

import { GameStateService, GameStatus } from '../../GameStateService';
import { NightFlowController, NightPhase, NightEvent } from '../../NightFlowController';
import { PRESET_TEMPLATES, createTemplateFromRoles, GameTemplate } from '../../../models/Template';
import { RoleId } from '../../../models/roles';
import {
  RoleAction,
  makeActionNone,
  makeActionTarget,
  makeActionWitch,
  makeWitchNone,
  makeWitchSave,
  makeWitchPoison,
  getActionTargetSeat,
} from '../../../models/actions';
import type { PlayerMessage } from '../../BroadcastService';

// =============================================================================
// Mocks
// =============================================================================

// Track sendPrivate calls for testing
export const mockSendPrivate = jest.fn().mockResolvedValue(undefined);

// Captured onPlayerMessage callback from joinRoom - allows simulating player→host messages
let capturedOnPlayerMessage:
  | ((msg: PlayerMessage, senderId: string) => void | Promise<void>)
  | null = null;

/**
 * Reset module-level shared state to avoid cross-test pollution.
 * Called at the start of createHostGame and in cleanupHostGame.
 */
function resetSharedState(): void {
  capturedOnPlayerMessage = null;
  mockSendPrivate.mockClear();
}

jest.mock('../../BroadcastService', () => ({
  BroadcastService: {
    getInstance: jest.fn(() => ({
      joinRoom: jest
        .fn()
        .mockImplementation(
          (
            _roomCode: string,
            _uid: string,
            handlers?: { onPlayerMessage?: (msg: any, senderId: string) => void },
          ) => {
            if (handlers?.onPlayerMessage) {
              capturedOnPlayerMessage = handlers.onPlayerMessage;
            }
            return Promise.resolve(undefined);
          },
        ),
      leaveRoom: jest.fn().mockResolvedValue(undefined),
      broadcastAsHost: jest.fn().mockResolvedValue(undefined),
      sendToHost: jest.fn().mockResolvedValue(undefined),
      sendPrivate: mockSendPrivate,
    })),
  },
}));

jest.mock('../../AudioService', () => ({
  __esModule: true,
  default: {
    getInstance: jest.fn(() => ({
      playNightBeginAudio: jest.fn().mockResolvedValue(undefined),
      playNightEndAudio: jest.fn().mockResolvedValue(undefined),
      playRoleBeginningAudio: jest.fn().mockResolvedValue(undefined),
      playRoleEndingAudio: jest.fn().mockResolvedValue(undefined),
    })),
  },
}));

// =============================================================================
// Types
// =============================================================================

export interface HostGameContext {
  service: GameStateService;
  template: GameTemplate;
  getState: () => ReturnType<GameStateService['getState']>;
  getNightFlow: () => NightFlowController | null;
  getLastNightDeaths: () => number[];
  getLastNightInfo: () => string;
  submitAction: (target: number | null, extra?: boolean) => Promise<void>;
  runNight: (actions: NightActionSequence) => Promise<NightResult>;
  findSeatByRole: (role: RoleId) => number;
  getRoleAtSeat: (seat: number) => RoleId | null;
  /**
   * Send a WOLF_VOTE message from a specific seat.
   * Used for testing wolf vote rejection logic (Commit 3).
   */
  sendWolfVote: (seat: number, target: number) => Promise<void>;
}

export interface NightActionSequence {
  [role: string]: number | null | undefined | { firstSeat: number; secondSeat: number };
  /** Special key for witch poison (separate from witch save) */
  witchPoison?: number | null;
  /** Special key for magician swap (two seats) */
  magician?: { firstSeat: number; secondSeat: number } | null;
}

export interface NightResult {
  deaths: number[];
  info: string;
  completed: boolean;
}

type WitchExtra = { poison: true } | { save: true };

// =============================================================================
// Internal Helpers
// =============================================================================

function resetGameStateService(): GameStateService {
  (GameStateService as any).instance = undefined;
  return GameStateService.getInstance();
}

function getNextEvent(phase: NightPhase): NightEvent | null {
  switch (phase) {
    case NightPhase.NightBeginAudio:
      return NightEvent.NightBeginAudioDone;
    case NightPhase.RoleBeginAudio:
      return NightEvent.RoleBeginAudioDone;
    case NightPhase.RoleEndAudio:
      return NightEvent.RoleEndAudioDone;
    case NightPhase.NightEndAudio:
      return NightEvent.NightEndAudioDone;
    default:
      return null;
  }
}

function advanceToWaitingForAction(nightFlow: NightFlowController): void {
  while (nightFlow.phase !== NightPhase.WaitingForAction && !nightFlow.isTerminal()) {
    const event = getNextEvent(nightFlow.phase);
    if (!event) break;
    nightFlow.dispatch(event);
  }
}

/**
 * Builds a RoleAction for a given role based on target and extra flag.
 * - For witch: extra={save:true} → save, extra={poison:true} → poison
 * - For other roles: target action or none
 *
 * NOTE: Magician is handled separately in processRoleAction using encoded target.
 * This function is NOT called for magician - see processRoleAction for wire protocol.
 */
function buildRoleAction(role: RoleId, target: number | null, extra?: any): RoleAction {
  if (target === null) {
    if (role === 'witch') return makeActionWitch(makeWitchNone());
    return makeActionNone();
  }
  if (role === 'witch') {
    if (extra?.poison === true) return makeActionWitch(makeWitchPoison(target));
    if (extra?.save === true) return makeActionWitch(makeWitchSave(target));
    throw new Error('[hostGameFactory] Invalid witch extra payload for buildRoleAction');
  }
  // For standard roles (seer, guard, wolf, etc.)
  return makeActionTarget(target);
}

/**
 * Find the seat number for a given role in the current game state.
 */
function findSeatForRole(service: GameStateService, role: RoleId): number {
  const state = service.getState();
  if (!state) return 0;
  for (const [seat, player] of state.players) {
    if (player?.role === role) return seat;
  }
  return 0;
}

/**
 * Process a role action by simulating a player→host ACTION message.
 * This goes through the real handlePlayerAction path, which triggers private reveals.
 *
 * Special handling for nightmare-blocked players:
 * - If a player is blocked by nightmare and test specifies a non-null action,
 *   we send a skip (target=null) to advance the flow, then directly write the
 *   test-specified action to state for DeathCalculator defensive testing.
 */
async function processRoleAction(
  nightFlow: NightFlowController,
  actions: NightActionSequence,
  service: GameStateService,
): Promise<void> {
  const currentRole = nightFlow.currentRole;
  if (!currentRole) return;

  const action = actions[currentRole];
  const witchPoison = actions.witchPoison;
  const magicianAction = actions.magician;

  // Determine target and extra for the ACTION message
  let target: number | null;
  let extra: WitchExtra | undefined;

  if (currentRole === 'magician') {
    // Magician: send encoded target = firstSeat + secondSeat * 100
    if (magicianAction && typeof magicianAction === 'object') {
      target = magicianAction.firstSeat + magicianAction.secondSeat * 100;
      extra = undefined;
    } else {
      target = null;
      extra = undefined;
    }
  } else if (currentRole === 'witch' && witchPoison !== undefined) {
    // Witch poison case
    target = witchPoison ?? null;
    extra = target === null ? undefined : { poison: true };
  } else if (action === undefined || (typeof action === 'object' && action !== null)) {
    // Object action for non-magician roles should not happen, but handle gracefully
    target = null;
    extra = undefined;
  } else {
    target = action ?? null;
    if (target === null) {
      extra = undefined;
    } else if (currentRole === 'witch') {
      extra = { save: true };
    } else {
      extra = undefined;
    }
  }

  // Find the seat for this role
  const seat = findSeatForRole(service, currentRole);

  // Check if this player is blocked by nightmare
  const state = service.getState()!;
  const nightmareAction = state.actions.get('nightmare');
  const blockedSeat = getActionTargetSeat(nightmareAction);
  const isBlocked = blockedSeat === seat;

  // If blocked and test specified non-null target, we need special handling:
  // 1. Send skip (target=null) to advance the flow (Host accepts skip from blocked players)
  // 2. Directly write the test-specified action to state for DeathCalculator testing
  const actualTarget = isBlocked && target !== null ? null : target;
  const actualExtra = isBlocked && target !== null ? undefined : extra;

  // Simulate player→host ACTION message via captured callback
  // FAIL-FAST: capturedOnPlayerMessage must be set by joinRoom mock
  if (!capturedOnPlayerMessage) {
    throw new Error(
      `[hostGameFactory] capturedOnPlayerMessage is null - BroadcastService mock not set up correctly. ` +
        `role=${currentRole} seat=${seat}`,
    );
  }

  const msg: PlayerMessage = {
    type: 'ACTION',
    seat,
    role: currentRole,
    target: actualTarget,
    extra: actualExtra,
  };

  // Remember current action index to detect when processing completes
  const startIndex = nightFlow.currentActionIndex;
  const startPhase = nightFlow.phase;

  // Call the captured callback (this triggers handlePlayerAction in GameStateService)
  // Note: GameStateService uses asyncHandler which returns void, not Promise
  // So we need to wait for the state machine to advance.
  //
  // Reveal roles (seer/psychic/gargoyle/wolfRobot) are now gated by an explicit
  // REVEAL_ACK from the acting player before the night flow can advance.
  // For most host runtime integration tests we auto-ACK to keep them focused on
  // game logic invariants rather than UI confirmation.
  capturedOnPlayerMessage(msg, `player_${seat}`);

  const isRevealRole =
    currentRole === 'seer' ||
    currentRole === 'psychic' ||
    currentRole === 'gargoyle' ||
    currentRole === 'wolfRobot';

  if (isRevealRole) {
    // Force microtasks/timers to run so the host can send the private reveal first.
    await jest.runOnlyPendingTimersAsync();
    await Promise.resolve();

    const ackMsg: PlayerMessage = {
      type: 'REVEAL_ACK',
      seat,
      role: currentRole,
      revision: service.getStateRevision(),
    };
    capturedOnPlayerMessage(ackMsg, `player_${seat}`);
  }

  // Wait for nightFlow to advance (handlePlayerAction is async, wrapped by asyncHandler)
  // Use a generous upper bound (fake timers don't add real delay)
  // Each iteration flushes pending timers and microtasks
  const maxIterations = 100; // ~500ms equivalent with fake timers, plenty of headroom
  let iterations = 0;

  while (iterations < maxIterations) {
    // Flush only pending timers (not advancing time beyond what's scheduled)
    await jest.runOnlyPendingTimersAsync();
    await Promise.resolve(); // microtask flush

    // Check if nightFlow advanced (index changed, phase changed, or terminal)
    if (
      nightFlow.currentActionIndex !== startIndex ||
      nightFlow.phase !== startPhase ||
      nightFlow.isTerminal()
    ) {
      break;
    }
    iterations++;
  }

  // FAIL-FAST: If we exhausted iterations without advancing, something is wrong
  if (
    iterations >= maxIterations &&
    nightFlow.currentActionIndex === startIndex &&
    nightFlow.phase === startPhase &&
    !nightFlow.isTerminal()
  ) {
    throw new Error(
      `[hostGameFactory] processRoleAction timed out waiting for nightFlow to advance. ` +
        `role=${currentRole} seat=${seat} phase=${nightFlow.phase} index=${nightFlow.currentActionIndex} ` +
        `blockedSeat=${blockedSeat} isBlocked=${isBlocked} target=${target} actualTarget=${actualTarget}`,
    );
  }

  // For blocked players with non-null test action: directly write to state for DeathCalculator testing
  // This simulates "what if the action somehow got into state" for defensive testing
  if (isBlocked && target !== null) {
    const roleAction = buildRoleAction(currentRole, target, extra);
    state.actions.set(currentRole, roleAction);
  }
}

// =============================================================================
// Factory Function
// =============================================================================

export async function createHostGame(
  templateNameOrRoles: string | RoleId[],
  roleAssignment?: Map<number, RoleId>,
): Promise<HostGameContext> {
  // Reset shared state to avoid cross-test pollution
  resetSharedState();

  jest.useFakeTimers();

  const service = resetGameStateService();

  let template: GameTemplate;
  if (typeof templateNameOrRoles === 'string') {
    const preset = PRESET_TEMPLATES.find((t) => t.name === templateNameOrRoles);
    if (!preset) throw new Error(`Unknown template: ${templateNameOrRoles}`);
    template = createTemplateFromRoles(preset.roles);
  } else {
    template = createTemplateFromRoles(templateNameOrRoles);
  }

  await service.initializeAsHost('TEST01', 'host-uid', template);

  const state = service.getState()!;
  for (let i = 0; i < template.numberOfPlayers; i++) {
    state.players.set(i, {
      uid: `player_${i}`,
      seatNumber: i,
      displayName: `Player ${i + 1}`,
      avatarUrl: undefined,
      role: null,
      hasViewedRole: false,
    });
  }
  state.status = GameStatus.seated;

  if (roleAssignment) {
    roleAssignment.forEach((role, seat) => {
      const player = state.players.get(seat);
      if (player) player.role = role;
    });
    state.status = GameStatus.assigned;
  } else {
    await service.assignRoles();
  }

  state.players.forEach((player) => {
    if (player) player.hasViewedRole = true;
  });
  state.status = GameStatus.ready;

  const startPromise = service.startGame();
  await jest.runAllTimersAsync();
  await startPromise;

  const getState = () => service.getState();
  const getNightFlow = (): NightFlowController | null => (service as any).nightFlow;
  const getLastNightDeaths = (): number[] => getState()?.lastNightDeaths ?? [];
  const getLastNightInfo = (): string => service.getLastNightInfo();

  const findSeatByRole = (role: RoleId): number => {
    const s = getState();
    if (!s) return -1;
    for (const [seat, player] of s.players) {
      if (player?.role === role) return seat;
    }
    return -1;
  };

  const getRoleAtSeat = (seat: number): RoleId | null => {
    return getState()?.players.get(seat)?.role ?? null;
  };

  const submitAction = async (target: number | null, extra?: boolean): Promise<void> => {
    const nightFlow = getNightFlow();
    if (!nightFlow) throw new Error('Night flow not initialized');

    advanceToWaitingForAction(nightFlow);

    const currentRole = nightFlow.currentRole;
    if (!currentRole) throw new Error('No current role');

    const s = getState()!;
    let witchExtra: WitchExtra | undefined;
    if (currentRole === 'witch' && target !== null) {
      witchExtra = extra === true ? { poison: true } : { save: true };
    }
    const roleAction = buildRoleAction(currentRole, target, witchExtra);
    s.actions.set(currentRole, roleAction);
    // Legacy: NightFlowController still uses number encoding
    const legacyValue = target ?? -1;
    nightFlow.recordAction(currentRole, legacyValue);
    nightFlow.dispatch(NightEvent.ActionSubmitted);
    nightFlow.dispatch(NightEvent.RoleEndAudioDone);
    // Sync currentActionerIndex from nightFlow (mirrors GameStateService.advanceToNextAction)
    s.currentActionerIndex = nightFlow.currentActionIndex;
  };

  const runNight = async (actions: NightActionSequence): Promise<NightResult> => {
    const nightFlow = getNightFlow();
    if (!nightFlow) return { deaths: [], info: '', completed: false };

    const s = getState()!;

    while (nightFlow.hasMoreRoles() && !nightFlow.isTerminal()) {
      advanceToWaitingForAction(nightFlow);
      if (nightFlow.isTerminal()) break;
      await processRoleAction(nightFlow, actions, service);
    }

    if (nightFlow.phase === NightPhase.NightEndAudio) {
      nightFlow.dispatch(NightEvent.NightEndAudioDone);
    }

    const deaths = (service as any).doCalculateDeaths() as number[];
    s.lastNightDeaths = deaths;

    return {
      deaths,
      info: getLastNightInfo(),
      completed: nightFlow.phase === NightPhase.Ended,
    };
  };

  /**
   * Send a WOLF_VOTE message from a specific seat.
   * Used for testing wolf vote rejection logic (Commit 3).
   * This simulates a wolf player voting during the wolf meeting phase.
   */
  const sendWolfVote = async (seat: number, target: number): Promise<void> => {
    if (!capturedOnPlayerMessage) {
      throw new Error(
        `[hostGameFactory] capturedOnPlayerMessage is null - BroadcastService mock not set up correctly. ` +
          `Cannot send WOLF_VOTE from seat=${seat}`,
      );
    }

    const msg: PlayerMessage = {
      type: 'WOLF_VOTE',
      seat,
      target,
    };

    // Call the captured callback
    capturedOnPlayerMessage(msg, `player_${seat}`);

    // Wait for async processing
    await jest.runOnlyPendingTimersAsync();
    await Promise.resolve();
  };

  return {
    service,
    template,
    getState,
    getNightFlow,
    getLastNightDeaths,
    getLastNightInfo,
    submitAction,
    runNight,
    findSeatByRole,
    getRoleAtSeat,
    sendWolfVote,
  };
}

export function cleanupHostGame(): void {
  jest.useRealTimers();
  (GameStateService as any).instance = undefined;
  // Reset shared state to avoid cross-test pollution
  resetSharedState();
}
