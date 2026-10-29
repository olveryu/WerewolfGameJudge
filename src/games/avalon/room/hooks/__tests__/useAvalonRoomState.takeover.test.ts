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
import { act, renderHook } from '@testing-library/react-native';

import type { RoomHostManagementModel } from '@/features/room/model/RoomHostManagement';
import { createFakeRoomLink, readyLinkSnapshot, testIdentity } from '@/test-utils/linkSnapshot';
import { successfulRoomCommand } from '@/test-utils/roomCommand';
import { showErrorAlert } from '@/utils/alertPresets';

import { useAvalonRoomState } from '../useAvalonRoomState';

jest.mock('@/contexts/AuthContext', () => ({
  useAuthContext: () => ({
    user: { id: 'host', avatarUrl: null, equippedEffect: null },
  }),
}));

jest.mock('@/features/gacha/queries/useGachaQuery', () => ({
  useGachaStatusQuery: () => ({ data: undefined }),
}));

jest.mock('@/utils/alertPresets', () => {
  const actual = jest.requireActual<typeof import('@/utils/alertPresets')>('@/utils/alertPresets');
  return { ...actual, showErrorAlert: jest.fn() };
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
    const participants = getAvalonNightParticipants(state.roles, state.phase.step);
    for (const seat of participants) {
      if (isBotSeat(state.roster, seat)) send({ type: 'avalon.night.confirm' }, 'host', seat);
      else send({ type: 'avalon.night.confirm' });
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
    room: { roomCode: '1234' },
    navigation: { navigate: jest.fn() },
    entryController: {
      requestExit: jest.fn(),
      connection: {
        status: { kind: 'live' },
        pendingDurableCount: 0,
        presence: new Set<string>(),
        onRetryNow: jest.fn(),
      },
    },
    audio: {
      preload: jest.fn(async () => undefined),
      playEffect: jest.fn(async () => undefined),
      stopNarration: jest.fn(),
      stopBgm: jest.fn(),
    },
  } as unknown as Parameters<typeof useAvalonRoomState>[0];
  const rendered = renderHook(() => useAvalonRoomState(props, { onReviewPress: jest.fn() }));
  return { ...rendered, dispatch: fake.dispatch };
}

function findHostAction(model: RoomHostManagementModel | null, label: string) {
  for (const section of model?.sections ?? []) {
    for (const action of section.actions) {
      if (action.label !== label) continue;
      if (!action.isEnabled) throw new Error(`host action is disabled: ${label}`);
      return action;
    }
  }
  throw new Error(`host action not found: ${label}`);
}

describe('useAvalonRoomState takeover dispatch discipline', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
    await act(async () => {
      markAction.onPress();
    });
    expect(dispatch).toHaveBeenCalledWith(
      { type: 'avalon.bots.markAllBotsViewed' },
      expect.objectContaining({ controlledSeat: null }),
    );

    // Seat action (view the controlled bot's role): must carry seat 3.
    dispatch.mockClear();
    const bottom = result.current.shellModel.bottomActions;
    if (bottom.kind !== 'stacked') throw new Error('expected stacked bottom actions in viewing');
    const viewRole = bottom.layout.primary.find((action) => action.testID === 'avalon-view-role');
    if (viewRole === undefined || !viewRole.isEnabled)
      throw new Error('view-role action missing or disabled');
    await act(async () => {
      viewRole.onPress();
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
    jest.clearAllMocks();
  });

  it('dispatches the modal-confirmed draft and preselect as the taken-over bot leader', async () => {
    const state = nominateStateWithBotLeader();
    const { result, dispatch } = renderRoomState(state);
    const leaderSeat = state.leaderSeat;
    const picked = 0;
    const team: readonly number[] = [leaderSeat, picked];

    // The host's own seat does not lead: no preselect button is
    // offered to a non-leader viewer at all.
    const bottomBefore = result.current.shellModel.bottomActions;
    if (bottomBefore.kind !== 'stacked')
      throw new Error('expected stacked bottom actions in nominate');
    expect(
      bottomBefore.layout.primary.find((action) => action.testID === 'avalon-nominate-preselect'),
    ).toBeUndefined();

    // Take over the bot leader seat: the leader's screen now offers
    // the preselect button (the modal entry, enabled even with an
    // empty server draft — the full gate lives on the modal confirm).
    act(() => {
      result.current.shellModel.seats.onBotSeatLongPress?.(leaderSeat);
    });
    expect(result.current.controlledSeat).toBe(leaderSeat);
    const bottom = result.current.shellModel.bottomActions;
    if (bottom.kind !== 'stacked') throw new Error('expected stacked bottom actions in nominate');
    // No preselect echo yet, so the stage main action is the preselect
    // button (the final button only appears after the preselect echo).
    const preselect = bottom.layout.primary.find(
      (action) => action.testID === 'avalon-nominate-preselect',
    );
    if (preselect === undefined) throw new Error('preselect action not found under takeover');
    expect(preselect.isEnabled).toBe(true);
    if (!preselect.isEnabled) throw new Error('preselect action must be enabled under takeover');

    // Modal confirm dispatches the draft then the preselect, both
    // under the controlled bot leader seat.
    act(() => {
      preselect.onPress?.();
    });
    expect(result.current.teamPickModal).toBe('preselect');
    await act(async () => {
      await result.current.confirmTeamPick(team);
    });
    expect(result.current.teamPickModal).toBeNull();
    expect(dispatch).toHaveBeenCalledWith(
      { type: 'avalon.team.updateDraft', seats: team },
      expect.objectContaining({ controlledSeat: leaderSeat, label: '更新草稿', durable: false }),
    );
    expect(dispatch).toHaveBeenCalledWith(
      { type: 'avalon.team.preselect' },
      expect.objectContaining({ controlledSeat: leaderSeat, label: '预选队伍', durable: false }),
    );
  });
});
