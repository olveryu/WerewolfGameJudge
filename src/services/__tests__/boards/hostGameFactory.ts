/**
 * Host Game Factory for Integration Tests
 */

import { GameStateService, GameStatus } from '../../GameStateService';
import { NightFlowController, NightPhase, NightEvent } from '../../NightFlowController';
import { PRESET_TEMPLATES, createTemplateFromRoles, GameTemplate } from '../../../models/Template';
import { RoleName } from '../../../models/roles';
import { RoleAction, makeActionNone, makeActionTarget, makeActionWitch, makeWitchNone, makeWitchSave, makeWitchPoison } from '../../../models/actions';

// =============================================================================
// Mocks
// =============================================================================

jest.mock('../../BroadcastService', () => ({
  BroadcastService: {
    getInstance: jest.fn(() => ({
      joinRoom: jest.fn().mockResolvedValue(undefined),
      leaveRoom: jest.fn().mockResolvedValue(undefined),
      broadcastAsHost: jest.fn().mockResolvedValue(undefined),
      sendToHost: jest.fn().mockResolvedValue(undefined),
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
  findSeatByRole: (role: RoleName) => number;
  getRoleAtSeat: (seat: number) => RoleName | null;
}

export interface NightActionSequence {
  [role: string]: number | null | undefined;
  /** Special key for witch poison (separate from witch save) */
  witchPoison?: number | null;
}

export interface NightResult {
  deaths: number[];
  info: string;
  completed: boolean;
}

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
 * - For witch: extra=false → save, extra=true → poison
 * - For magician: target is firstSeat, extra is ignored (magician has separate handling if needed)
 * - For other roles: target action or none
 */
function buildRoleAction(role: RoleName, target: number | null, extra?: boolean): RoleAction {
  if (target === null) {
    if (role === 'witch') return makeActionWitch(makeWitchNone());
    return makeActionNone();
  }
  if (role === 'witch') {
    return makeActionWitch(extra ? makeWitchPoison(target) : makeWitchSave(target));
  }
  // For standard roles (seer, guard, wolf, etc.)
  return makeActionTarget(target);
}

function processRoleAction(
  nightFlow: NightFlowController,
  actions: NightActionSequence,
  stateActions: Map<RoleName, RoleAction>
): void {
  const currentRole = nightFlow.currentRole;
  if (!currentRole) return;

  const action = actions[currentRole];
  const witchPoison = actions.witchPoison;

  // Build action value
  let roleAction: RoleAction;
  if (currentRole === 'witch' && witchPoison !== undefined) {
    // Use witchPoison if specified
    roleAction = buildRoleAction('witch', witchPoison ?? null, true);
  } else if (action === undefined) {
    roleAction = buildRoleAction(currentRole, null);
  } else {
    roleAction = buildRoleAction(currentRole, action ?? null);
  }

  stateActions.set(currentRole, roleAction);

  // Legacy: NightFlowController still uses number encoding internally for recordAction
  const legacyActionValue = action ?? -1;
  nightFlow.recordAction(currentRole, legacyActionValue);
  nightFlow.dispatch(NightEvent.ActionSubmitted);
  nightFlow.dispatch(NightEvent.RoleEndAudioDone);
}

// =============================================================================
// Factory Function
// =============================================================================

export async function createHostGame(
  templateNameOrRoles: string | RoleName[],
  roleAssignment?: Map<number, RoleName>
): Promise<HostGameContext> {
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

  const findSeatByRole = (role: RoleName): number => {
    const s = getState();
    if (!s) return -1;
    for (const [seat, player] of s.players) {
      if (player?.role === role) return seat;
    }
    return -1;
  };

  const getRoleAtSeat = (seat: number): RoleName | null => {
    return getState()?.players.get(seat)?.role ?? null;
  };

  const submitAction = async (target: number | null, extra?: boolean): Promise<void> => {
    const nightFlow = getNightFlow();
    if (!nightFlow) throw new Error('Night flow not initialized');

    advanceToWaitingForAction(nightFlow);

    const currentRole = nightFlow.currentRole;
    if (!currentRole) throw new Error('No current role');

    const s = getState()!;
    const roleAction = buildRoleAction(currentRole, target, extra);
    s.actions.set(currentRole, roleAction);
    // Legacy: NightFlowController still uses number encoding
    const legacyValue = target ?? -1;
    nightFlow.recordAction(currentRole, legacyValue);
    nightFlow.dispatch(NightEvent.ActionSubmitted);
    nightFlow.dispatch(NightEvent.RoleEndAudioDone);
  };

  const runNight = async (actions: NightActionSequence): Promise<NightResult> => {
    const nightFlow = getNightFlow();
    if (!nightFlow) return { deaths: [], info: '', completed: false };

    const s = getState()!;

    while (nightFlow.hasMoreRoles() && !nightFlow.isTerminal()) {
      advanceToWaitingForAction(nightFlow);
      if (nightFlow.isTerminal()) break;
      processRoleAction(nightFlow, actions, s.actions);
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
  };
}

export function cleanupHostGame(): void {
  jest.useRealTimers();
  (GameStateService as any).instance = undefined;
}
