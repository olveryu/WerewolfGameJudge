/**
 * Nomination team-pick modal wiring: the leader's bottom buttons only
 * open the modal (preselect / final by the server preselect record),
 * and the modal confirm dispatches one command carrying the team —
 * preselect or propose. The modal selection is local until confirm;
 * there is no server draft: badges and buttons read the preselect
 * record only. States come from the real engine; the session is a
 * fake dispatch.
 */
import {
  avalonEngine,
  type AvalonPublicCommand,
  type AvalonState,
  DEFAULT_AVALON_CONFIG,
  getAvalonNightParticipants,
} from '@game-judge/game-engine/games/avalon/public';
import { createRoomSnapshot } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import { act, renderHook } from '@testing-library/react-native';

import type { RoomBottomButton } from '@/features/room/model/RoomBottomActions';
import { createFakeRoomLink, readyLinkSnapshot, testIdentity } from '@/test-utils/linkSnapshot';
import { rejectedRoomCommand, successfulRoomCommand } from '@/test-utils/roomCommand';
import { showErrorAlert } from '@/utils/alertPresets';

import { useAvalonRoomState } from '../useAvalonRoomState';

const mockAuth = { currentUserId: 'host' };

jest.mock('@/contexts/AuthContext', () => ({
  useAuthContext: () => ({
    user: { id: mockAuth.currentUserId, avatarUrl: null, equippedEffect: null },
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

const seatUserOf = (seat: number) => (seat === 0 ? 'host' : `u${seat}`);

/**
 * Real engine walk into the nominate phase of a 5-player game. The
 * first leader is drawn by the engine, so tests seat the viewer by
 * seatUserOf(state.leaderSeat) instead of assuming the host leads.
 */
function nominateState(): AvalonState {
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
  const seatUser = seatUserOf;
  for (let seat = 0; seat < 5; seat += 1) {
    send({ type: 'room.seat.take', seat, profile: { displayName: `P${seat}` } }, seatUser(seat));
  }
  send({ type: 'avalon.roles.assign' });
  for (let seat = 0; seat < 5; seat += 1) {
    send({ type: 'avalon.role.viewed' }, seatUser(seat));
  }
  send({ type: 'avalon.game.begin' });
  if (state.isAudioPlaying)
    send({ type: 'avalon.audio.ack', audioBatchId: state.audioBatchId }, 'host');
  for (const step of ['evilReveal', 'merlinReveal', 'percivalReveal'] as const) {
    if (state.phase.kind !== 'night') break;
    for (const seat of getAvalonNightParticipants(state.roles, step)) {
      send({ type: 'avalon.night.confirm' }, seatUser(seat));
    }
    if (state.isAudioPlaying)
      send({ type: 'avalon.audio.ack', audioBatchId: state.audioBatchId }, 'host');
  }
  if (state.phase.kind !== 'nominate') throw new Error('expected nominate phase');
  return state;
}

function createFakeSession(state: AvalonState, userId: string) {
  const session = createFakeRoomLink<AvalonState, AvalonPublicCommand>(
    readyLinkSnapshot(testIdentity('avalon', { userId }), createRoomSnapshot(state, 1)),
    async () => successfulRoomCommand(state),
  );
  return { session, dispatch: session.dispatch };
}

function renderRoomState(state: AvalonState) {
  const fake = createFakeSession(state, mockAuth.currentUserId);
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

type RoomStateResult = ReturnType<typeof renderRoomState>['result'];

function findProposeAction(result: RoomStateResult): RoomBottomButton {
  const bottom = result.current.shellModel.bottomActions;
  if (bottom.kind !== 'stacked') throw new Error('expected stacked bottom actions in nominate');
  const action = bottom.layout.primary.find(
    (candidate) => candidate.testID === 'avalon-nominate-submit',
  );
  if (action === undefined) throw new Error('propose action not found');
  return action;
}

function findPreselectAction(result: RoomStateResult): RoomBottomButton {
  const bottom = result.current.shellModel.bottomActions;
  if (bottom.kind !== 'stacked') throw new Error('expected stacked bottom actions in nominate');
  const action = bottom.layout.primary.find(
    (candidate) => candidate.testID === 'avalon-nominate-preselect',
  );
  if (action === undefined) throw new Error('preselect action not found');
  return action;
}

/** Walks a nominate state through a preselect (real engine). */
function preselectState(state: AvalonState): AvalonState {
  if (state.phase.kind !== 'nominate') throw new Error('expected nominate phase');
  const leader = state.leaderSeat;
  const team = [leader, (leader + 1) % 5];
  let commandNumber = 100;
  let next = state;
  const send = (command: AvalonPublicCommand) => {
    const context: CommandContext = {
      actor: { kind: 'user', userId: seatUserOf(leader) },
      controlledSeat: null,
      nowMs: 1000,
      commandId: `command:${commandNumber++}`,
      randomSeed: `seed:${commandNumber}`,
    };
    const decision = avalonEngine.decide(next, command, context);
    if (decision.kind === 'reject') throw new Error(`rejected: ${decision.reason}`);
    next = decision.events.reduce(avalonEngine.evolve, next);
  };
  send({ type: 'avalon.team.preselect', seats: team });
  if (next.phase.kind !== 'nominate') throw new Error('expected nominate phase');
  return next;
}

describe('useAvalonRoomState nomination team pick', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.currentUserId = 'host';
  });

  it('offers an enabled preselect button before any preselect, opening the modal', () => {
    const state = nominateState();
    mockAuth.currentUserId = seatUserOf(state.leaderSeat);
    const { result } = renderRoomState(state);
    // The full-team gate lives on the modal confirm; the final button
    // does not exist before the preselect echo.
    const preselectAction = findPreselectAction(result);
    expect(preselectAction.isEnabled).toBe(true);
    const bottom = result.current.shellModel.bottomActions;
    if (bottom.kind !== 'stacked') throw new Error('expected stacked bottom actions in nominate');
    expect(
      bottom.layout.primary.find((candidate) => candidate.testID === 'avalon-nominate-submit'),
    ).toBeUndefined();
    if (!preselectAction.isEnabled) throw new Error('preselect action must be enabled');
    act(() => {
      preselectAction.onPress?.();
    });
    expect(result.current.teamPickModal).toBe('preselect');
  });

  it('opens the final modal from the final button after the preselect echo', () => {
    const state = preselectState(nominateState());
    mockAuth.currentUserId = seatUserOf(state.leaderSeat);
    const { result } = renderRoomState(state);
    const proposeAction = findProposeAction(result);
    expect(proposeAction.isEnabled).toBe(true);
    const bottom = result.current.shellModel.bottomActions;
    if (bottom.kind !== 'stacked') throw new Error('expected stacked bottom actions in nominate');
    expect(
      bottom.layout.primary.find((candidate) => candidate.testID === 'avalon-nominate-preselect'),
    ).toBeUndefined();
    if (!proposeAction.isEnabled) throw new Error('propose action must be enabled');
    act(() => {
      proposeAction.onPress?.();
    });
    expect(result.current.teamPickModal).toBe('final');
  });

  it('preselect confirm dispatches preselect with the team and closes the modal', async () => {
    const state = nominateState();
    mockAuth.currentUserId = seatUserOf(state.leaderSeat);
    const { result, dispatch } = renderRoomState(state);
    const team: readonly number[] = [state.leaderSeat, (state.leaderSeat + 1) % 5];
    act(() => {
      result.current.setTeamPickModal('preselect');
    });
    await act(async () => {
      await result.current.confirmTeamPick(team);
    });
    expect(result.current.teamPickModal).toBeNull();
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(
      { type: 'avalon.team.preselect', seats: team },
      expect.objectContaining({ label: '预选队伍', controlledSeat: null }),
    );
  });

  it('final confirm dispatches propose with the team (which may differ from the preselect)', async () => {
    const state = preselectState(nominateState());
    mockAuth.currentUserId = seatUserOf(state.leaderSeat);
    const { result, dispatch } = renderRoomState(state);
    const team: readonly number[] = [state.leaderSeat, (state.leaderSeat + 2) % 5];
    act(() => {
      result.current.setTeamPickModal('final');
    });
    await act(async () => {
      await result.current.confirmTeamPick(team);
    });
    expect(result.current.teamPickModal).toBeNull();
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(
      { type: 'avalon.team.propose', seats: team },
      expect.objectContaining({ label: '提交队伍' }),
    );
  });

  it('a rejected team surfaces the failure and keeps the phase', async () => {
    const state = preselectState(nominateState());
    mockAuth.currentUserId = seatUserOf(state.leaderSeat);
    const { result, dispatch } = renderRoomState(state);
    dispatch.mockImplementationOnce(async () =>
      rejectedRoomCommand<AvalonState>('avalon_team_size_invalid:2', 'command:propose'),
    );
    act(() => {
      result.current.setTeamPickModal('final');
    });
    await act(async () => {
      await result.current.confirmTeamPick([state.leaderSeat]);
    });
    expect(showErrorAlert).toHaveBeenCalledWith('提交队伍失败', expect.any(String));
    expect(result.current.teamPickModal).toBeNull();
  });
});
