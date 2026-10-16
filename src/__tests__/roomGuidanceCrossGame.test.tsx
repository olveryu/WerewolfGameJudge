/**
 * Cross-game console contract (redesign §7): for every game, the host's
 * blocked primary reason renders exactly once on screen — in the
 * collapsed console caption — and never again inside the expanded host
 * panel, whose primary action renders without a caption. Both surfaces
 * read the same host-management model the game's adapter produced from
 * a real engine state.
 */
import {
  DEFAULT_DEMO_CONFIG,
  type DemoCommand,
  demoEngine,
  type DemoState,
} from '@game-judge/game-engine/games/demo/public';
import {
  DEFAULT_DRAWGUESS_CONFIG,
  type DrawGuessCommand,
  drawGuessEngine,
  type DrawGuessState,
} from '@game-judge/game-engine/games/drawguess/public';
import {
  DEFAULT_STORY_RELAY_CONFIG,
  parseStoryRelayState,
  type StoryRelayCommand,
  storyRelayEngine,
  type StoryRelayState,
} from '@game-judge/game-engine/games/storyrelay/public';
import { render } from '@testing-library/react-native';

import { RoomBottomActionPanel } from '@/features/room/components/RoomBottomActionPanel';
import { RoomHostManagementPanel } from '@/features/room/components/RoomHostManagementPanel';
import { createRoomFeatureStyles } from '@/features/room/components/styles';
import type { RoomSeatController } from '@/features/room/controllers/useRoomSeatController';
import {
  createBotTakeoverCapability,
  createRoomSetupCapabilities,
  type RoomCapabilities,
} from '@/features/room/model/RoomCapabilities';
import type { RoomShellModel } from '@/features/room/model/RoomShellModel';
import {
  createDemoHostManagement,
  createDemoRoomShellModel,
} from '@/games/demo/room/demoRoomAdapter';
import {
  createDrawGuessHostManagement,
  createDrawGuessRoomShellModel,
} from '@/games/drawguess/room/drawGuessRoomAdapter';
import {
  createStoryRelayHostManagement,
  createStoryRelayRoomShellModel,
} from '@/games/storyrelay/room/storyRelayRoomAdapter';
import { colors } from '@/theme';

const featureStyles = createRoomFeatureStyles(colors);

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

const submit = jest.fn(async () => true);

function shellInput() {
  return {
    roomCode: '1234',
    capabilities: capabilities(),
    onBack: jest.fn(),
    onTitlePress: jest.fn(),
    onTitleLongPress: jest.fn(),
    user: { id: 'host', avatarUrl: null },
    gachaStatus: null,
    onUserActionPress: jest.fn(),
    connection: { status: 'live' as const, pendingCommandCount: 0, onManualReconnect: jest.fn() },
    revision: 1,
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
    isLobby: true,
    isHost: true,
    mySeat: 0,
    releaseBot: jest.fn(),
  };
}

function renderSurfaces(shell: RoomShellModel) {
  const bottom = render(
    <RoomBottomActionPanel
      model={shell.bottomActions}
      hostManagement={shell.hostManagement}
      onOpenHostManagement={jest.fn()}
      styles={featureStyles.bottomActionPanel}
      progressStyles={featureStyles.progressIndicator}
      bottomInset={0}
    />,
  );
  return bottom;
}

function renderPanel(shell: RoomShellModel) {
  if (shell.hostManagement === null) throw new Error('expected a host management model');
  return render(
    <RoomHostManagementPanel
      model={shell.hostManagement}
      isVisible
      presentation="inspector"
      onClose={jest.fn()}
    />,
  );
}

function expectReasonExactlyOnce(shell: RoomShellModel, reason: string, primaryLabel: string) {
  const bottom = renderSurfaces(shell);
  expect(bottom.queryAllByText(reason)).toHaveLength(1);
  // The blocked console shows the primary's own label above its reason.
  expect(bottom.getByText(primaryLabel)).toBeTruthy();
  bottom.unmount();
  const panel = renderPanel(shell);
  // The expanded panel renders the same primary action without its
  // caption: the reason lives only in the collapsed console.
  expect(panel.queryAllByText(reason)).toHaveLength(0);
  panel.unmount();
}

function expectReadyConsole(shell: RoomShellModel, primaryLabel: string) {
  const bottom = renderSurfaces(shell);
  expect(bottom.getByText(`下一步：${primaryLabel}`)).toBeTruthy();
  bottom.unmount();
}

// --- Demo (identity flow: lobby assign, then viewing begin) ---

type DemoContext = Parameters<typeof demoEngine.decide>[2];

function driveDemo(state: DemoState, command: DemoCommand): DemoState {
  const context: DemoContext = {
    actor: { kind: 'user', userId: 'host' },
    controlledSeat: null,
    nowMs: 1000,
    commandId: command.type,
    randomSeed: 'seed',
  };
  const decision = demoEngine.decide(state, command, context);
  if (decision.kind === 'reject') throw new Error(`rejected: ${decision.reason}`);
  return decision.events.reduce(demoEngine.evolve, state);
}

function demoState(full: boolean): DemoState {
  let state = demoEngine.createInitialState(
    { ...DEFAULT_DEMO_CONFIG, numberOfPlayers: 4 },
    { roomCode: '1234', hostUserId: 'host', nowMs: 1000, commandId: 'create' },
  );
  state = driveDemo(state, { type: 'room.seat.take', seat: 0, profile: { displayName: '房主' } });
  if (full) state = driveDemo(state, { type: 'room.seat.fillBots' });
  return state;
}

