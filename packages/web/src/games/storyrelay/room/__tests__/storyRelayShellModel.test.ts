/**
 * createStoryRelayRoomShellModel characterization (AU-01): the assembled
 * model is pinned field by field from a real engine lobby state, and a
 * finished round's bottom panel carries the shared review for every
 * viewer.
 */
import {
  DEFAULT_STORY_RELAY_CONFIG,
  type StoryRelayCommand,
  storyRelayEngine,
  type StoryRelayState,
} from '@game-judge/game-engine/games/storyrelay/public';

import type { RoomSeatController } from '@/features/room/controllers/useRoomSeatController';
import {
  createBotTakeoverCapability,
  createRoomSetupCapabilities,
  type RoomCapabilities,
} from '@/features/room/model/RoomCapabilities';
import type { RoomShellModel } from '@/features/room/model/RoomShellModel';
import type { RoomViewer } from '@/features/room/model/RoomViewer';
import type { RoomReviewEntry } from '@/features/room/review/roomReviewActions';
import { viewerFor } from '@/test-utils/roomViewer';
import { buildStoryRelayTestState, playStoryRelayTestRound } from '@/test-utils/storyrelayState';

import { createStoryRelayRoomShellModel } from '../storyRelayRoomAdapter';

type CommandContext = Parameters<typeof storyRelayEngine.decide>[2];

function lobbyState(withBots: boolean): StoryRelayState {
  let commandNumber = 0;
  let state: StoryRelayState = storyRelayEngine.createInitialState(
    { ...DEFAULT_STORY_RELAY_CONFIG, numberOfPlayers: 4 },
    { roomCode: '1234', hostUserId: 'host', nowMs: 1000, commandId: 'create' },
  );
  const send = (command: StoryRelayCommand, userId = 'host') => {
    const context: CommandContext = {
      actor: { kind: 'user', userId },
      controlledSeat: null,
      nowMs: 1000,
      commandId: `command:${commandNumber++}`,
      randomSeed: `seed:${commandNumber}`,
    };
    const decision = storyRelayEngine.decide(state, command, context);
    if (decision.kind === 'reject') throw new Error(`rejected: ${decision.reason}`);
    state = decision.events.reduce(storyRelayEngine.evolve, state);
  };
  send({ type: 'room.seat.take', seat: 0, profile: { displayName: '房主' } });
  if (withBots) send({ type: 'room.seat.fillBots' });
  return state;
}

function capabilities(): RoomCapabilities {
  return {
    ...createRoomSetupCapabilities({
      isSetup: true,
      isHost: true,
      mySeat: 0,
      supportsBots: true,
      hasOccupiedSeats: true,
      isRoomFull: false,
      requestTakeSeat: vi.fn(),
      requestMoveSeat: vi.fn(),
      leaveSeat: vi.fn(),
      kickSeat: vi.fn(),
      clearSeats: vi.fn(),
      fillBots: vi.fn(),
      configureGame: vi.fn(),
      shareRoom: vi.fn(),
    }),
    canViewProfiles: { isAllowed: true, execute: vi.fn() },
    canTakeOverBots: createBotTakeoverCapability(true, vi.fn()),
  };
}

const seatController: RoomSeatController = {
  pendingAction: null,
  isSubmitting: false,
  requestTakeSeat: vi.fn(),
  requestMoveSeat: vi.fn(),
  confirm: vi.fn(async () => undefined),
  cancel: vi.fn(),
};

const share = {
  isVisible: false,
  roomCode: '1234',
  roomUrl: 'https://example.test/1234',
  open: vi.fn(),
  close: vi.fn(),
  copyLink: vi.fn(async () => undefined),
  shareImage: vi.fn(async () => undefined),
};

const ENABLED_REVIEW: RoomReviewEntry = { isEnabled: true, onPress: () => {} };

/** The shell one viewer sees of a played round, with the review entry the room hook passes. */
function shellFor(
  state: StoryRelayState,
  viewer: RoomViewer,
  review: RoomReviewEntry | null,
): RoomShellModel {
  return createStoryRelayRoomShellModel({
    roomCode: state.roomCode,
    viewer,
    capabilities: capabilities(),
    onBack: vi.fn(),
    onTitlePress: vi.fn(),
    onTitleLongPress: vi.fn(),
    user: { id: viewer.userId, avatarUrl: null },
    gachaStatus: null,
    onUserActionPress: vi.fn(),
    connection: {
      status: { kind: 'live' },
      pendingDurableCount: 0,
      onRetryNow: vi.fn(),
    },
    state,
    revision: 1,
    controlledSeat: null,
    seatsVisuallyDisabled: false,
    onSeatPress: vi.fn(),
    onBotSeatLongPress: null,
    seatController,
    profileSelection: null,
    onProfileClose: vi.fn(),
    onProfileLeaveSeat: vi.fn(),
    share,
    isLobby: false,
    review,
    buildHostManagement: () => null,
    releaseBot: vi.fn(),
  });
}

