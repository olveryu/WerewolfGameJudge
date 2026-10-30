/**
 * Board UI test utilities: a real `GameState` behind a fake room link.
 *
 * The screen under test is the production `WerewolfRoomContent` mounted
 * on `createFakeRoomLink`; the view model, the night model and every
 * dialog come from the real projection and hooks. Options describe the
 * night-step situation (step, roles, seat, server facts) and the factory
 * writes the matching authoritative state, including the engine's own UI
 * hint for the step. Dispatch is recorded: `werewolf.action.submit` goes
 * through the overridable `submitAction` mock, everything else succeeds.
 */

import { maybeCreateUiHintAction } from '@game-judge/game-engine/games/werewolf/domain/handlers/uiHint';
import type {
  GameState,
  RevealKind,
  RoleId,
  SchemaId,
  WerewolfActionInput,
  WerewolfPublicCommand,
} from '@game-judge/game-engine/games/werewolf/public';
import {
  buildNightPlan,
  GameStatus,
  getRoleDisplayName,
  getSchema,
  SCHEMAS,
  Team,
  WOLF_KILL_OVERRIDE_TEXTS,
} from '@game-judge/game-engine/games/werewolf/public';
import { createRoomSnapshot } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import { isBotOccupant } from '@game-judge/game-engine/platform/room/seating/roster';
import { fireEvent, waitFor } from '@testing-library/react-native';
import type { ReactTestInstance } from 'react-test-renderer';

import type { RoomRecord } from '@/features/room/model/RoomDirectory';
import type { WerewolfAudioRuntime } from '@/games/werewolf/audio/WerewolfAudioPlayer';
import { type WerewolfRoomScreen } from '@/games/werewolf/room/__tests__/harness/ReadyWerewolfRoomScreen';
import type { DispatchOutcome } from '@/platform/realtime/types';
import {
  createFakeRoomLink,
  type FakeRoomLink,
  readyLinkSnapshot,
} from '@/test-utils/linkSnapshot';
import { successfulRoomCommand } from '@/test-utils/roomCommand';
import { buildWerewolfTestState } from '@/test-utils/werewolfState';
import { TESTIDS } from '@/testids';

import { type RoomScreenTestHarness } from './RoomScreenTestHarness';

/** The auth user every room UI test renders as (jest.setup AuthContext mock). */
const TEST_USER_ID = 'test-uid';
const OTHER_HOST_USER_ID = 'host-uid';

type RoomScreenProps = React.ComponentProps<typeof WerewolfRoomScreen>;

export const mockNavigation = {
  navigate: jest.fn(),
  replace: jest.fn(),
  goBack: jest.fn(),
  setOptions: jest.fn(),
} as unknown as RoomScreenProps['navigation'];

export const mockRoom: RoomRecord<'werewolf'> = {
  roomCode: '1234',
  roomId: 'room-id-1234',
  gameType: 'werewolf',
  hostUserId: OTHER_HOST_USER_ID,
  createdAt: new Date(0),
};

export type WerewolfDispatchOutcome = DispatchOutcome<GameState>;

export function successfulWerewolfCommand(
  stateOverrides: Partial<GameState> = {},
): WerewolfDispatchOutcome {
  return successfulRoomCommand(buildWerewolfTestState(stateOverrides));
}

function revealState(revealKind: RevealKind, targetSeat: number): Partial<GameState> {
  switch (revealKind) {
    case 'seer':
      return { seerReveal: { targetSeat, result: '好人' } };
    case 'mirrorSeer':
      return { mirrorSeerReveal: { targetSeat, result: '好人' } };
    case 'drunkSeer':
      return { drunkSeerReveal: { targetSeat, result: '好人' } };
    case 'psychic':
      return { psychicReveal: { targetSeat, result: 'villager' } };
    case 'gargoyle':
      return { gargoyleReveal: { targetSeat, result: 'villager' } };
    case 'pureWhite':
      return { pureWhiteReveal: { targetSeat, result: 'villager' } };
    case 'wolfWitch':
      return { wolfWitchReveal: { targetSeat, result: 'villager' } };
    case 'wolfRobot':
      return {
        wolfRobotReveal: { targetSeat, result: 'villager', learnedRoleId: 'villager' },
      };
  }
}

