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
import { resolveHostConsolePrimary } from '@/features/room/model/resolveHostConsolePrimary';
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
  state = drive(state, { type: 'demo.roles.assign' });
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
    const hostManagement = { sections: [] };
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
      releaseBot: jest.fn(),
    });
    expect(model.roomCode).toBe('1234');
    // The shell phase anchor carries the demo phase kind verbatim.
    expect(model.phase).toBe('lobby');
    expect(model.seats.source.count).toBe(4);
    expect(model.seats.onSeatPress).toBe(onSeatPress);
    expect(model.seatConfirmation).toBeNull();
    expect(model.profile).toBeNull();
    expect(model.share).toBe(share);
    expect(model.hostManagement).toBe(hostManagement);
    expect(model.controlledSeat).toBeNull();
  });

  it('exposes the viewing phase on the shell model', () => {
    const model = createDemoRoomShellModel({
      roomCode: '1234',
      capabilities: capabilities(),
      onBack: jest.fn(),
      onTitlePress: jest.fn(),
      onTitleLongPress: jest.fn(),
      user: { id: 'host', avatarUrl: null },
      gachaStatus: null,
      onUserActionPress: jest.fn(),
      connection: { status: 'live', pendingCommandCount: 0, onManualReconnect: jest.fn() },
      state: viewingState(),
      revision: 5,
      userId: 'host',
      controlledSeat: null,
      seatsVisuallyDisabled: false,
      onSeatPress: jest.fn(),
      onBotSeatLongPress: null,
      seatController,
      profileSelection: null,
      onProfileClose: jest.fn(),
      onProfileLeaveSeat: jest.fn(),
      share,
      isLobby: false,
      isHost: true,
      mySeat: 0,
      hostManagement: { sections: [] },
      releaseBot: jest.fn(),
    });
    expect(model.phase).toBe('viewing');
  });

  it('shows the shared ended wait to a seated non-host player once ended', () => {
    let state = viewingState();
    state = drive(state, { type: 'demo.role.viewed' });
    state = drive(state, { type: 'demo.bots.markAllBotsViewed' });
    state = drive(state, { type: 'demo.game.begin' });
    const playing = state.phase;
    if (playing.kind !== 'playing') throw new Error('expected playing phase');
    const settleContext: CommandContext = {
      actor: { kind: 'system', effectId: 'effect:1' },
      controlledSeat: null,
      nowMs: playing.deadlineAt,
      commandId: 'demo.phase.settleExpired',
      randomSeed: 'seed',
    };
    const decision = demoEngine.decide(state, { type: 'demo.phase.settleExpired' }, settleContext);
    if (decision.kind === 'reject') throw new Error(`rejected: ${decision.reason}`);
    state = decision.events.reduce(demoEngine.evolve, state);
    if (state.phase.kind !== 'ended') throw new Error('expected ended phase');
    const shellInput = {
      roomCode: '1234',
      capabilities: capabilities(),
      onBack: jest.fn(),
      onTitlePress: jest.fn(),
      onTitleLongPress: jest.fn(),
      user: { id: 'host', avatarUrl: null },
      gachaStatus: null,
      onUserActionPress: jest.fn(),
      connection: { status: 'live', pendingCommandCount: 0, onManualReconnect: jest.fn() },
      state,
      revision: 9,
      controlledSeat: null,
      seatsVisuallyDisabled: false,
      onSeatPress: jest.fn(),
      onBotSeatLongPress: null,
      seatController,
      profileSelection: null,
      onProfileClose: jest.fn(),
      onProfileLeaveSeat: jest.fn(),
      share,
      isLobby: false,
      hostManagement: { sections: [] },
      releaseBot: jest.fn(),
    } as const;
    const playerModel = createDemoRoomShellModel({
      ...shellInput,
      userId: 'bot-user',
      isHost: false,
      mySeat: 2,
    });
    expect(playerModel.bottomActions).toMatchObject({
      kind: 'stacked',
      message: '等待房主操作（再来一局 / 返回大厅）',
    });
    const hostModel = createDemoRoomShellModel({
      ...shellInput,
      userId: 'host',
      isHost: true,
      mySeat: 0,
    });
    expect(hostModel.bottomActions).toMatchObject({ kind: 'stacked', message: null });
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
    expect(model?.sections.map((section) => section.key)).toEqual(['game', 'bot-viewing', 'room']);
    const begin = model?.sections[0]?.actions[0];
    expect(begin).toMatchObject({
      isEnabled: false,
      disabledReason: '0/4 位玩家已查看身份，等待剩余玩家',
    });
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
    expect(model?.sections.map((section) => section.key)).toEqual(['game', 'room']);
    expect(model?.sections[0]?.actions[0]).toMatchObject({ isEnabled: true });
  });

  describe('console primary', () => {
    const build = (state: DemoState) =>
      createDemoHostManagement({
        state,
        isHost: true,
        capabilities: capabilities(),
        isSubmitting: false,
        submit: jest.fn(async () => true),
      });

    it('blocks identity assignment in a non-full lobby and offers room sharing', () => {
      const step = resolveHostConsolePrimary(build(lobbyState(false))!);
      expect(step).toMatchObject({ actionKey: 'assign-roles', label: '分配角色' });
      if (step?.kind !== 'blocked') throw new Error('expected a blocked console primary');
      expect(step.reason).toBe('座位尚未坐满（还差 3 人）');
      expect(step.remedy?.label).toBe('分享房间');
    });

    it('offers identity assignment once the room is full', () => {
      const step = resolveHostConsolePrimary(build(lobbyState(true))!);
      if (step?.kind !== 'ready') throw new Error('expected a ready console primary');
    });

    it('blocks game start while viewing is incomplete, then offers it', () => {
      const blocked = resolveHostConsolePrimary(build(viewingState())!);
      expect(blocked).toMatchObject({ actionKey: 'start-game', label: '开始游戏' });
      if (blocked?.kind !== 'blocked') throw new Error('expected a blocked console primary');
      expect(blocked.reason).toBe('0/4 位玩家已查看身份，等待剩余玩家');
      expect(blocked.remedy).toBeNull();

      let state = viewingState();
      state = drive(state, { type: 'demo.role.viewed' });
      state = drive(state, { type: 'demo.bots.markAllBotsViewed' });
      const ready = resolveHostConsolePrimary(build(state)!);
      if (ready?.kind !== 'ready') throw new Error('expected a ready console primary');
    });
  });
});
