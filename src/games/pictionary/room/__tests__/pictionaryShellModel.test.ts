/**
 * createPictionaryRoomShellModel characterization (AU-01): the assembled
 * model is pinned field by field from a real engine lobby state, and a
 * finished round's bottom panel carries the shared review for every
 * viewer.
 */
import {
  DEFAULT_PICTIONARY_CONFIG,
  getPictionaryOccupiedSeatCount,
  isPictionaryRoomFull,
  pictionaryEngine,
  type PictionaryState,
} from '@game-judge/game-engine/games/pictionary/public';

import {
  createBotTakeoverCapability,
  createRoomSetupCapabilities,
  createViewProfilesCapability,
  type RoomCapabilities,
} from '@/features/room/model/RoomCapabilities';
import type { RoomShellModel } from '@/features/room/model/RoomShellModel';
import type { RoomViewer } from '@/features/room/model/RoomViewer';
import type { RoomReviewEntry } from '@/features/room/review/roomReviewActions';
import { playPictionaryTestRound } from '@/test-utils/pictionaryState';
import { viewerFor } from '@/test-utils/roomViewer';

import {
  createPictionaryRoomShellModel,
  createPictionarySeatDataSource,
} from '../pictionaryRoomAdapter';

/** Mirrors the hook's capability assembly: shared setup capabilities + host-only takeover. */
function testCapabilities(input: {
  readonly state: PictionaryState;
  readonly isHost: boolean;
  readonly mySeat: number | null;
  readonly shareRoom: () => void;
}): RoomCapabilities {
  const isLobby = input.state.phase === 'lobby';
  return {
    ...createRoomSetupCapabilities({
      isSetup: isLobby,
      isHost: input.isHost,
      supportsBots: true,
      mySeat: input.mySeat,
      hasOccupiedSeats: getPictionaryOccupiedSeatCount(input.state) > 0,
      isRoomFull: isPictionaryRoomFull(input.state),
      requestTakeSeat: jest.fn(),
      requestMoveSeat: jest.fn(),
      leaveSeat: jest.fn(),
      kickSeat: jest.fn(),
      clearSeats: jest.fn(),
      fillBots: jest.fn(),
      configureGame: jest.fn(),
      shareRoom: input.shareRoom,
    }),
    canViewProfiles: createViewProfilesCapability(isLobby, jest.fn()),
    canTakeOverBots: createBotTakeoverCapability(input.isHost, jest.fn()),
  };
}

function lobbyState(): PictionaryState {
  return pictionaryEngine.createInitialState(
    { ...DEFAULT_PICTIONARY_CONFIG, numberOfPlayers: 4 },
    { roomCode: '2468', hostUserId: 'host', nowMs: 1000, commandId: 'create' },
  );
}

const ENABLED_REVIEW: RoomReviewEntry = { isEnabled: true, onPress: () => {} };

/** The shell one viewer sees of a played round, with the review entry the room hook passes. */
function shellFor(
  state: PictionaryState,
  viewer: RoomViewer,
  review: RoomReviewEntry | null,
): RoomShellModel {
  return createPictionaryRoomShellModel({
    roomCode: state.roomCode,
    capabilities: testCapabilities({
      state,
      isHost: viewer.isHost,
      mySeat: viewer.seat,
      shareRoom: jest.fn(),
    }),
    onBack: jest.fn(),
    onTitlePress: jest.fn(),
    onTitleLongPress: jest.fn(),
    user: { id: viewer.userId, avatarUrl: null },
    gachaStatus: null,
    onUserActionPress: jest.fn(),
    connection: {
      status: { kind: 'live' },
      pendingDurableCount: 0,
      presence: new Set<string>(),
      onRetryNow: jest.fn(),
    },
    state,
    viewer,
    seatSource: createPictionarySeatDataSource({
      state,
      revision: 1,
      myUserId: viewer.userId,
      controlledSeat: null,
    }),
    seatsVisuallyDisabled: false,
    onSeatPress: jest.fn(),
    onBotSeatLongPress: null,
    seatConfirmation: null,
    profile: null,
    share: {
      isVisible: false,
      roomCode: state.roomCode,
      roomUrl: `https://example.test/${state.roomCode}`,
      open: jest.fn(),
      close: jest.fn(),
      copyLink: jest.fn(async () => undefined),
      shareImage: jest.fn(async () => undefined),
    },
    review,
    buildHostManagement: () => null,
    controlledSeat: null,
  });
}