/** A committed action result carrying the reveal the step produces, for reveal schemas. */
function successfulWerewolfActionCommand(
  schemaId: SchemaId,
  input: WerewolfActionInput,
): WerewolfDispatchOutcome {
  const schema = getSchema(schemaId);
  const revealKind = schema.kind === 'chooseSeat' ? schema.ui?.revealKind : undefined;
  if (revealKind === undefined) return successfulWerewolfCommand();
  if (input.kind !== 'target' || input.target === null) {
    throw new Error(`[TEST] Reveal schema ${schemaId} requires a numeric target command`);
  }
  return successfulWerewolfCommand(revealState(revealKind, input.target));
}

// =============================================================================
// Room mock
// =============================================================================

export type SubmitActionMock = jest.Mock<Promise<WerewolfDispatchOutcome>, [WerewolfActionInput]>;

export interface WerewolfRoomMockOptions {
  /** Schema ID for the current step. */
  schemaId: SchemaId;
  /** The step's acting role; must be on the board (placed on a villager seat when absent). */
  currentActionRole: RoleId;
  /** The viewer's role. */
  myRole: RoleId;
  /** The viewer's seat. */
  mySeat?: number;
  numberOfPlayers?: number;
  /** Seat → role; unassigned seats are villagers, `mySeat` is `myRole`. */
  roleAssignments?: Map<number, RoleId>;
  isHost?: boolean;
  /** False renders the test user as a spectator: `mySeat` is held by another player. */
  isViewerSeated?: boolean;
  isAudioPlaying?: boolean;
  nightmareBlockedSeat?: number | null;
  /** Arms the nightmare wolf-kill override (the engine hint restricts wolves to an empty vote). */
  wolfKillDisabled?: boolean;
  currentNightResults?: GameState['currentNightResults'];
  witchContext?: GameState['witchContext'] | null;
  actionRejected?: {
    action: string;
    reason: string;
    targetSeat: number;
    rejectionId?: string;
  } | null;
  seerReveal?: GameState['seerReveal'] | null;
  psychicReveal?: GameState['psychicReveal'] | null;
  gargoyleReveal?: GameState['gargoyleReveal'] | null;
  /** The learned role; target seat and result text are filled in. */
  wolfRobotReveal?: { learnedRoleId: RoleId; canShootAsHunter?: boolean } | null;
  wolfRobotHunterStatusViewed?: boolean;
  /** Raw state fields merged last (witchContext, confirmStatus, status, …). */
  gameStateOverrides?: Partial<GameState>;
  hookOverrides?: {
    /** Handles every `werewolf.action.submit`; defaults to a success carrying the step's reveal. */
    submitAction?: SubmitActionMock;
    /** Room status when not Ongoing (Day / Ended perspectives). */
    roomStatus?: GameStatus;
  };
}

export interface WerewolfRoomMock {
  readonly options: WerewolfRoomMockOptions;
  readonly state: GameState;
  readonly session: FakeRoomLink<GameState, WerewolfPublicCommand>;
  readonly audio: WerewolfAudioRuntime;
  readonly submitAction: SubmitActionMock;
  /** Every command the screen dispatched (same mock as `session.dispatch`). */
  readonly dispatch: FakeRoomLink<GameState, WerewolfPublicCommand>['dispatch'];
}

function createAudioStub(): WerewolfAudioRuntime {
  return {
    playBeginning: jest.fn(async () => undefined),
    playEnding: jest.fn(async () => undefined),
    playNight: jest.fn(async () => undefined),
    playNightEnd: jest.fn(async () => undefined),
    preloadRoles: jest.fn(async () => undefined),
    stopNarration: jest.fn(),
    stopBgm: jest.fn(),
    clearPreloaded: jest.fn(),
  };
}

function resolveBoardRoles(options: WerewolfRoomMockOptions): RoleId[] {
  const { currentActionRole, myRole, mySeat = 0, numberOfPlayers = 12, roleAssignments } = options;
  const roles: RoleId[] = Array.from({ length: numberOfPlayers }, (_, seat) =>
    seat === mySeat ? myRole : (roleAssignments?.get(seat) ?? 'villager'),
  );
  if (!roles.includes(currentActionRole)) {
    const slot = roles.findIndex((role, seat) => seat !== mySeat && role === 'villager');
    if (slot < 0) {
      throw new Error(`[TEST] No villager seat left to host the acting role ${currentActionRole}`);
    }
    roles[slot] = currentActionRole;
  }
  return roles;
}

/**
 * The engine sets `confirmStatus` whenever a confirm step is entered with
 * its role on the board; fixtures default it the same way.
 */