function demoShell(state: DemoState): RoomShellModel {
  return createDemoRoomShellModel({
    ...shellInput(),
    state,
    hostManagement: createDemoHostManagement({
      state,
      isHost: true,
      capabilities: capabilities(),
      isSubmitting: false,
      submit,
    }),
  });
}

// --- DrawGuess (stage flow: lobby start) ---

type DrawGuessContext = Parameters<typeof drawGuessEngine.decide>[2];

function drawGuessState(full: boolean): DrawGuessState {
  let state = drawGuessEngine.createInitialState(
    { ...DEFAULT_DRAWGUESS_CONFIG, numberOfPlayers: 4 },
    { roomCode: '1234', hostUserId: 'host', nowMs: 1000, commandId: 'create' },
  );
  const send = (command: DrawGuessCommand) => {
    const context: DrawGuessContext = {
      actor: { kind: 'user', userId: 'host' },
      controlledSeat: null,
      nowMs: 1000,
      commandId: command.type,
      randomSeed: 'seed',
    };
    const decision = drawGuessEngine.decide(state, command, context);
    if (decision.kind === 'reject') throw new Error(`rejected: ${decision.reason}`);
    state = decision.events.reduce(drawGuessEngine.evolve, state);
  };
  send({ type: 'room.seat.take', seat: 0, profile: { displayName: '房主' } });
  if (full) send({ type: 'room.seat.fillBots' });
  return state;
}

function drawGuessShell(state: DrawGuessState): RoomShellModel {
  return createDrawGuessRoomShellModel({
    ...shellInput(),
    state,
    hostManagement: createDrawGuessHostManagement({
      state,
      isHost: true,
      capabilities: capabilities(),
      isSubmitting: false,
      submit,
    }),
  });
}

// --- StoryRelay (stage flow: lobby start) ---

type StoryRelayContext = Parameters<typeof storyRelayEngine.decide>[2];

function storyRelayState(full: boolean): StoryRelayState {
  let state = storyRelayEngine.createInitialState(
    { ...DEFAULT_STORY_RELAY_CONFIG, numberOfPlayers: 4, transitionDurationSeconds: 0 },
    { roomCode: '1234', hostUserId: 'host', nowMs: 1000, commandId: 'create' },
  );
  const send = (command: StoryRelayCommand) => {
    const context: StoryRelayContext = {
      actor: { kind: 'user', userId: 'host' },
      controlledSeat: null,
      nowMs: 1000,
      commandId: command.type,
      randomSeed: 'seed',
    };
    const decision = storyRelayEngine.decide(state, command, context);
    if (decision.kind === 'reject') throw new Error(`rejected: ${decision.reason}`);
    state = parseStoryRelayState(
      JSON.parse(
        JSON.stringify(
          storyRelayEngine.normalize(decision.events.reduce(storyRelayEngine.evolve, state)),
        ),
      ),
    );
  };
  send({ type: 'room.seat.take', seat: 0, profile: { displayName: '房主' } });
  if (full) send({ type: 'room.seat.fillBots' });
  return state;
}

function storyRelayShell(state: StoryRelayState): RoomShellModel {
  return createStoryRelayRoomShellModel({
    ...shellInput(),
    state,
    hostManagement: createStoryRelayHostManagement({
      state,
      isHost: true,
      capabilities: capabilities(),
      isSubmitting: false,
      submit,
    }),
  });
}

describe('room guidance console: one reason, one screen (cross-game)', () => {
  it('demo: the not-full reason renders once in the console and never in the panel', () => {
    expectReasonExactlyOnce(demoShell(demoState(false)), '座位尚未坐满（还差 3 人）', '分配身份');
  });

  it('demo: a full lobby offers the assign console action with no blocked reason', () => {
    const shell = demoShell(demoState(true));
    const bottom = renderSurfaces(shell);
    expect(bottom.getByText('下一步：分配身份')).toBeTruthy();
    expect(bottom.queryAllByText(/座位尚未坐满/)).toHaveLength(0);
    bottom.unmount();
  });

  it('demo: the viewing begin reason renders once in the console and never in the panel', () => {
    let state = demoState(true);
    state = driveDemo(state, { type: 'demo.game.start' });
    expectReasonExactlyOnce(demoShell(state), '还有玩家未查看身份', '开始游戏');
  });

  it('drawguess: the not-full reason renders once in the console and never in the panel', () => {
    expectReasonExactlyOnce(
      drawGuessShell(drawGuessState(false)),
      '座位尚未坐满（还差 3 人）',
      '开始游戏',
    );
  });

  it('drawguess: a full lobby offers the start console action', () => {
    expectReadyConsole(drawGuessShell(drawGuessState(true)), '开始游戏');
  });

  it('storyrelay: the not-full reason renders once in the console and never in the panel', () => {
    expectReasonExactlyOnce(
      storyRelayShell(storyRelayState(false)),
      '座位尚未坐满（还差 3 人）',
      '开始游戏',
    );
  });

  it('storyrelay: a full lobby offers the start console action', () => {
    expectReadyConsole(storyRelayShell(storyRelayState(true)), '开始游戏');
  });
});
