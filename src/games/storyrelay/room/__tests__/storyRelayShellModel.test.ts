/**
 * createStoryRelayRoomShellModel characterization (AU-01): the assembled
 * model is pinned field by field from a real engine lobby state.
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
      requestTakeSeat: jest.fn(),
      requestMoveSeat: jest.fn(),
      leaveSeat: jest.fn(),
      kickSeat: jest.fn(),
      clearSeats: jest.fn(),
      fillBots: jest.fn(),
      configureGame: jest.fn(),
      shareRoom: jest.fn(),
    }),
    canViewProfiles: { isAllowed: true, execute: jest.fn() },
    canTakeOverBots: createBotTakeoverCapability(true, jest.fn()),
  };
}

const seatController: RoomSeatController = {
  pendingAction: null,
  isSubmitting: false,
  requestTakeSeat: jest.fn(),
  requestMoveSeat: jest.fn(),
  confirm: jest.fn(async () => undefined),
  cancel: jest.fn(),
};

const share = {
  isVisible: false,
  roomCode: '1234',
  roomUrl: 'https://example.test/1234',
  open: jest.fn(),
  close: jest.fn(),
  copyLink: jest.fn(async () => undefined),
  shareImage: jest.fn(async () => undefined),
};

describe('createStoryRelayRoomShellModel', () => {
  it('assembles the lobby shell from the hook projections', () => {
    const state = lobbyState(true);
    const caps = capabilities();
    const hostManagement = { preview: '开始游戏', nextStep: null, status: null, sections: [] };
    const onSeatPress = jest.fn();
    const model = createStoryRelayRoomShellModel({
      roomCode: '1234',
      capabilities: caps,
      onBack: jest.fn(),
      onTitlePress: jest.fn(),
      onTitleLongPress: jest.fn(),
      user: { id: 'host', avatarUrl: null },
      gachaStatus: undefined,
      onUserActionPress: jest.fn(),
      connection: { status: 'live', pendingCommandCount: 0, onManualReconnect: jest.fn() },
      state,
      revision: 2,
      userId: 'host',
      controlledSeat: null,
      seatsVisuallyDisabled: true,
      onSeatPress,
      onBotSeatLongPress: null,
      seatController,
      profileSelection: null,
      onProfileClose: jest.fn(),
      onProfileLeaveSeat: jest.fn(),
      share,
      isLobby: true,
      isHost: true,
      mySeat: 0,
      hostManagement,
      canControlBots: true,
      releaseBot: jest.fn(),
    });
    expect(model.roomCode).toBe('1234');
    expect(model.capabilities).toBe(caps);
    expect(model.header.userAction?.ticketCount).toBeNull();
    expect(model.statusRibbon).toMatchObject({ kind: 'message' });
    expect(model.seats.source.count).toBe(4);
    expect(model.seats.visuallyDisabled).toBe(true);
    expect(model.seats.onSeatPress).toBe(onSeatPress);
    expect(model.seatConfirmation).toBeNull();
    expect(model.profile).toBeNull();
    expect(model.share).toBe(share);
    expect(model.bottomActions).toEqual({ kind: 'info', message: null, actions: [] });
    expect(model.hostManagement).toBe(hostManagement);
    expect(model.controlledSeat).toEqual({ kind: 'hint' });
  });

  it('shows 等待房主开始游戏 to a seated non-host and no hint without bots', () => {
    const state = lobbyState(false);
    const model = createStoryRelayRoomShellModel({
      roomCode: '1234',
      capabilities: capabilities(),
      onBack: jest.fn(),
      onTitlePress: jest.fn(),
      onTitleLongPress: jest.fn(),
      user: { id: 'u1', avatarUrl: null },
      gachaStatus: null,
      onUserActionPress: jest.fn(),
      connection: { status: 'live', pendingCommandCount: 0, onManualReconnect: jest.fn() },
      state,
      revision: 1,
      userId: 'u1',
      controlledSeat: null,
      seatsVisuallyDisabled: false,
      onSeatPress: jest.fn(),
      onBotSeatLongPress: null,
      seatController,
      profileSelection: null,
      onProfileClose: jest.fn(),
      onProfileLeaveSeat: jest.fn(),
      share,
      isLobby: true,
      isHost: false,
      mySeat: 0,
      hostManagement: null,
      canControlBots: false,
      releaseBot: jest.fn(),
    });
    expect(model.bottomActions).toEqual({
      kind: 'info',
      message: '等待房主开始游戏',
      actions: [],
    });
    expect(model.controlledSeat).toBeNull();
  });
});