function defaultConfirmStatus(role: RoleId): NonNullable<GameState['confirmStatus']> {
  if (role === 'avenger') return { role: 'avenger', faction: Team.Good };
  if (role === 'hiddenWolf') return { role: 'hiddenWolf', wolfTeammates: [1, 2, 3] };
  if (role === 'seedWolf') return { role: 'seedWolf', availability: 'available', targetSeat: 5 };
  if (role === 'hunter' || role === 'darkWolfKing') return { role, canShoot: true };
  throw new Error(`[TEST] ${role} has no confirm status`);
}

/** The authoritative state for one night-step situation. */
function buildWerewolfRoomMockState(options: WerewolfRoomMockOptions): GameState {
  const {
    schemaId,
    mySeat = 0,
    isHost = false,
    isViewerSeated = true,
    isAudioPlaying = false,
    nightmareBlockedSeat = null,
    wolfKillDisabled = false,
    currentNightResults = {},
    witchContext = null,
    actionRejected = null,
    seerReveal = null,
    psychicReveal = null,
    gargoyleReveal = null,
    wolfRobotReveal = null,
    wolfRobotHunterStatusViewed,
    gameStateOverrides = {},
    hookOverrides = {},
  } = options;
  const roles = resolveBoardRoles(options);
  const players: GameState['players'] = {};
  const roster: Record<number, GameState['roster'][number]> = {};
  roles.forEach((role, seat) => {
    players[seat] = { seat, role };
    roster[seat] = {
      seat,
      userId: seat === mySeat && isViewerSeated ? TEST_USER_ID : `p${seat}`,
      profile: { displayName: `P${seat + 1}` },
    };
  });
  const learnedSeat = roles.findIndex((_, seat) => seat !== mySeat);
  const schema = getSchema(schemaId);
  const confirmStatus =
    schema.kind === 'confirm' && gameStateOverrides.confirmStatus === undefined
      ? { confirmStatus: defaultConfirmStatus(options.currentActionRole) }
      : {};
  const status = gameStateOverrides.status ?? hookOverrides.roomStatus ?? GameStatus.Ongoing;
  const base = buildWerewolfTestState({
    roomCode: mockRoom.roomCode,
    hostUserId: isHost ? TEST_USER_ID : OTHER_HOST_USER_ID,
    status,
    templateRoles: roles,
    players,
    roster,
    roleViewedSeats: roles.map((_, seat) => seat),
    // The engine clears the step when the night ends; only Ongoing carries one.
    nightStep: status === GameStatus.Ongoing ? { kind: 'inStep', stepId: schemaId } : null,
    isAudioPlaying,
    currentNightResults,
    ...(nightmareBlockedSeat === null ? {} : { nightmareBlockedSeat }),
    ...(wolfKillDisabled
      ? { wolfKillOverride: { source: 'nightmare', ui: WOLF_KILL_OVERRIDE_TEXTS.nightmare } }
      : {}),
    ...(witchContext === null ? {} : { witchContext }),
    ...(actionRejected === null
      ? {}
      : {
          actionRejected: {
            ...actionRejected,
            rejectionId:
              actionRejected.rejectionId ?? `${actionRejected.action}:${actionRejected.targetSeat}`,
          },
        }),
    ...(seerReveal === null ? {} : { seerReveal }),
    ...(psychicReveal === null ? {} : { psychicReveal }),
    ...(gargoyleReveal === null ? {} : { gargoyleReveal }),
    ...(wolfRobotReveal === null
      ? {}
      : {
          wolfRobotReveal: {
            targetSeat: learnedSeat,
            result: getRoleDisplayName(wolfRobotReveal.learnedRoleId),
            learnedRoleId: wolfRobotReveal.learnedRoleId,
            canShootAsHunter: wolfRobotReveal.canShootAsHunter,
          },
        }),
    ...(wolfRobotHunterStatusViewed === undefined ? {} : { wolfRobotHunterStatusViewed }),
    ...confirmStatus,
    ...gameStateOverrides,
  });
  if (base.status !== GameStatus.Ongoing) return base;
  // The engine sets the step's UI hint on transition; reproduce it for the armed step.
  const plan = buildNightPlan(base.templateRoles, base.seerLabelMap);
  const step = plan.steps.find((candidate) => candidate.stepId === schemaId);
  if (step === undefined) {
    throw new Error(`[TEST] Step ${schemaId} is not in the night plan for ${roles.join(',')}`);
  }
  const hint = maybeCreateUiHintAction(step, base).payload.currentActorHint;
  return hint === null ? base : { ...base, ui: { currentActorHint: hint } };
}

