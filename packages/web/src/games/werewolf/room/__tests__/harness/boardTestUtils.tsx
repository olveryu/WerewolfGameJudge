/**
 * Board UI test utilities: a real `GameState` behind a fake room link.
 *
 * The screen under test is the production `WerewolfRoomScreen` (entry boundary included)
 * mounted on `createFakeRoomLink` inside a memory router. General room fixtures
 * support setup and daytime tests; night tests use engine-produced state and
 * dispatch commands through the real engine.
 *
 * Test files mock the auth context with `testAuthContext` so the screen renders as
 * `TEST_USER_ID`.
 */

import type {
  GameState,
  RoleId,
  SchemaId,
  WerewolfPublicCommand,
} from '@game-judge/game-engine/games/werewolf/public';
import {
  GameStatus,
  isValidSchemaId,
  werewolfEngine,
} from '@game-judge/game-engine/games/werewolf/public';
import { createRoomSnapshot } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import { isBotOccupant } from '@game-judge/game-engine/platform/room/seating/roster';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderResult } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';

import type { RoomRecord } from '@/features/room/model/RoomDirectory';
import type { WerewolfAudioRuntime } from '@/games/werewolf/audio/WerewolfAudioPlayer';
import { werewolfReview } from '@/games/werewolf/review/werewolfReview';
import { WerewolfRoomScreen } from '@/games/werewolf/room/WerewolfRoomScreen';
import type { DispatchOutcome } from '@/platform/realtime/types';
import { createFakeBgm } from '@/test-utils/fakeBgm';
import {
  createFakeRoomLink,
  type FakeRoomLink,
  readyLinkSnapshot,
} from '@/test-utils/linkSnapshot';
import {
  domainRejectedRoomCommand,
  rejectedRoomCommand,
  successfulRoomCommand,
} from '@/test-utils/roomCommand';
import { buildWerewolfTestState } from '@/test-utils/werewolfState';
import { TESTIDS } from '@/testids';

import { playBoardNight } from './boardNightScenarios';
import { TEST_USER_ID } from './testAuthContext';

const OTHER_HOST_USER_ID = 'host-uid';

const mockRoom: RoomRecord<'werewolf'> = {
  roomCode: '1234',
  roomId: 'room-id-1234',
  gameType: 'werewolf',
  hostUserId: OTHER_HOST_USER_ID,
  createdAt: new Date(0),
};

export type WerewolfDispatchOutcome = DispatchOutcome<GameState>;

function successfulWerewolfCommand(
  stateOverrides: Partial<GameState> = {},
): WerewolfDispatchOutcome {
  return successfulRoomCommand(buildWerewolfTestState(stateOverrides));
}

// =============================================================================
// Room mock
// =============================================================================

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
  isHost?: boolean;
  /** False renders the test user as a spectator: `mySeat` is held by another player. */
  isViewerSeated?: boolean;
  isAudioPlaying?: boolean;
  /** Raw state fields merged last. */
  gameStateOverrides?: Partial<GameState>;
  hookOverrides?: {
    /** Handles commands (acks, host flow); defaults to a committed success. */
    dispatchCommand?: (command: WerewolfPublicCommand) => Promise<WerewolfDispatchOutcome>;
    /** Room status when not Ongoing (Day / Ended perspectives). */
    roomStatus?: GameStatus;
  };
}

export interface WerewolfRoomMock {
  readonly options: WerewolfRoomMockOptions;
  readonly state: GameState;
  /** The directory record the screen mounts with; matches the link identity. */
  readonly room: RoomRecord<'werewolf'>;
  readonly session: FakeRoomLink<GameState, WerewolfPublicCommand>;
  readonly audio: WerewolfAudioRuntime;
  /** Every command the screen dispatched (same mock as `session.dispatch`). */
  readonly dispatch: FakeRoomLink<GameState, WerewolfPublicCommand>['dispatch'];
}

/** Read the returned outcome of a specific command without treating thrown values as outcomes. */
export async function getDispatchOutcome(
  mock: WerewolfRoomMock,
  callIndex: number,
): Promise<WerewolfDispatchOutcome> {
  const result = mock.dispatch.mock.results[callIndex];
  if (result?.type !== 'return') {
    throw new Error(`[TEST] Dispatch call ${callIndex} did not return an outcome`);
  }
  return result.value;
}

