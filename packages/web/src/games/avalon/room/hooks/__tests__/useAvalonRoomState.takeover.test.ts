/**
 * Takeover dispatch discipline (werewolf/undercover parity): while the
 * host controls a bot seat, host commands dispatch uncontrolled — the
 * platform host gate (resolveHostActorId) rejects controlled actors —
 * while seat actions dispatch with the controlled seat. In-game seat
 * taps that no pick handler consumes are silent no-ops (werewolf
 * SeatTapPolicy NOOP), never the seat-locked alert.
 */
import {
  avalonEngine,
  type AvalonPublicCommand,
  type AvalonState,
  DEFAULT_AVALON_CONFIG,
  getAvalonNightParticipants,
  isBotSeat,
} from '@game-judge/game-engine/games/avalon/public';
import { createRoomSnapshot } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router';

import type { RoomHostManagementModel } from '@/features/room/model/RoomHostManagement';
import { avalonReview } from '@/games/avalon/review/avalonReview';
import { avalonViewNightCommand } from '@/test-utils/avalonState';
import { createFakeBgm } from '@/test-utils/fakeBgm';
import { createFakeRoomLink, readyLinkSnapshot, testIdentity } from '@/test-utils/linkSnapshot';
import { successfulRoomCommand } from '@/test-utils/roomCommand';
import { TESTIDS } from '@/testids';
import { alertStore, dismissAlert } from '@/utils/alert';
import { showErrorAlert } from '@/utils/alertPresets';

import { useAvalonRoomState } from '../useAvalonRoomState';

vi.mock('@/contexts/AuthContext', () => ({
  useAuthContext: () => ({
    user: { id: 'host', avatarUrl: null, equippedEffect: null },
  }),
}));

vi.mock('@/features/gacha/queries/useGachaQuery', () => ({
  useGachaStatusQuery: () => ({ data: undefined }),
}));

vi.mock('@/utils/alertPresets', async () => {
  const actual =
    await vi.importActual<typeof import('@/utils/alertPresets')>('@/utils/alertPresets');
  return { ...actual, showErrorAlert: vi.fn() };
});

type CommandContext = Parameters<typeof avalonEngine.decide>[2];

/** Real engine state: host + two humans seated, bots fill seats 3/4, game started. */
function viewingStateWithBots(): AvalonState {
  let commandNumber = 0;
  let state = avalonEngine.createInitialState(
    { ...DEFAULT_AVALON_CONFIG, numberOfPlayers: 5 },
    { roomCode: '1234', hostUserId: 'host', nowMs: 1000, commandId: 'create' },
  );
  const send = (command: AvalonPublicCommand, userId = 'host') => {
    const context: CommandContext = {
      actor: { kind: 'user', userId },
      controlledSeat: null,
      nowMs: 1000,
      commandId: `command:${commandNumber++}`,
      randomSeed: `seed:${commandNumber}`,
    };
    const decision = avalonEngine.decide(state, command, context);
    if (decision.kind === 'reject') throw new Error(`rejected: ${decision.reason}`);
    state = decision.events.reduce(avalonEngine.evolve, state);
  };
  for (let seat = 0; seat < 3; seat += 1) {
    send(
      { type: 'room.seat.take', seat, profile: { displayName: `P${seat}` } },
      seat === 0 ? 'host' : `u${seat}`,
    );
  }
  send({ type: 'room.seat.fillBots' });
  send({ type: 'avalon.roles.assign' });
  return state;
}

/**
 * Real engine walk into nominate with the host at seat 0 and bots on
 * seats 1-4. Roles and the first leader are drawn from entropy (the
 * command seeds do not fix them), so the fixture re-draws until a bot
 * leads; every assertion keys off state.leaderSeat, never a fixed
 * seat. Bot night confirms go through the host with the bot seat as
 * the controlled seat, as in production.
 */
function nominateStateWithBotLeader(): AvalonState {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const state = buildNominateWithBots();
    if (isBotSeat(state.roster, state.leaderSeat)) return state;
  }
  throw new Error('no bot-led nominate state in 25 draws');
}