function createRoomMockForState(
  options: WerewolfRoomMockOptions,
  state: GameState,
  submitAction: SubmitActionMock,
): WerewolfRoomMock {
  const session = createFakeRoomLink<GameState, WerewolfPublicCommand>(
    readyLinkSnapshot(
      { room: { ...mockRoom, hostUserId: state.hostUserId }, userId: TEST_USER_ID },
      createRoomSnapshot(state, 1),
    ),
    async (command) =>
      command.type === 'werewolf.action.submit'
        ? submitAction(command.input)
        : successfulWerewolfCommand(),
  );
  return {
    options,
    state,
    session,
    audio: createAudioStub(),
    submitAction,
    dispatch: session.dispatch,
  };
}

export function createWerewolfRoomMock(options: WerewolfRoomMockOptions): WerewolfRoomMock {
  const state = buildWerewolfRoomMockState(options);
  const submitAction: SubmitActionMock =
    options.hookOverrides?.submitAction ??
    jest.fn(async (input: WerewolfActionInput) =>
      successfulWerewolfActionCommand(options.schemaId, input),
    );
  return createRoomMockForState(options, state, submitAction);
}

/**
 * A room mock over an engine-produced state (vertical slices): the viewer
 * seat's occupant becomes the test auth user so the screen renders as them.
 */
export function createWerewolfRoomMockFromState(
  state: GameState,
  viewerSeat: number,
): WerewolfRoomMock {
  const occupant = state.roster[viewerSeat];
  if (occupant == null || isBotOccupant(occupant)) {
    throw new Error(`[TEST] Viewer seat ${viewerSeat} must hold a human occupant`);
  }
  const viewerState: GameState = {
    ...state,
    hostUserId: state.hostUserId === occupant.userId ? TEST_USER_ID : state.hostUserId,
    roster: { ...state.roster, [viewerSeat]: { ...occupant, userId: TEST_USER_ID } },
  };
  const stepId = state.nightStep?.kind === 'inStep' ? state.nightStep.stepId : null;
  if (stepId === null) throw new Error('[TEST] Vertical slice state must be inside a night step');
  const role = state.players[viewerSeat]?.role;
  if (role === undefined || role === null) {
    throw new Error(`[TEST] Viewer seat ${viewerSeat} has no role`);
  }
  const submitAction: SubmitActionMock = jest.fn(async (input: WerewolfActionInput) =>
    successfulWerewolfActionCommand(stepId, input),
  );
  return createRoomMockForState(
    { schemaId: stepId, currentActionRole: role, myRole: role, mySeat: viewerSeat },
    viewerState,
    submitAction,
  );
}

/**
 * A room mock whose authoritative state can be replaced mid-test; the
 * fake link notifies the mounted screen like a production broadcast.
 */
export function createReactiveWerewolfRoomMock(initialOptions: WerewolfRoomMockOptions) {
  let currentOptions = { ...initialOptions };
  let revision = 1;
  const mock = createWerewolfRoomMock(currentOptions);
  const push = (): void => {
    revision += 1;
    mock.session.publishRoom(
      createRoomSnapshot(buildWerewolfRoomMockState(currentOptions), revision),
    );
  };
  return {
    mock,
    /** Host rejected an action: the rejection lands in state for the acting seat. */
    simulateHostReject(rejection: NonNullable<WerewolfRoomMockOptions['actionRejected']>) {
      currentOptions = { ...currentOptions, actionRejected: rejection };
      push();
    },
    simulateStateUpdate(overrides: Partial<WerewolfRoomMockOptions>) {
      currentOptions = { ...currentOptions, ...overrides };
      push();
    },
  };
}

// =============================================================================
// Common Test Actions
// =============================================================================

export async function waitForRoomScreen(getByTestId: (id: string) => ReactTestInstance) {
  await waitFor(() => {
    expect(getByTestId(TESTIDS.roomScreenRoot)).toBeTruthy();
  });
}

export function tapSeat(getByTestId: (id: string) => ReactTestInstance, seat: number) {
  fireEvent.press(getByTestId(TESTIDS.seatTilePressable(seat)));
}

// =============================================================================
// Chain Interaction Drivers
// =============================================================================
//
// render → trigger dialog → press button → assert the command was dispatched.

type MockSetter = (mock: WerewolfRoomMock) => void;
type RenderFn = () => ReturnType<typeof import('@testing-library/react-native').render>;

