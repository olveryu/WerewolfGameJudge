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
import { hostTaskBody } from '@/test-utils/hostTask';
import { viewerFor } from '@/test-utils/roomViewer';

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
    const hostManagement = { task: null, sections: [] };
    const onSeatPress = jest.fn();
    const input: Parameters<typeof createDemoRoomShellModel>[0] = {
      roomCode: '1234',
      viewer: viewerFor('host'),
      capabilities: caps,
      onBack: jest.fn(),
      onTitlePress: jest.fn(),
      onTitleLongPress: jest.fn(),
      user: { id: 'host', avatarUrl: null },
      gachaStatus: null,
      onUserActionPress: jest.fn(),
      connection: {
        status: { kind: 'live' },
        pendingDurableCount: 0,
        presence: new Set<string>(),
        onRetryNow: jest.fn(),
      },
      state,
      revision: 5,
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
      buildHostManagement: () => hostManagement,
      releaseBot: jest.fn(),
    };
    const model = createDemoRoomShellModel(input);
    expect(model.roomCode).toBe('1234');
    expect(model.isAudioPlaying).toBe(false);
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
      viewer: viewerFor('host'),
      capabilities: capabilities(),
      onBack: jest.fn(),
      onTitlePress: jest.fn(),
      onTitleLongPress: jest.fn(),
      user: { id: 'host', avatarUrl: null },
      gachaStatus: null,
      onUserActionPress: jest.fn(),
      connection: {
        status: { kind: 'live' },
        pendingDurableCount: 0,
        presence: new Set<string>(),
        onRetryNow: jest.fn(),
      },
      state: viewingState(),
      revision: 5,
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
      buildHostManagement: () => ({ task: null, sections: [] }),
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
    if (playing.deadlineAt === null) throw new Error('expected an armed stage deadline');
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
      viewer: viewerFor('host'),
      capabilities: capabilities(),
      onBack: jest.fn(),
      onTitlePress: jest.fn(),
      onTitleLongPress: jest.fn(),
      user: { id: 'host', avatarUrl: null },
      gachaStatus: null,
      onUserActionPress: jest.fn(),
      connection: {
        status: { kind: 'live' },
        pendingDurableCount: 0,
        presence: new Set<string>(),
        onRetryNow: jest.fn(),
      },
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
      buildHostManagement: () => ({ task: null, sections: [] }),
      releaseBot: jest.fn(),
    } as const;
    const playerModel = createDemoRoomShellModel({
      ...shellInput,
      viewer: viewerFor('seated', { seatedUserId: 'bot-user', seatedSeat: 2 }),
    });
    expect(playerModel.bottomActions).toMatchObject({
      kind: 'stacked',
      message: '等待房主操作（再来一局 / 返回大厅）',
    });
    const hostModel = createDemoRoomShellModel({
      ...shellInput,
      viewer: viewerFor('host'),
    });
    expect(hostModel.bottomActions).toMatchObject({ kind: 'stacked', message: null });
  });
});

describe('createDemoHostManagement', () => {
  it('gates the viewing-stage begin on the full view record and offers the bot scaffold', () => {
    const state = viewingState();
    const model = createDemoHostManagement({
      state,
      capabilities: capabilities(),
      isSubmitting: false,
      submit: jest.fn(async () => true),
    });
    expect(model.sections.map((section) => section.key)).toEqual(['game', 'bot-viewing', 'room']);
    const begin = model.sections[0]?.actions[0];
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
      capabilities: capabilities(),
      isSubmitting: false,
      submit: jest.fn(async () => true),
    });
    expect(model.sections.map((section) => section.key)).toEqual(['game', 'room']);
    expect(model.sections[0]?.actions[0]).toMatchObject({ isEnabled: true });
  });

  describe('task body', () => {
    const build = (state: DemoState) =>
      createDemoHostManagement({
        state,
        capabilities: capabilities(),
        isSubmitting: false,
        submit: jest.fn(async () => true),
      });

    it('blocks identity assignment in a non-full lobby and offers room sharing', () => {
      const step = hostTaskBody(build(lobbyState(false)));
      expect(step).toMatchObject({ action: { key: 'assign-roles', label: '分配角色' } });
      if (step?.kind !== 'blocked') throw new Error('expected a blocked task body');
      expect(step.reason).toBe('座位尚未坐满（还差 3 人）');
      expect(step.remedy?.label).toBe('分享房间');
    });

    it('offers identity assignment once the room is full', () => {
      const step = hostTaskBody(build(lobbyState(true)));
      if (step?.kind !== 'ready') throw new Error('expected a ready task body');
    });

    it('blocks game start while viewing is incomplete, then offers it', () => {
      const blocked = hostTaskBody(build(viewingState()));
      expect(blocked).toMatchObject({ action: { key: 'start-game', label: '开始游戏' } });
      if (blocked?.kind !== 'blocked') throw new Error('expected a blocked task body');
      expect(blocked.reason).toBe('0/4 位玩家已查看身份，等待剩余玩家');
      // The bot scaffold is the remedy while a bot seat is unviewed.
      expect(blocked.remedy?.label).toBe('标记机器人已查看');

      let state = viewingState();
      state = drive(state, { type: 'demo.role.viewed' });
      state = drive(state, { type: 'demo.bots.markAllBotsViewed' });
      const ready = hostTaskBody(build(state));
      if (ready?.kind !== 'ready') throw new Error('expected a ready task body');
    });
  });
});