describe('createPictionaryRoomShellModel', () => {
  it('assembles the shell from the hook projections', () => {
    const state = lobbyState();
    const seatSource = createPictionarySeatDataSource({
      state,
      revision: 1,
      myUserId: 'host',
      controlledSeat: null,
    });
    const share = {
      isVisible: false,
      roomCode: '2468',
      roomUrl: 'https://example.test/2468',
      open: jest.fn(),
      close: jest.fn(),
      copyLink: jest.fn(async () => undefined),
      shareImage: jest.fn(async () => undefined),
    };
    const connection = {
      status: { kind: 'live' as const },
      pendingDurableCount: 0,
      presence: new Set<string>(),
      onRetryNow: jest.fn(),
    };
    const onBack = jest.fn();
    const onSeatPress = jest.fn();
    const capabilities = testCapabilities({
      state,
      isHost: true,
      mySeat: null,
      shareRoom: jest.fn(),
    });
    const model = createPictionaryRoomShellModel({
      roomCode: '2468',
      capabilities,
      onBack,
      onTitlePress: jest.fn(),
      onTitleLongPress: jest.fn(),
      user: { id: 'host', avatarUrl: null },
      gachaStatus: null,
      onUserActionPress: jest.fn(),
      connection,
      state,
      viewer: { userId: 'host', isHost: true, seat: null },
      seatSource,
      seatsVisuallyDisabled: false,
      onSeatPress,
      onBotSeatLongPress: null,
      seatConfirmation: null,
      profile: null,
      share,
      review: null,
      buildHostManagement: () => null,
      controlledSeat: null,
    });
    expect(Object.keys(model).sort()).toEqual([
      'bottomActions',
      'capabilities',
      'connection',
      'controlledSeat',
      'header',
      'hostManagement',
      'isAudioPlaying',
      'phase',
      'profile',
      'roomCode',
      'seatConfirmation',
      'seats',
      'share',
      'step',
      'viewer',
    ]);
    expect(model.isAudioPlaying).toBe(false);
    expect(model.roomCode).toBe('2468');
    expect(model.header.onBack).toBe(onBack);
    expect(model.header.userAction?.ticketCount).toBeNull();
    expect(model.connection).toBe(connection);
    expect(model.seats).toEqual({
      source: seatSource,
      visuallyDisabled: false,
      onSeatPress,
      onBotSeatLongPress: null,
    });
    expect(model.bottomActions).toEqual({
      kind: 'stacked',
      message: null,
      progress: null,
      layout: { primary: [], secondary: [], ghost: [] },
    });
    expect(model.share).toBe(share);
    // The shell phase anchor carries the PictionaryState phase verbatim.
    expect(model.phase).toBe('lobby');

    const endedModel = createPictionaryRoomShellModel({
      roomCode: '2468',
      capabilities,
      onBack,
      onTitlePress: jest.fn(),
      onTitleLongPress: jest.fn(),
      user: { id: 'host', avatarUrl: null },
      gachaStatus: null,
      onUserActionPress: jest.fn(),
      connection,
      state: { ...state, phase: 'ended' },
      viewer: { userId: 'host', isHost: true, seat: null },
      seatSource,
      seatsVisuallyDisabled: false,
      onSeatPress,
      onBotSeatLongPress: null,
      seatConfirmation: null,
      profile: null,
      share,
      review: ENABLED_REVIEW,
      buildHostManagement: () => null,
      controlledSeat: null,
    });
    expect(endedModel.phase).toBe('ended');
  });

  it.each([
    ['ended', playPictionaryTestRound()],
    ['aborted', playPictionaryTestRound({ abortAtStep: 2 })],
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

  it('fails fast when a finished round reaches the bottom panel without its review entry', () => {
    expect(() =>
      shellFor(playPictionaryTestRound(), viewerFor('seated', { hostUserId: 'host-1' }), null),
    ).toThrow('[FAIL-FAST] Pictionary ended has no review entry');
  });
});