function requireBottomActionText(schemaId: SchemaId, chain: string): string {
  const text = getSchema(schemaId).ui?.bottomActionText;
  if (text === undefined) {
    throw new Error(`[TEST] Missing schema.ui.bottomActionText for ${chain} chain: ${schemaId}`);
  }
  return text;
}

/** wolfVote confirm → `werewolf.action.submit { target }`. */
export async function chainWolfVoteConfirm(
  harness: RoomScreenTestHarness,
  mockSetter: MockSetter,
  renderFn: RenderFn,
  wolfRole: RoleId,
  wolfSeat: number,
  wolfAssignments: Map<number, RoleId>,
  targetSeat: number,
): Promise<SubmitActionMock> {
  const mock = createWerewolfRoomMock({
    schemaId: 'wolfKill',
    currentActionRole: 'wolf',
    myRole: wolfRole,
    mySeat: wolfSeat,
    roleAssignments: wolfAssignments,
  });
  mockSetter(mock);
  const result = renderFn();
  await waitForRoomScreen(result.getByTestId);
  harness.clear();

  tapSeat(result.getByTestId, targetSeat);
  await waitFor(() => expect(harness.hasSeen('wolfVote')).toBe(true));
  harness.pressButtonOnType('wolfVote', '确定');
  expect(mock.submitAction).toHaveBeenCalledTimes(1);
  expect(mock.submitAction).toHaveBeenCalledWith({ kind: 'target', target: targetSeat });

  result.unmount();
  return mock.submitAction;
}

/** Bottom skip → skipConfirm → `werewolf.action.submit { skip }`. */
export async function chainSkipConfirm(
  harness: RoomScreenTestHarness,
  mockSetter: MockSetter,
  renderFn: RenderFn,
  schemaId: SchemaId,
  actionRole: RoleId,
  playerRole: RoleId,
  seat: number,
): Promise<SubmitActionMock> {
  const mock = createWerewolfRoomMock({
    schemaId,
    currentActionRole: actionRole,
    myRole: playerRole,
    mySeat: seat,
  });
  mockSetter(mock);
  const result = renderFn();
  await waitForRoomScreen(result.getByTestId);
  harness.clear();

  fireEvent.press(result.getByText(requireBottomActionText(schemaId, 'skipConfirm')));
  await waitFor(() => expect(harness.hasSeen('skipConfirm')).toBe(true));
  harness.pressButtonOnType('skipConfirm', '确定');
  expect(mock.submitAction).toHaveBeenCalledTimes(1);

  result.unmount();
  return mock.submitAction;
}

/** Status button → confirmTrigger dialog → confirm. */
export async function chainConfirmTrigger(
  harness: RoomScreenTestHarness,
  mockSetter: MockSetter,
  renderFn: RenderFn,
  schemaId: SchemaId,
  actionRole: RoleId,
  playerRole: RoleId,
  seat: number,
): Promise<void> {
  mockSetter(
    createWerewolfRoomMock({
      schemaId,
      currentActionRole: actionRole,
      myRole: playerRole,
      mySeat: seat,
      gameStateOverrides: { confirmStatus: defaultConfirmStatus(actionRole) },
    }),
  );
  const result = renderFn();
  await waitForRoomScreen(result.getByTestId);
  harness.clear();

  const bottomActionText = requireBottomActionText(schemaId, 'confirmTrigger');
  await waitFor(() => expect(result.queryByText(bottomActionText)).toBeTruthy());
  fireEvent.press(result.getByText(bottomActionText));
  await waitFor(() => expect(harness.hasSeen('confirmTrigger')).toBe(true));
  harness.pressPrimaryOnType('confirmTrigger');

  result.unmount();
}

/** Wolf robot learned hunter → gate button → status dialog → `wolfRobot.ackHunterStatus`. */
export async function chainWolfRobotHunterStatus(
  harness: RoomScreenTestHarness,
  mockSetter: MockSetter,
  renderFn: RenderFn,
  seat: number,
): Promise<WerewolfRoomMock['dispatch']> {
  const mock = createWerewolfRoomMock({
    schemaId: 'wolfRobotLearn',
    currentActionRole: 'wolfRobot',
    myRole: 'wolfRobot',
    mySeat: seat,
    wolfRobotReveal: { learnedRoleId: 'hunter', canShootAsHunter: true },
    wolfRobotHunterStatusViewed: false,
  });
  mockSetter(mock);
  const result = renderFn();
  await waitForRoomScreen(result.getByTestId);
  harness.clear();

  const gateButtonText = SCHEMAS.wolfRobotLearn.ui?.hunterGateButtonText;
  if (gateButtonText === undefined) {
    throw new Error('[TEST] Missing SCHEMAS.wolfRobotLearn.ui.hunterGateButtonText');
  }
  fireEvent.press(result.getByText(gateButtonText));
  await waitFor(() => expect(harness.hasSeen('wolfRobotHunterStatus')).toBe(true));
  harness.pressPrimaryOnType('wolfRobotHunterStatus');
  await waitFor(() =>
    expect(mock.dispatch).toHaveBeenCalledWith(
      { type: 'werewolf.wolfRobot.ackHunterStatus' },
      expect.anything(),
    ),
  );

  result.unmount();
  return mock.dispatch;
}

