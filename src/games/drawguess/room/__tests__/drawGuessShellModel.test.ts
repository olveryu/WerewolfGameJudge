/**
 * createDrawGuessRoomShellModel characterization (AU-01): the assembled
 * model is pinned field by field from a real engine lobby state; the
 * ended panel offers the shared review to every viewer.
 */
import {
  DEFAULT_DRAWGUESS_CONFIG,
  type DrawGuessCommand,
  drawGuessEngine,
  type DrawGuessState,
} from '@game-judge/game-engine/games/drawguess/public';

import type { RoomSeatController } from '@/features/room/controllers/useRoomSeatController';
import {
  createBotTakeoverCapability,
  createRoomSetupCapabilities,
  type RoomCapabilities,
} from '@/features/room/model/RoomCapabilities';
import type { RoomViewer } from '@/features/room/model/RoomViewer';
import type { RoomReviewEntry } from '@/features/room/review/roomReviewActions';
import { playDrawGuessTestGame } from '@/test-utils/drawguessState';
import { viewerFor } from '@/test-utils/roomViewer';

import { createDrawGuessRoomShellModel } from '../drawGuessRoomAdapter';

type CommandContext = Parameters<typeof drawGuessEngine.decide>[2];

function lobbyState(withBots: boolean): DrawGuessState {
  let commandNumber = 0;
  let state: DrawGuessState = drawGuessEngine.createInitialState(
    { ...DEFAULT_DRAWGUESS_CONFIG, numberOfPlayers: 4 },
    { roomCode: '1234', hostUserId: 'host', nowMs: 1000, commandId: 'create' },
  );
  const send = (command: DrawGuessCommand, userId = 'host') => {
    const context: CommandContext = {
      actor: { kind: 'user', userId },
      controlledSeat: null,
      nowMs: 1000,
      commandId: `command:${commandNumber++}`,
      randomSeed: `seed:${commandNumber}`,
    };
    const decision = drawGuessEngine.decide(state, command, context);
    if (decision.kind === 'reject') throw new Error(`rejected: ${decision.reason}`);
    state = decision.events.reduce(drawGuessEngine.evolve, state);
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

describe('createDrawGuessRoomShellModel', () => {
  it('assembles the lobby shell from the hook projections', () => {
    const state = lobbyState(true);
    const caps = capabilities();
    const hostManagement = { task: null, sections: [] };
    const onSeatPress = jest.fn();
    const openReview = jest.fn();
    const model = createDrawGuessRoomShellModel({
      roomCode: '1234',
      viewer: { userId: 'host', isHost: true, seat: 0 },
      capabilities: caps,
      onBack: jest.fn(),
      onTitlePress: jest.fn(),
      onTitleLongPress: jest.fn(),
      user: { id: 'host', avatarUrl: null },
      gachaStatus: { normalDraws: 4, goldenDraws: 1 },
      onUserActionPress: jest.fn(),
      connection: {
        status: { kind: 'live' },
        pendingDurableCount: 0,
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
      review: null,
    });
    expect(model.roomCode).toBe('1234');
    expect(model.capabilities).toBe(caps);
    expect(model.header.userAction?.ticketCount).toBe(5);
    expect(model.seats.source.count).toBe(4);
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

    const endedModel = createDrawGuessRoomShellModel({
      roomCode: '1234',
      viewer: { userId: 'host', isHost: true, seat: 0 },
      capabilities: caps,
      onBack: jest.fn(),
      onTitlePress: jest.fn(),
      onTitleLongPress: jest.fn(),
      user: { id: 'host', avatarUrl: null },
      gachaStatus: { normalDraws: 4, goldenDraws: 1 },
      onUserActionPress: jest.fn(),
      connection: {
        status: { kind: 'live' },
        pendingDurableCount: 0,
        onRetryNow: jest.fn(),
      },
      state: { ...state, phase: { kind: 'ended', totalScores: {} } },
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
      isLobby: false,
      buildHostManagement: () => hostManagement,
      releaseBot: jest.fn(),
      review: { isEnabled: true, onPress: openReview },
    });
    expect(endedModel.phase).toBe('ended');
    const endedBottom = endedModel.bottomActions;
    if (endedBottom.kind !== 'stacked') throw new Error('expected the stacked bottom panel');
    expect(endedBottom.message).toBeNull();
    expect(endedBottom.layout.primary).toEqual([]);
    expect(endedBottom.layout.ghost).toEqual([]);
    expect(endedBottom.layout.secondary).toHaveLength(1);
    const [reviewButton] = endedBottom.layout.secondary;
    expect(reviewButton).toMatchObject({
      key: 'review',
      label: '本局复盘',
      audience: 'anyone',
      variant: 'secondary',
      testID: 'room-review-open',
      isEnabled: true,
    });
    if (reviewButton === undefined || !reviewButton.isEnabled) {
      throw new Error('expected an enabled review button');
    }
    expect(reviewButton.onPress).toBe(openReview);
  });

  it('shows 等待房主开始游戏 to a seated non-host and no hint without bots', () => {
    const state = lobbyState(false);
    const model = createDrawGuessRoomShellModel({
      roomCode: '1234',
      viewer: { userId: 'u1', isHost: false, seat: 0 },
      capabilities: capabilities(),
      onBack: jest.fn(),
      onTitlePress: jest.fn(),
      onTitleLongPress: jest.fn(),
      user: { id: 'u1', avatarUrl: null },
      gachaStatus: null,
      onUserActionPress: jest.fn(),
      connection: {
        status: { kind: 'live' },
        pendingDurableCount: 0,
        onRetryNow: jest.fn(),
      },
      state,
      revision: 1,
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
      buildHostManagement: () => null,
      releaseBot: jest.fn(),
      review: null,
    });
    expect(model.bottomActions).toEqual({
      kind: 'stacked',
      message: '等待房主开始游戏',
      progress: null,
      layout: { primary: [], secondary: [], ghost: [] },
    });
    expect(model.controlledSeat).toBeNull();
  });
});

describe('createDrawGuessRoomShellModel — roundEnd wait (PR-B G-8)', () => {
  it('shows the settlement wait to every viewer during roundEnd', () => {
    let commandNumber = 0;
    const dispatch = (
      current: DrawGuessState,
      command: DrawGuessCommand,
      opts: { readonly userId?: string; readonly system?: boolean; readonly nowMs?: number } = {},
    ): DrawGuessState => {
      const shared = {
        controlledSeat: null,
        nowMs: opts.nowMs ?? 1000,
        commandId: `command:${commandNumber++}`,
        randomSeed: `seed:${commandNumber}`,
      };
      const context: CommandContext =
        opts.system === true
          ? { ...shared, actor: { kind: 'system', effectId: 'effect:1' } }
          : { ...shared, actor: { kind: 'user', userId: opts.userId ?? 'host' } };
      const decision = drawGuessEngine.decide(current, command, context);
      if (decision.kind === 'reject') throw new Error(`rejected: ${decision.reason}`);
      return decision.events.reduce(drawGuessEngine.evolve, current);
    };
    let state = lobbyState(true);
    state = dispatch(state, { type: 'drawguess.game.begin' });
    state = dispatch(
      state,
      {
        type: 'drawguess.words.dealt',
        turnIndex: 0,
        choices: [
          { word: '苹果', pinyinInitials: 'p g' },
          { word: '香蕉', pinyinInitials: 'x j' },
          { word: '西瓜', pinyinInitials: 'x g' },
        ],
      },
      { system: true },
    );
    if (state.phase.kind !== 'wordSelect') throw new Error('expected wordSelect phase');
    state = dispatch(state, {
      type: 'drawguess.word.choose',
      word: '苹果',
      phaseRevision: state.phaseRevision,
      turnIndex: state.turnIndex,
    });
    const drawing = state.phase;
    if (drawing.kind !== 'drawing') throw new Error('expected drawing phase');
    state = dispatch(
      state,
      { type: 'drawguess.phase.settleExpired' },
      { system: true, nowMs: drawing.deadlineAt },
    );
    if (state.phase.kind !== 'roundEnd') throw new Error('expected roundEnd phase');
    const model = createDrawGuessRoomShellModel({
      roomCode: '1234',
      viewer: { userId: 'host', isHost: true, seat: 0 },
      capabilities: capabilities(),
      onBack: jest.fn(),
      onTitlePress: jest.fn(),
      onTitleLongPress: jest.fn(),
      user: { id: 'host', avatarUrl: null },
      gachaStatus: { normalDraws: 4, goldenDraws: 1 },
      onUserActionPress: jest.fn(),
      connection: {
        status: { kind: 'live' },
        pendingDurableCount: 0,
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
      review: null,
    });
    expect(model.bottomActions).toMatchObject({ kind: 'stacked', message: '等待本轮结算' });
  });
});

describe('createDrawGuessRoomShellModel — ended review entry', () => {
  const ended = playDrawGuessTestGame([]);

  function endedShell(viewer: RoomViewer, review: RoomReviewEntry | null) {
    return createDrawGuessRoomShellModel({
      roomCode: ended.roomCode,
      viewer,
      capabilities: capabilities(),
      onBack: jest.fn(),
      onTitlePress: jest.fn(),
      onTitleLongPress: jest.fn(),
      user: { id: viewer.userId, avatarUrl: null },
      gachaStatus: null,
      onUserActionPress: jest.fn(),
      connection: {
        status: { kind: 'live' },
        pendingDurableCount: 0,
        onRetryNow: jest.fn(),
      },
      state: ended,
      revision: 40,
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
      buildHostManagement: () => null,
      releaseBot: jest.fn(),
      review,
    });
  }

  it('offers the review to a spectator as well', () => {
    const model = endedShell(viewerFor('spectator'), { isEnabled: true, onPress: jest.fn() });
    expect(model.bottomActions).toMatchObject({
      kind: 'stacked',
      message: null,
      layout: { primary: [], secondary: [{ key: 'review', audience: 'anyone' }], ghost: [] },
    });
  });

  it('fails fast when an ended room has no review entry', () => {
    expect(() => endedShell(viewerFor('seated'), null)).toThrow(
      '[FAIL-FAST] DrawGuess ended without a review entry',
    );
  });
});