function buildNominateWithBots(): AvalonState {
  let commandNumber = 0;
  let state = avalonEngine.createInitialState(
    { ...DEFAULT_AVALON_CONFIG, numberOfPlayers: 5 },
    { roomCode: '1234', hostUserId: 'host', nowMs: 1000, commandId: 'create' },
  );
  const send = (
    command: AvalonPublicCommand,
    userId = 'host',
    controlledSeat: number | null = null,
  ) => {
    const context: CommandContext = {
      actor: { kind: 'user', userId },
      controlledSeat,
      nowMs: 1000,
      commandId: `command:${commandNumber++}`,
      randomSeed: `seed:${commandNumber}`,
    };
    const decision = avalonEngine.decide(state, command, context);
    if (decision.kind === 'reject') throw new Error(`rejected: ${decision.reason}`);
    state = decision.events.reduce(avalonEngine.evolve, state);
  };
  send({ type: 'room.seat.take', seat: 0, profile: { displayName: 'P0' } });
  send({ type: 'room.seat.fillBots' });
  send({ type: 'avalon.roles.assign' });
  send({ type: 'avalon.role.viewed' });
  send({ type: 'avalon.bots.markAllBotsViewed' });
  send({ type: 'avalon.game.begin' });
  if (state.isAudioPlaying) send({ type: 'avalon.audio.ack', audioBatchId: state.audioBatchId });
  while (state.phase.kind === 'night') {
    const participants = getAvalonNightParticipants(state.roles, state.phase.steps.current!.stepId);
    for (const seat of participants) {
      if (isBotSeat(state.roster, seat)) send(avalonViewNightCommand(state), 'host', seat);
      else send(avalonViewNightCommand(state));
    }
    if (state.isAudioPlaying) send({ type: 'avalon.audio.ack', audioBatchId: state.audioBatchId });
  }
  if (state.phase.kind !== 'nominate') throw new Error('expected nominate phase');
  return state;
}

function createFakeSession(state: AvalonState) {
  const session = createFakeRoomLink<AvalonState, AvalonPublicCommand>(
    readyLinkSnapshot(testIdentity('avalon'), createRoomSnapshot(state, 1)),
    async () => successfulRoomCommand(state),
  );
  return { session, dispatch: session.dispatch };
}

function renderRoomState(state: AvalonState) {
  const fake = createFakeSession(state);
  const props = {
    session: fake.session,
    review: avalonReview,
    room: { roomCode: '1234', roomId: 'room-1234' },
    navigation: { navigate: vi.fn() },
    entryController: {
      requestExit: vi.fn(),
      connection: {
        status: { kind: 'live' },
        pendingDurableCount: 0,
        onRetryNow: vi.fn(),
      },
    },
    audio: {
      preload: vi.fn(async () => undefined),
      playEffect: vi.fn(async () => undefined),
      stopNarration: vi.fn(),
      ...createFakeBgm(),
      setBgmVolume: vi.fn(),
      setGameAudioVolume: vi.fn(),
    },
  } as unknown as Parameters<typeof useAvalonRoomState>[0];
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const rendered = renderHook(() => useAvalonRoomState(props), {
    wrapper: ({ children }: { readonly children: ReactNode }) =>
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(MemoryRouter, null, children),
      ),
  });
  return { ...rendered, dispatch: fake.dispatch };
}

function findHostAction(model: RoomHostManagementModel | null, label: string) {
  const action = model?.actions.find((candidate) => candidate.label === label);
  if (action === undefined) throw new Error(`host action not found: ${label}`);
  if (action.state.kind !== 'ready') throw new Error(`host action is disabled: ${label}`);
  return action;
}