// Coverage-integrated drivers: the harness keeps the recorded dialogs for assertCoverage.

export async function coverageChainWolfVote(
  harness: RoomScreenTestHarness,
  mockSetter: MockSetter,
  renderFn: RenderFn,
  wolfRole: RoleId,
  wolfSeat: number,
  wolfAssignments: Map<number, RoleId>,
  targetSeat: number,
): Promise<{ submitAction: SubmitActionMock }> {
  const mock = createWerewolfRoomMock({
    schemaId: 'wolfKill',
    currentActionRole: 'wolf',
    myRole: wolfRole,
    mySeat: wolfSeat,
    roleAssignments: wolfAssignments,
  });
  mockSetter(mock);
  const result = renderFn();
  await waitForRoomScreen(result.getByTestId);

  tapSeat(result.getByTestId, targetSeat);
  await waitFor(() => expect(harness.hasSeen('wolfVote')).toBe(true));
  harness.pressPrimaryOnType('wolfVote');
  expect(mock.submitAction).toHaveBeenCalledTimes(1);
  expect(mock.submitAction).toHaveBeenCalledWith({ kind: 'target', target: targetSeat });

  result.unmount();
  return { submitAction: mock.submitAction };
}

export async function coverageChainSkipConfirm(
  harness: RoomScreenTestHarness,
  mockSetter: MockSetter,
  renderFn: RenderFn,
  schemaId: SchemaId,
  actionRole: RoleId,
  playerRole: RoleId,
  seat: number,
): Promise<{ submitAction: SubmitActionMock }> {
  const mock = createWerewolfRoomMock({
    schemaId,
    currentActionRole: actionRole,
    myRole: playerRole,
    mySeat: seat,
  });
  mockSetter(mock);
  const result = renderFn();
  await waitForRoomScreen(result.getByTestId);

  fireEvent.press(result.getByText(requireBottomActionText(schemaId, 'skipConfirm coverage')));
  await waitFor(() => expect(harness.hasSeen('skipConfirm')).toBe(true));
  harness.pressPrimaryOnType('skipConfirm');
  expect(mock.submitAction).toHaveBeenCalledTimes(1);
  expect(mock.submitAction).toHaveBeenCalledWith({ kind: 'skip' });

  result.unmount();
  return { submitAction: mock.submitAction };
}

export async function coverageChainConfirmTrigger(
  harness: RoomScreenTestHarness,
  mockSetter: MockSetter,
  renderFn: RenderFn,
  schemaId: SchemaId,
  actionRole: RoleId,
  playerRole: RoleId,
  seat: number,
): Promise<void> {
  mockSetter(
    createWerewolfRoomMock({
      schemaId,
      currentActionRole: actionRole,
      myRole: playerRole,
      mySeat: seat,
      gameStateOverrides: { confirmStatus: defaultConfirmStatus(actionRole) },
    }),
  );
  const result = renderFn();
  await waitForRoomScreen(result.getByTestId);

  const bottomActionText = requireBottomActionText(schemaId, 'confirmTrigger coverage');
  await waitFor(() => expect(harness.hasSeen('actionPrompt')).toBe(true));
  fireEvent.press(result.getByText(bottomActionText));
  await waitFor(() => expect(harness.hasSeen('confirmTrigger')).toBe(true));
  harness.pressPrimaryOnType('confirmTrigger');
  harness.assertNoLoop({ type: 'confirmTrigger', maxTimesPerStep: 3 });

  result.unmount();
}

