/**
 * createPictionaryRoomShellModel characterization (AU-01): the assembled
 * model is pinned field by field from a real engine lobby state.
 */
import {
  DEFAULT_PICTIONARY_CONFIG,
  pictionaryEngine,
  type PictionaryState,
} from '@game-judge/game-engine/games/pictionary/public';

import {
  createPictionaryRoomCapabilities,
  createPictionaryRoomShellModel,
  createPictionarySeatDataSource,
} from '../pictionaryRoomAdapter';

function lobbyState(): PictionaryState {
  return pictionaryEngine.createInitialState(
    { ...DEFAULT_PICTIONARY_CONFIG, numberOfPlayers: 4 },
    { roomCode: '2468', hostUserId: 'host', nowMs: 1000, commandId: 'create' },
  );
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
      status: 'live' as const,
      pendingCommandCount: 0,
      onManualReconnect: jest.fn(),
    };
    const onBack = jest.fn();
    const onSeatPress = jest.fn();
    const capabilities = createPictionaryRoomCapabilities({
      state,
      isHost: true,
      mySeat: null,
      requestTakeSeat: jest.fn(),
      requestMoveSeat: jest.fn(),
      leaveSeat: jest.fn(),
      kickSeat: jest.fn(),
      clearSeats: jest.fn(),
      fillBots: jest.fn(),
      configureGame: jest.fn(),
      openProfile: jest.fn(),
      takeOverBot: jest.fn(),
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
      isHost: true,
      mySeat: null,
      seatSource,
      seatsVisuallyDisabled: false,
      onSeatPress,
      onBotSeatLongPress: null,
      seatConfirmation: null,
      profile: null,
      share,
      hostManagement: null,
      controlledSeat: null,
    });
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
      kind: 'info',
      message: null,
      progress: null,
      actions: [],
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
      isHost: true,
      mySeat: null,
      seatSource,
      seatsVisuallyDisabled: false,
      onSeatPress,
      onBotSeatLongPress: null,
      seatConfirmation: null,
      profile: null,
      share,
      hostManagement: null,
      controlledSeat: null,
    });
    expect(endedModel.phase).toBe('ended');
  });
});