describe('useAvalonRoomState takeover dispatch discipline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('dispatches host commands uncontrolled and seat actions controlled while taking over', async () => {
    const { result, dispatch } = renderRoomState(viewingStateWithBots());
    expect(result.current.controlledSeat).toBeNull();

    // Long-press bot seat 3 to take it over.
    act(() => {
      result.current.shellModel.seats.onBotSeatLongPress?.(3);
    });
    expect(result.current.controlledSeat).toBe(3);

    // Host scaffold action: must reach the engine without the controlled
    // seat, or the platform host gate rejects it as "not the host".
    const markAction = findHostAction(result.current.shellModel.hostManagement, '标记机器人已查看');
    if (markAction.state.kind !== 'ready') throw new Error('expected ready host action');
    const markBots = markAction.state.onPress;
    await act(async () => {
      markBots();
      expect(dispatch).not.toHaveBeenCalled();
      const confirmation = alertStore.getSnapshot();
      if (confirmation === null) throw new Error('expected bot confirmation');
      await confirmation.buttons.find((button) => button.text === '确定')?.onPress?.();
      dismissAlert(confirmation.generation);
    });
    expect(dispatch).toHaveBeenCalledWith(
      { type: 'avalon.bots.markAllBotsViewed' },
      expect.objectContaining({ controlledSeat: null }),
    );

    // Seat action (view the controlled bot's role): must carry seat 3.
    dispatch.mockClear();
    const viewRole = result.current.shellModel.playerActions.actions.find(
      (action) => action.testID === TESTIDS.roomViewIdentityButton,
    );
    if (viewRole?.state.kind !== 'ready') throw new Error('view-role action missing or disabled');
    const openRole = viewRole.state.onPress;
    await act(async () => {
      openRole();
    });
    const confirmation = alertStore.getSnapshot();
    if (confirmation === null) throw new Error('expected role viewing confirmation');
    await act(async () => {
      await confirmation.buttons.find((button) => button.text === '查看')?.onPress?.();
      dismissAlert(confirmation.generation);
    });
    expect(dispatch).not.toHaveBeenCalled();
    await act(async () => {
      result.current.roleViewing.close();
    });
    expect(dispatch).toHaveBeenCalledWith(
      { type: 'avalon.role.viewed' },
      expect.objectContaining({ controlledSeat: 3 }),
    );
  });

  it('keeps in-game seat taps silent when no pick handler consumes them', () => {
    const { result, dispatch } = renderRoomState(viewingStateWithBots());
    act(() => {
      result.current.shellModel.seats.onSeatPress(1);
    });
    expect(showErrorAlert).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('alerts the seat reason for disabled in-game seats, matching werewolf policy', () => {
    const { result, dispatch } = renderRoomState(viewingStateWithBots());
    act(() => {
      result.current.shellModel.seats.onSeatPress(1, '游戏进行中不能入座');
    });
    expect(showErrorAlert).toHaveBeenCalledWith('不可选择', '游戏进行中不能入座');
    expect(dispatch).not.toHaveBeenCalled();
  });
});

describe('useAvalonRoomState takeover nomination modal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('dispatches the modal-confirmed preselect as the taken-over bot leader', async () => {
    const state = nominateStateWithBotLeader();
    const { result, dispatch } = renderRoomState(state);
    const leaderSeat = state.leaderSeat;
    const picked = 0;
    const team: readonly number[] = [leaderSeat, picked];

    // The host's own seat does not lead: no preselect button is
    // offered to a non-leader viewer at all.
    expect(
      result.current.shellModel.playerActions.actions.find(
        (action) => action.testID === 'avalon-nominate-preselect',
      ),
    ).toBeUndefined();

    // Take over the bot leader seat: the leader's screen now offers
    // the preselect button (the modal entry; the full-team gate lives
    // on the modal confirm).
    act(() => {
      result.current.shellModel.seats.onBotSeatLongPress?.(leaderSeat);
    });
    expect(result.current.controlledSeat).toBe(leaderSeat);
    // No preselect echo yet, so the stage main action is the preselect
    // button (the final button only appears after the preselect echo).
    const preselect = result.current.shellModel.playerActions.actions.find(
      (action) => action.testID === 'avalon-nominate-preselect',
    );
    if (preselect === undefined) throw new Error('preselect action not found under takeover');
    expect(preselect.state.kind).toBe('ready');
    if (preselect.state.kind !== 'ready')
      throw new Error('preselect action must be enabled under takeover');
    const openPreselect = preselect.state.onPress;

    // Modal confirm dispatches the preselect, team on the command,
    // under the controlled bot leader seat.
    act(() => {
      openPreselect();
    });
    expect(result.current.teamPickModal).toBe('preselect');
    await act(async () => {
      await result.current.confirmTeamPick(team);
    });
    expect(result.current.teamPickModal).toBeNull();
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(
      { type: 'avalon.team.preselect', seats: team },
      expect.objectContaining({ controlledSeat: leaderSeat, label: '预选队伍', durable: false }),
    );
  });
});