export async function coverageChainWolfRobotHunterStatus(
  harness: RoomScreenTestHarness,
  mockSetter: MockSetter,
  renderFn: RenderFn,
  seat: number,
): Promise<{ dispatch: WerewolfRoomMock['dispatch'] }> {
  const mock = createWerewolfRoomMock({
    schemaId: 'wolfRobotLearn',
    currentActionRole: 'wolfRobot',
    myRole: 'wolfRobot',
    mySeat: seat,
    wolfRobotReveal: { learnedRoleId: 'hunter', canShootAsHunter: true },
    wolfRobotHunterStatusViewed: false,
  });
  mockSetter(mock);
  const result = renderFn();
  await waitForRoomScreen(result.getByTestId);

  const gateButtonText = SCHEMAS.wolfRobotLearn.ui?.hunterGateButtonText;
  if (gateButtonText === undefined) {
    throw new Error('[TEST] Missing SCHEMAS.wolfRobotLearn.ui.hunterGateButtonText');
  }
  fireEvent.press(result.getByText(gateButtonText));
  await waitFor(() => expect(harness.hasSeen('wolfRobotHunterStatus')).toBe(true));
  harness.pressPrimaryOnType('wolfRobotHunterStatus');
  await waitFor(() =>
    expect(mock.dispatch).toHaveBeenCalledWith(
      { type: 'werewolf.wolfRobot.ackHunterStatus' },
      expect.anything(),
    ),
  );
  harness.assertNoLoop({ type: 'wolfRobotHunterStatus', maxTimesPerStep: 3 });

  result.unmount();
  return { dispatch: mock.dispatch };
}

export async function coverageChainActionPrompt(
  harness: RoomScreenTestHarness,
  mockSetter: MockSetter,
  renderFn: RenderFn,
  schemaId: SchemaId,
  actionRole: RoleId,
  playerRole: RoleId,
  seat: number,
): Promise<void> {
  mockSetter(
    createWerewolfRoomMock({
      schemaId,
      currentActionRole: actionRole,
      myRole: playerRole,
      mySeat: seat,
    }),
  );
  const result = renderFn();
  await waitForRoomScreen(result.getByTestId);
  await waitFor(() => expect(harness.hasSeen('actionPrompt')).toBe(true));
  result.unmount();
}

export async function coverageChainWitchSavePrompt(
  harness: RoomScreenTestHarness,
  mockSetter: MockSetter,
  renderFn: RenderFn,
  seat: number,
): Promise<void> {
  mockSetter(
    createWerewolfRoomMock({
      schemaId: 'witchAction',
      currentActionRole: 'witch',
      myRole: 'witch',
      mySeat: seat,
      witchContext: { killedSeat: seat === 1 ? 0 : 1, canSave: true, canPoison: true },
    }),
  );
  const result = renderFn();
  await waitForRoomScreen(result.getByTestId);
  await waitFor(() => expect(harness.hasSeen('witchSavePrompt')).toBe(true));
  result.unmount();
}

export async function coverageChainWitchPoisonPrompt(
  harness: RoomScreenTestHarness,
  mockSetter: MockSetter,
  renderFn: RenderFn,
  seat: number,
): Promise<void> {
  mockSetter(
    createWerewolfRoomMock({
      schemaId: 'witchAction',
      currentActionRole: 'witch',
      myRole: 'witch',
      mySeat: seat,
      witchContext: { killedSeat: -1, canSave: false, canPoison: true },
    }),
  );
  const result = renderFn();
  await waitForRoomScreen(result.getByTestId);

  tapSeat(result.getByTestId, 1);
  await waitFor(() =>
    expect(harness.hasSeen('witchPoisonPrompt') || harness.hasSeen('actionConfirm')).toBe(true),
  );
  result.unmount();
}

export async function coverageChainMagicianSwap(
  harness: RoomScreenTestHarness,
  mockSetter: MockSetter,
  renderFn: RenderFn,
  seat: number,
  firstTarget: number,
  secondTarget: number,
): Promise<{ submitAction: SubmitActionMock }> {
  const mock = createWerewolfRoomMock({
    schemaId: 'magicianSwap',
    currentActionRole: 'magician',
    myRole: 'magician',
    mySeat: seat,
  });
  mockSetter(mock);
  const result = renderFn();
  await waitForRoomScreen(result.getByTestId);

  tapSeat(result.getByTestId, firstTarget);
  await waitFor(() => expect(harness.hasSeen('magicianFirst')).toBe(true));
  harness.pressPrimaryOnType('magicianFirst');

  tapSeat(result.getByTestId, secondTarget);
  await waitFor(() => expect(harness.hasSeen('actionConfirm')).toBe(true));
  harness.pressButtonOnType('actionConfirm', '确定');
  expect(mock.submitAction).toHaveBeenCalledTimes(1);

  result.unmount();
  return { submitAction: mock.submitAction };
}

