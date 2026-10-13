/**
 * createAvalonRoomShellModel characterization (AU-01): the assembled
 * model is pinned field by field from real engine states — a lobby with
 * bots (takeover hint live) and a started night (view-role action live).
 */
import {
  type AvalonCommand,
  avalonEngine,
  type AvalonState,
  DEFAULT_AVALON_CONFIG,
} from '@game-judge/game-engine/games/avalon/public';

import type { RoomSeatController } from '@/features/room/controllers/useRoomSeatController';
import {
  createBotTakeoverCapability,
  createRoomSetupCapabilities,
  type RoomCapabilities,
} from '@/features/room/model/RoomCapabilities';

import {
  type AvalonRoomShellModelInput,
  createAvalonRoomShellModel,
  createAvalonStatusRibbon,
} from '../avalonRoomAdapter';

type CommandContext = Parameters<typeof avalonEngine.decide>[2];

function session(humanCount: number) {
  let commandNumber = 0;
  let state: AvalonState = avalonEngine.createInitialState(
    { ...DEFAULT_AVALON_CONFIG, numberOfPlayers: 5 },
    { roomCode: '1234', hostUserId: 'host', nowMs: 1000, commandId: 'create' },
  );
  const send = (command: AvalonCommand, userId = 'host') => {
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
  for (let seat = 0; seat < humanCount; seat += 1) {
    send(
      { type: 'room.seat.take', seat, profile: { displayName: `P${seat}` } },
      seat === 0 ? 'host' : `u${seat}`,
    );
  }
  if (humanCount < 5) send({ type: 'room.seat.fillBots' });
  return {
    get state() {
      return state;
    },
    send,
  };
}

function capabilities(overrides: Partial<RoomCapabilities> = {}): RoomCapabilities {
  return {
    ...createRoomSetupCapabilities({
      isSetup: true,
      isHost: true,
      mySeat: 0,
      supportsBots: true,
      hasOccupiedSeats: true,
      isRoomFull: true,
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
    ...overrides,
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

function baseInput(state: AvalonState): AvalonRoomShellModelInput {
  return {
    roomCode: '1234',
    capabilities: capabilities(),
    onBack: jest.fn(),
    onTitlePress: jest.fn(),
    onTitleLongPress: jest.fn(),
    user: { id: 'host', avatarUrl: null },
    gachaStatus: { normalDraws: 3, goldenDraws: 2 },
    onUserActionPress: jest.fn(),
    connection: { status: 'live', pendingCommandCount: 0, onManualReconnect: jest.fn() },
    state,
    revision: 7,
    userId: 'host',
    controlledSeat: null,
    pickedSeats: new Set<number>(),
    seatsVisuallyDisabled: false,
    onSeatPress: jest.fn(),
    onBotSeatLongPress: jest.fn(),
    seatController,
    profileSelection: null,
    onProfileClose: jest.fn(),
    onProfileLeaveSeat: jest.fn(),
    share,
    isLobby: true,
    isHost: true,
    mySeat: 0,
    effectiveSeat: 0,
    onViewRolePress: jest.fn(),
    onNightInfoPress: jest.fn(),
    hostManagement: null,
    canControlBots: true,
    releaseBot: jest.fn(),
  };
}

describe('createAvalonRoomShellModel', () => {
  it('assembles the lobby shell: header sums tickets, bot lobby shows the takeover hint', () => {
    const { state } = session(3);
    const input = baseInput(state);
    const model = createAvalonRoomShellModel(input);
    expect(model.roomCode).toBe('1234');
    expect(model.header.userAction?.ticketCount).toBe(5);
    expect(model.statusRibbon).toEqual(createAvalonStatusRibbon(state));
    expect(model.seats.source.count).toBe(5);
    expect(model.seats.onBotSeatLongPress).toBe(input.onBotSeatLongPress);
    expect(model.seatConfirmation).toBeNull();
    expect(model.profile).toBeNull();
    expect(model.share).toBe(share);
    expect(model.bottomActions).toEqual({ kind: 'info', message: null, actions: [] });
    expect(model.controlledSeat).toEqual({ kind: 'hint' });
  });

  it('shows 等待房主分配角色 to a seated non-host in the lobby', () => {
    const { state } = session(5);
    const model = createAvalonRoomShellModel({
      ...baseInput(state),
      isHost: false,
      mySeat: 2,
      effectiveSeat: 2,
    });
    expect(model.bottomActions).toEqual({
      kind: 'info',
      message: '等待房主分配角色',
      actions: [],
    });
    expect(model.controlledSeat).toBeNull();
  });

  it('hints an unviewed seated player to view their role during the viewing stage', () => {
    const running = session(5);
    running.send({ type: 'avalon.game.start' });
    const input = {
      ...baseInput(running.state),
      isLobby: false,
      isHost: false,
      mySeat: 2,
      effectiveSeat: 2,
    };
    const before = createAvalonRoomShellModel(input);
    expect(before.bottomActions.kind).toBe('info');
    if (before.bottomActions.kind !== 'info') throw new Error('expected info bottom actions');
    expect(before.bottomActions.message).toBe('请点击下方「查看身份」，查看你的角色');

    running.send({ type: 'avalon.role.viewed' }, 'u2');
    const after = createAvalonRoomShellModel({ ...input, state: running.state });
    if (after.bottomActions.kind !== 'info') throw new Error('expected info bottom actions');
    expect(after.bottomActions.message).toBeNull();
  });

  it('adds the always-on view-role action once the game is running', () => {
    const running = session(5);
    running.send({ type: 'avalon.game.start' });
    const onViewRolePress = jest.fn();
    const model = createAvalonRoomShellModel({
      ...baseInput(running.state),
      isLobby: false,
      onViewRolePress,
    });
    expect(model.bottomActions.kind).toBe('info');
    if (model.bottomActions.kind !== 'info') throw new Error('expected info bottom actions');
    const viewRole = model.bottomActions.actions.find((action) => action.key === 'viewRole');
    expect(viewRole).toMatchObject({
      label: '查看身份',
      isEnabled: true,
      testID: 'avalon-view-role',
    });
    if (viewRole && viewRole.isEnabled) viewRole.onPress();
    expect(onViewRolePress).toHaveBeenCalledTimes(1);
  });

  it('pins the night info action: disabled while audio plays, confirm opens the modal after', () => {
    const running = session(5);
    running.send({ type: 'avalon.game.start' });
    for (let seat = 0; seat < 5; seat += 1) {
      running.send({ type: 'avalon.role.viewed' }, seat === 0 ? 'host' : `u${seat}`);
    }
    running.send({ type: 'avalon.game.begin' });
    const evilSeat = Number(
      Object.entries(running.state.roles).find(([, roleId]) =>
        ['morgana', 'assassin', 'mordred', 'oberon', 'minion'].includes(roleId),
      )?.[0],
    );
    const nightInput = {
      ...baseInput(running.state),
      isLobby: false,
      mySeat: evilSeat,
      effectiveSeat: evilSeat,
      userId: evilSeat === 0 ? 'host' : `u${evilSeat}`,
    };
    // Audio is still playing right after the start: the action is disabled.
    const during = createAvalonRoomShellModel(nightInput);
    if (during.bottomActions.kind !== 'info') throw new Error('expected info bottom actions');
    expect(during.bottomActions.actions.find((action) => action.key === 'nightInfo')).toMatchObject(
      {
        label: '语音播报中…',
        isEnabled: false,
        disabledReason: '语音播报尚未结束，请稍候',
        onDisabledPress: null,
        testID: 'avalon-night-info',
      },
    );
    // Drain the queued narration; the action becomes the confirm step.
    let guard = 0;
    while (running.state.isAudioPlaying && guard < 10) {
      running.send({ type: 'avalon.audio.ack' });
      guard += 1;
    }
    expect(running.state.isAudioPlaying).toBe(false);
    const onNightInfoPress = jest.fn();
    const after = createAvalonRoomShellModel({
      ...nightInput,
      state: running.state,
      onNightInfoPress,
    });
    if (after.bottomActions.kind !== 'info') throw new Error('expected info bottom actions');
    const nightInfo = after.bottomActions.actions.find((action) => action.key === 'nightInfo');
    expect(nightInfo).toMatchObject({
      label: '确认信息',
      isEnabled: true,
      testID: 'avalon-night-info',
    });
    if (nightInfo && nightInfo.isEnabled) nightInfo.onPress();
    expect(onNightInfoPress).toHaveBeenCalledTimes(1);
  });
});
