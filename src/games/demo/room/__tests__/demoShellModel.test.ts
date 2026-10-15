/**
 * createDemoRoomShellModel / HostManagement characterization:
 * the assembled models are pinned from real engine states (lobby and
 * the identity-viewing stage).
 */
import {
  DEFAULT_DEMO_CONFIG,
  type DemoCommand,
  demoEngine,
  type DemoState,
} from '@game-judge/game-engine/games/demo/public';

import type { RoomSeatController } from '@/features/room/controllers/useRoomSeatController';
import {
  createBotTakeoverCapability,
  createRoomSetupCapabilities,
  type RoomCapabilities,
} from '@/features/room/model/RoomCapabilities';

import { createDemoHostManagement, createDemoRoomShellModel } from '../demoRoomAdapter';

type CommandContext = Parameters<typeof demoEngine.decide>[2];

function drive(state: DemoState, command: DemoCommand, userId = 'host') {
  const context: CommandContext = {
    actor: { kind: 'user', userId },
    controlledSeat: null,
    nowMs: 1000,
    commandId: command.type,
    randomSeed: 'seed',
  };
  const decision = demoEngine.decide(state, command, context);
  if (decision.kind === 'reject') throw new Error(`rejected: ${decision.reason}`);
  return decision.events.reduce(demoEngine.evolve, state);
}

function lobbyState(withBots: boolean): DemoState {
  let state = demoEngine.createInitialState(
    { ...DEFAULT_DEMO_CONFIG, numberOfPlayers: 4 },
    { roomCode: '1234', hostUserId: 'host', nowMs: 1000, commandId: 'create' },
  );
  state = drive(state, { type: 'room.seat.take', seat: 0, profile: { displayName: '房主' } });
  if (withBots) state = drive(state, { type: 'room.seat.fillBots' });
  return state;
}

function viewingState(): DemoState {
  let state = lobbyState(true);
  state = drive(state, { type: 'demo.game.start' });
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

describe('createDemoRoomShellModel', () => {
  it('assembles the lobby shell from the hook projections', () => {
    const state = lobbyState(true);
    const caps = capabilities();
    const hostManagement = { preview: '分配身份', status: null, sections: [] };
    const onSeatPress = jest.fn();
    const model = createDemoRoomShellModel({
      roomCode: '1234',
      capabilities: caps,
      onBack: jest.fn(),
      onTitlePress: jest.fn(),
      onTitleLongPress: jest.fn(),
      user: { id: 'host', avatarUrl: null },
      gachaStatus: null,
      onUserActionPress: jest.fn(),
      connection: { status: 'live', pendingCommandCount: 0, onManualReconnect: jest.fn() },
      state,
      revision: 5,
      userId: 'host',
      controlledSeat: null,
      seatsVisuallyDisabled: false,
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
    expect(model.seats.source.count).toBe(4);
    expect(model.seats.onSeatPress).toBe(onSeatPress);
    expect(model.seatConfirmation).toBeNull();
    expect(model.profile).toBeNull();
    expect(model.share).toBe(share);
    expect(model.hostManagement).toBe(hostManagement);
    expect(model.controlledSeat).toEqual({ kind: 'hint' });
    expect(model.statusRibbon).toEqual({
      kind: 'message',
      icon: 'guide',
      text: '等待入座 · 4/4',
      supportingText: null,
    });
  });
});

describe('createDemoHostManagement', () => {
  it('gates the viewing-stage begin on the full view record and offers the bot scaffold', () => {
    const state = viewingState();
    const model = createDemoHostManagement({
      state,
      isHost: true,
      capabilities: capabilities(),
      isSubmitting: false,
      submit: jest.fn(async () => true),
    });
    expect(model?.preview).toBe('开始游戏');
    expect(model?.status).toBe('等待全员查看身份 · 0/4');
    expect(model?.sections.map((section) => section.key)).toEqual(['game', 'bot-viewing', 'room']);
    const begin = model?.sections[0]?.actions[0];
    expect(begin).toMatchObject({ isEnabled: false, disabledReason: '还有玩家未查看身份' });
  });

  it('enables begin once every seat has viewed', () => {
    let state = viewingState();
    state = drive(state, { type: 'demo.role.viewed' });
    state = drive(state, { type: 'demo.bots.markAllBotsViewed' });
    const model = createDemoHostManagement({
      state,
      isHost: true,
      capabilities: capabilities(),
      isSubmitting: false,
      submit: jest.fn(async () => true),
    });
    expect(model?.status).toBe('等待全员查看身份 · 4/4');
    expect(model?.sections.map((section) => section.key)).toEqual(['game', 'room']);
    expect(model?.sections[0]?.actions[0]).toMatchObject({ isEnabled: true });
  });
});