/** The blocked actor taps a seat, the server rejects, the rejection alert shows once. */
export async function coverageChainNightmareBlocked(
  harness: RoomScreenTestHarness,
  mockSetter: MockSetter,
  renderFn: RenderFn,
  blockedSchemaId: SchemaId,
  blockedRole: RoleId,
  blockedSeat: number,
  blockedMessage: string,
): Promise<{ rejectedEvents: import('./RoomScreenTestHarness').DialogEvent[] }> {
  const reactive = createReactiveWerewolfRoomMock({
    schemaId: blockedSchemaId,
    currentActionRole: blockedRole,
    myRole: blockedRole,
    mySeat: blockedSeat,
    nightmareBlockedSeat: blockedSeat,
    currentNightResults: { blockedSeat },
  });
  mockSetter(reactive.mock);
  const result = renderFn();
  await waitForRoomScreen(result.getByTestId);

  tapSeat(result.getByTestId, 1);
  reactive.simulateHostReject({
    action: blockedSchemaId,
    reason: blockedMessage,
    targetSeat: blockedSeat,
    rejectionId: 'nightmare-block-coverage',
  });

  await waitFor(() => expect(harness.hasSeen('actionRejected')).toBe(true));
  harness.assertNoLoop({ type: 'actionRejected', maxTimesPerStep: 3 });

  const rejectedEvents = harness.eventsOfType('actionRejected');
  result.unmount();
  return { rejectedEvents };
}

export async function coverageChainSeatActionConfirm(
  harness: RoomScreenTestHarness,
  mockSetter: MockSetter,
  renderFn: RenderFn,
  schemaId: SchemaId,
  actionRole: RoleId,
  playerRole: RoleId,
  seat: number,
  targetSeat: number,
): Promise<{ submitAction: SubmitActionMock }> {
  const mock = createWerewolfRoomMock({
    schemaId,
    currentActionRole: actionRole,
    myRole: playerRole,
    mySeat: seat,
  });
  mockSetter(mock);
  const result = renderFn();
  await waitForRoomScreen(result.getByTestId);

  tapSeat(result.getByTestId, targetSeat);
  await waitFor(() => expect(harness.hasSeen('actionConfirm')).toBe(true));
  harness.pressPrimaryOnType('actionConfirm');
  expect(mock.submitAction).toHaveBeenCalledTimes(1);

  result.unmount();
  return { submitAction: mock.submitAction };
}

export async function coverageChainWolfVoteEmpty(
  harness: RoomScreenTestHarness,
  mockSetter: MockSetter,
  renderFn: RenderFn,
  wolfRole: RoleId,
  wolfSeat: number,
  wolfAssignments: Map<number, RoleId>,
): Promise<{ submitAction: SubmitActionMock }> {
  const mock = createWerewolfRoomMock({
    schemaId: 'wolfKill',
    currentActionRole: 'wolf',
    myRole: wolfRole,
    mySeat: wolfSeat,
    roleAssignments: wolfAssignments,
  });
  mockSetter(mock);
  const result = renderFn();
  await waitForRoomScreen(result.getByTestId);

  const emptyVoteText = SCHEMAS.wolfKill.ui?.emptyVoteText;
  if (emptyVoteText === undefined)
    throw new Error('[TEST] Missing SCHEMAS.wolfKill.ui.emptyVoteText');
  fireEvent.press(result.getByText(emptyVoteText));
  await waitFor(() => expect(harness.hasSeen('wolfVoteEmpty')).toBe(true));
  harness.pressPrimaryOnType('wolfVoteEmpty');
  expect(mock.submitAction).toHaveBeenCalledTimes(1);
  expect(mock.submitAction).toHaveBeenCalledWith({ kind: 'target', target: null });

  result.unmount();
  return { submitAction: mock.submitAction };
}

/** Magician: first pick dialog → second pick → actionConfirm → `multiTarget`. */
export async function chainActionConfirm(
  harness: RoomScreenTestHarness,
  mockSetter: MockSetter,
  renderFn: RenderFn,
  seat: number,
  firstTarget: number,
  secondTarget: number,
): Promise<SubmitActionMock> {
  const { submitAction } = await coverageChainMagicianSwap(
    harness,
    mockSetter,
    renderFn,
    seat,
    firstTarget,
    secondTarget,
  );
  return submitAction;
}