describe('createStoryRelayRoomShellModel', () => {
  it('assembles the lobby shell from the hook projections', () => {
    const state = lobbyState(true);
    const caps = capabilities();
    const hostManagement = { task: null, sections: [] };
    const onSeatPress = vi.fn();
    const model = createStoryRelayRoomShellModel({
      roomCode: '1234',
      viewer: { userId: 'host', isHost: true, seat: 0 },
      capabilities: caps,
      onBack: vi.fn(),
      onTitlePress: vi.fn(),
      onTitleLongPress: vi.fn(),
      user: { id: 'host', avatarUrl: null },
      gachaStatus: undefined,
      onUserActionPress: vi.fn(),
      connection: {
        status: { kind: 'live' },
        pendingDurableCount: 0,
        onRetryNow: vi.fn(),
      },
      state,
      revision: 2,
      controlledSeat: null,
      seatsVisuallyDisabled: true,
      onSeatPress,
      onBotSeatLongPress: null,
      seatController,
      profileSelection: null,
      onProfileClose: vi.fn(),
      onProfileLeaveSeat: vi.fn(),
      share,
      isLobby: true,
      review: null,
      buildHostManagement: () => hostManagement,
      releaseBot: vi.fn(),
    });
    expect(model.roomCode).toBe('1234');
    expect(model.capabilities).toBe(caps);
    expect(model.header.userAction?.ticketCount).toBeNull();
    expect(model.seats.source.count).toBe(4);
    expect(model.seats.visuallyDisabled).toBe(true);
    expect(model.seats.onSeatPress).toBe(onSeatPress);
    expect(model.seatConfirmation).toBeNull();
    expect(model.profile).toBeNull();
    expect(model.share).toBe(share);
    expect(model.bottomActions).toEqual({
      kind: 'stacked',
      message: null,
      progress: null,
      layout: { primary: [], secondary: [], ghost: [] },
    });
    expect(model.hostManagement).toBe(hostManagement);
    expect(model.controlledSeat).toBeNull();
    // The shell phase anchor carries the state phase kind verbatim.
    expect(model.phase).toBe('lobby');

    const endedModel = createStoryRelayRoomShellModel({
      roomCode: '1234',
      viewer: { userId: 'host', isHost: true, seat: 0 },
      capabilities: caps,
      onBack: vi.fn(),
      onTitlePress: vi.fn(),
      onTitleLongPress: vi.fn(),
      user: { id: 'host', avatarUrl: null },
      gachaStatus: undefined,
      onUserActionPress: vi.fn(),
      connection: {
        status: { kind: 'live' },
        pendingDurableCount: 0,
        onRetryNow: vi.fn(),
      },
      state: { ...state, phase: 'ended' },
      revision: 2,
      controlledSeat: null,
      seatsVisuallyDisabled: true,
      onSeatPress,
      onBotSeatLongPress: null,
      seatController,
      profileSelection: null,
      onProfileClose: vi.fn(),
      onProfileLeaveSeat: vi.fn(),
      share,
      isLobby: false,
      review: ENABLED_REVIEW,
      buildHostManagement: () => hostManagement,
      releaseBot: vi.fn(),
    });
    expect(endedModel.phase).toBe('ended');
  });

  it('shows 等待房主开始游戏 to a seated non-host and no hint without bots', () => {
    const state = lobbyState(false);
    const model = createStoryRelayRoomShellModel({
      roomCode: '1234',
      viewer: { userId: 'u1', isHost: false, seat: 0 },
      capabilities: capabilities(),
      onBack: vi.fn(),
      onTitlePress: vi.fn(),
      onTitleLongPress: vi.fn(),
      user: { id: 'u1', avatarUrl: null },
      gachaStatus: null,
      onUserActionPress: vi.fn(),
      connection: {
        status: { kind: 'live' },
        pendingDurableCount: 0,
        onRetryNow: vi.fn(),
      },
      state,
      revision: 1,
      controlledSeat: null,
      seatsVisuallyDisabled: false,
      onSeatPress: vi.fn(),
      onBotSeatLongPress: null,
      seatController,
      profileSelection: null,
      onProfileClose: vi.fn(),
      onProfileLeaveSeat: vi.fn(),
      share,
      isLobby: true,
      review: null,
      buildHostManagement: () => null,
      releaseBot: vi.fn(),
    });
    expect(model.bottomActions).toEqual({
      kind: 'stacked',
      message: '等待房主开始游戏',
      progress: null,
      layout: { primary: [], secondary: [], ghost: [] },
    });
    expect(model.controlledSeat).toBeNull();
  });

  it.each([
    ['ended', playStoryRelayTestRound()],
    ['aborted', playStoryRelayTestRound({ abortAtStep: 2 })],
  ])('offers every viewer of an %s round the review as a secondary button', (_phase, state) => {
    for (const audience of ['host', 'seated', 'spectator'] as const) {
      const model = shellFor(state, viewerFor(audience, { hostUserId: 'host-1' }), ENABLED_REVIEW);
      expect(model.bottomActions).toMatchObject({
        kind: 'stacked',
        message: null,
        layout: {
          primary: [],
          secondary: [
            {
              key: 'review',
              label: '本局复盘',
              audience: 'anyone',
              variant: 'secondary',
              testID: 'room-review-open',
              isEnabled: true,
            },
          ],
          ghost: [],
        },
      });
    }
  });

  it.each([
    [0, '写下故事开头'],
    [2, '续写故事'],
    [5, '写下故事结局'],
  ])('labels the answering bottom progress for step %s as %s', (stepIndex, label) => {
    const state = buildStoryRelayTestState({ phase: 'answering', stepIndex });
    const model = shellFor(state, viewerFor('host', { hostUserId: 'host-1' }), null);
    expect(model.bottomActions).toMatchObject({
      kind: 'stacked',
      progress: { current: stepIndex + 1, total: 6, label },
    });
  });

  it('fails fast when a finished round reaches the bottom panel without its review entry', () => {
    expect(() =>
      shellFor(playStoryRelayTestRound(), viewerFor('spectator', { hostUserId: 'host-1' }), null),
    ).toThrow('[FAIL-FAST] Story Relay ended has no review entry');
  });
});