function createAudioStub(): WerewolfAudioRuntime {
  return {
    playEffect: vi.fn(async () => undefined),
    preload: vi.fn(),
    stopNarration: vi.fn(),
    ...createFakeBgm(),
    setBgmVolume: vi.fn(),
    setGameAudioVolume: vi.fn(),
    clearPreloaded: vi.fn(),
  };
}

function resolveBoardRoles(options: WerewolfRoomMockOptions): RoleId[] {
  const { currentActionRole, myRole, mySeat = 0, numberOfPlayers = 12 } = options;
  const roles: RoleId[] = Array.from({ length: numberOfPlayers }, (_, seat) =>
    seat === mySeat ? myRole : 'villager',
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

/** The authoritative state for one night-step situation. */
function buildWerewolfRoomMockState(options: WerewolfRoomMockOptions): GameState {
  const {
    schemaId,
    mySeat = 0,
    isHost = false,
    isViewerSeated = true,
    isAudioPlaying = false,
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
  const status = gameStateOverrides.status ?? hookOverrides.roomStatus ?? GameStatus.Ongoing;
  const identity = {
    roomCode: mockRoom.roomCode,
    hostUserId: isHost ? TEST_USER_ID : OTHER_HOST_USER_ID,
    status,
    roster,
    isAudioPlaying,
  };
  if (status === GameStatus.Ongoing) {
    // A room inside the night is a real night parked on the requested step.
    return {
      ...playBoardNight(roles, { isQuiet: true, stopAtStepId: schemaId }),
      ...identity,
      ...gameStateOverrides,
    };
  }
  if (status === GameStatus.Day || status === GameStatus.Ended) {
    // After the night the room reads the settled night, so play a real, uneventful one.
    return {
      ...playBoardNight(roles, { isQuiet: true }),
      ...identity,
      ...gameStateOverrides,
    };
  }
  return buildWerewolfTestState({
    ...identity,
    templateRoles: roles,
    players,
    roleViewedSeats: roles.map((_, seat) => seat),
    ...gameStateOverrides,
  });
}

function createRoomMockForState(
  options: WerewolfRoomMockOptions,
  state: GameState,
): WerewolfRoomMock {
  const room: RoomRecord<'werewolf'> = {
    ...mockRoom,
    roomCode: state.roomCode,
    hostUserId: state.hostUserId,
  };
  const session = createFakeRoomLink<GameState, WerewolfPublicCommand>(
    readyLinkSnapshot({ room, userId: TEST_USER_ID }, createRoomSnapshot(state, 1)),
    async (command) => {
      return options.hookOverrides?.dispatchCommand?.(command) ?? successfulWerewolfCommand();
    },
  );
  return {
    options,
    state,
    room,
    session,
    audio: createAudioStub(),
    dispatch: session.dispatch,
  };
}

export function createWerewolfRoomMock(options: WerewolfRoomMockOptions): WerewolfRoomMock {
  const state = buildWerewolfRoomMockState(options);
  return createRoomMockForState(options, state);
}

/**
 * A room mock over an engine-produced state. Commands are decided and evolved
 * by the real engine before the fake link publishes the resulting snapshot.
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
  const stepId = state.nightState?.slice.current?.stepId;
  if (stepId === undefined || !isValidSchemaId(stepId)) {
    throw new Error('[TEST] Vertical slice state must be inside a night step');
  }
  const role = state.players[viewerSeat]?.role;
  if (role === undefined || role === null) {
    throw new Error(`[TEST] Viewer seat ${viewerSeat} has no role`);
  }
  let currentState = viewerState;
  let revision = 1;
  const dispatchCommand = async (
    command: WerewolfPublicCommand,
  ): Promise<WerewolfDispatchOutcome> => {
    const commandId = `board-ui-command-${revision}`;
    const decision = werewolfEngine.decide(currentState, command, {
      actor: { kind: 'user', userId: TEST_USER_ID },
      controlledSeat: null,
      commandId,
      nowMs: Date.now(),
      randomSeed: commandId,
    });
    if (decision.kind === 'reject') return rejectedRoomCommand(decision.reason, commandId);
    for (const event of decision.events) currentState = werewolfEngine.evolve(currentState, event);
    currentState = werewolfEngine.normalize(currentState);
    revision += 1;
    mock.session.publishRoom(createRoomSnapshot(currentState, revision));
    if (decision.outcome.kind === 'domainRejected') {
      return domainRejectedRoomCommand(currentState, decision.outcome.reason, commandId, revision);
    }
    return successfulRoomCommand(currentState, commandId, revision, decision.outcome.reason);
  };
  const mock = createRoomMockForState(
    {
      schemaId: stepId,
      currentActionRole: role,
      myRole: role,
      mySeat: viewerSeat,
      hookOverrides: { dispatchCommand },
    },
    viewerState,
  );
  return mock;
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
    simulateStateUpdate(overrides: Partial<WerewolfRoomMockOptions>) {
      currentOptions = { ...currentOptions, ...overrides };
      push();
    },
  };
}

// =============================================================================
// Rendering and common actions
// =============================================================================

/** Phone layout width (jsdom reports 0, which the room layout rejects). */
const PHONE_VIEWPORT_WIDTH = 390;

export interface RenderRoomOptions {
  /** Layout viewport width in CSS pixels; defaults to a phone. */
  readonly viewportWidth?: number;
}

/**
 * Mounts the production room screen on the mock's link inside a memory router. Every mount is
 * a fresh browser: Web Storage starts empty, so a night draft one scenario stored (the
 * magician's first pick) cannot leak into the next.
 */
function renderWerewolfRoom(
  mock: WerewolfRoomMock,
  { viewportWidth = PHONE_VIEWPORT_WIDTH }: RenderRoomOptions = {},
): RenderResult {
  window.localStorage.clear();
  Object.defineProperty(document.documentElement, 'clientWidth', {
    configurable: true,
    value: viewportWidth,
  });
  const router = createMemoryRouter(
    [
      {
        path: '/room/:roomCode',
        element: (
          <WerewolfRoomScreen
            room={mock.room}
            entryReason={null}
            onOpenMusicSettings={() => {}}
            onOpenRoomSettings={() => {}}
            onOpenUserSettings={() => {}}
            session={mock.session}
            review={werewolfReview}
            audio={mock.audio}
          />
        ),
      },
    ],
    { initialEntries: [`/room/${mock.room.roomCode}`] },
  );
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

async function waitForRoomScreen(view: RenderResult): Promise<void> {
  await view.findByTestId(TESTIDS.roomScreenRoot);
}

/** One user click (pointer down/up + click), without userEvent's inter-action timer. */
export async function click(element: Element): Promise<void> {
  await userEvent.setup({ delay: null }).click(element);
}

export async function openNightActionGroup(view: RenderResult): Promise<void> {
  const entry = view.queryByTestId(TESTIDS.werewolfNightButton('openActionGroup'));
  if (entry !== null) await click(entry);
}

export async function tapSeat(view: RenderResult, seat: number): Promise<void> {
  await click(view.getByTestId(TESTIDS.seatTilePressable(seat)));
}

/** Renders the room for `mock` and waits for the screen root. */
export async function mountWerewolfRoom(
  mock: WerewolfRoomMock,
  options?: RenderRoomOptions,
): Promise<RenderResult> {
  const view = renderWerewolfRoom(mock, options);
  await waitForRoomScreen(view);
  return view;
}

/** Renders the room for a fresh mock of `options` and waits for the screen root. */
export function mountRoomFor(options: WerewolfRoomMockOptions): Promise<RenderResult> {
  return mountWerewolfRoom(createWerewolfRoomMock(options));
}

// Step fixtures shared by the board files: the viewer is the step's actor.

/** The viewer holds `role` on `seat` and acts in `schemaId`. */
export function actorStep(schemaId: SchemaId, role: RoleId, seat: number): WerewolfRoomMockOptions {
  return { schemaId, currentActionRole: role, myRole: role, mySeat: seat };
}
