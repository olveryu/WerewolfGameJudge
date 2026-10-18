/**
 * createAvalonRoomShellModel characterization (AU-01): the assembled
 * model is pinned field by field from real engine states — a lobby with
 * bots (takeover hint live) and a started night (view-role action live).
 */
import {
  avalonEngine,
  type AvalonPublicCommand,
  type AvalonState,
  DEFAULT_AVALON_CONFIG,
  getAvalonNightParticipants,
} from '@game-judge/game-engine/games/avalon/public';

import type { RoomSeatController } from '@/features/room/controllers/useRoomSeatController';
import type { RoomBottomStackModel } from '@/features/room/model/RoomBottomActions';
import {
  createBotTakeoverCapability,
  createRoomSetupCapabilities,
  type RoomCapabilities,
} from '@/features/room/model/RoomCapabilities';

import {
  type AvalonRoomShellModelInput,
  createAvalonRoomShellModel,
  deriveAvalonBottomProgress,
} from '../avalonRoomAdapter';

type CommandContext = Parameters<typeof avalonEngine.decide>[2];

function session(humanCount: number) {
  let commandNumber = 0;
  let state: AvalonState = avalonEngine.createInitialState(
    { ...DEFAULT_AVALON_CONFIG, numberOfPlayers: 5 },
    { roomCode: '1234', hostUserId: 'host', nowMs: 1000, commandId: 'create' },
  );
  const send = (command: AvalonPublicCommand, userId = 'host') => {
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
    isSubmitting: false,
    settleCountdownSeconds: null,
    onOpenVotePress: jest.fn(),
    onOpenQuestPress: jest.fn(),
    onProposeTeamPress: jest.fn(),
    onLadyAcknowledgePress: jest.fn(),
    onLadyResultPress: jest.fn(),
    onEarlyStrikePress: jest.fn(),
    strikePickMode: false,
    onCancelEarlyStrikePress: jest.fn(),
    hostManagement: null,
    canControlBots: true,
    releaseBot: jest.fn(),
  };
}

describe('createAvalonRoomShellModel', () => {
  it('assembles the lobby shell: header sums tickets, no banner without a takeover', () => {
    const { state } = session(3);
    const input = baseInput(state);
    const model = createAvalonRoomShellModel(input);
    expect(model.roomCode).toBe('1234');
    expect(model.header.userAction?.ticketCount).toBe(5);
    expect(model.seats.source.count).toBe(5);
    expect(model.seats.onBotSeatLongPress).toBe(input.onBotSeatLongPress);
    expect(model.seatConfirmation).toBeNull();
    expect(model.profile).toBeNull();
    expect(model.share).toBe(share);
    expect(model.bottomActions).toEqual({
      kind: 'stacked',
      message: null,
      progress: null,
      layout: { primary: [], secondary: [], ghost: [] },
    });
    expect(model.controlledSeat).toBeNull();
  });

  it('exposes the current phase kind on the shell model', () => {
    const lobby = session(3);
    expect(createAvalonRoomShellModel(baseInput(lobby.state)).phase).toBe('lobby');
    const running = session(5);
    running.send({ type: 'avalon.game.start' });
    expect(createAvalonRoomShellModel(baseInput(running.state)).phase).toBe('viewing');
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
      kind: 'stacked',
      message: '等待房主分配角色',
      progress: null,
      layout: { primary: [], secondary: [], ghost: [] },
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
    expect(before.bottomActions.kind).toBe('stacked');
    if (before.bottomActions.kind !== 'stacked') throw new Error('expected stacked bottom actions');
    expect(before.bottomActions.message).toBe('请点击下方「查看身份」，查看你的角色');

    running.send({ type: 'avalon.role.viewed' }, 'u2');
    const after = createAvalonRoomShellModel({ ...input, state: running.state });
    if (after.bottomActions.kind !== 'stacked') throw new Error('expected stacked bottom actions');
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
    expect(model.bottomActions.kind).toBe('stacked');
    if (model.bottomActions.kind !== 'stacked') throw new Error('expected stacked bottom actions');
    // Tier contract: the persistent view-identity tool lives in the
    // ghost tier on its own row, never in a stage-action tier.
    expect(model.bottomActions.layout.primary).toEqual([]);
    expect(model.bottomActions.layout.secondary).toEqual([]);
    const viewRole = model.bottomActions.layout.ghost.find((action) => action.key === 'viewRole');
    expect(viewRole).toMatchObject({
      label: '查看身份',
      variant: 'ghost',
      size: 'md',
      isEnabled: true,
      testID: 'avalon-view-role',
    });
    if (viewRole && viewRole.isEnabled) viewRole.onPress();
    expect(onViewRolePress).toHaveBeenCalledTimes(1);
  });

  it('pins the night info action: confirm stays available while audio plays', () => {
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
    const onNightInfoPress = jest.fn();
    const nightInput = {
      ...baseInput(running.state),
      isLobby: false,
      mySeat: evilSeat,
      effectiveSeat: evilSeat,
      userId: evilSeat === 0 ? 'host' : `u${evilSeat}`,
      onNightInfoPress,
    };
    // Confirmation runs parallel to the narration: right after the
    // start, while the audio is still playing, the action is already
    // the enabled confirm step (no disabled audio-waiting placeholder).
    expect(running.state.isAudioPlaying).toBe(true);
    const during = createAvalonRoomShellModel(nightInput);
    if (during.bottomActions.kind !== 'stacked') throw new Error('expected stacked bottom actions');
    const duringInfo = during.bottomActions.layout.primary.find(
      (action) => action.key === 'nightInfo',
    );
    // Tier regression pin (the reported bug): at night the stage
    // action 确认信息 sits in the primary tier while the persistent
    // 查看身份 sits in the ghost tier — different rows, never one row.
    expect(during.bottomActions.layout.primary.map((action) => action.key)).toEqual(['nightInfo']);
    expect(during.bottomActions.layout.ghost.map((action) => action.key)).toEqual(['viewRole']);
    expect(duringInfo).toMatchObject({
      label: '确认信息',
      isEnabled: true,
      testID: 'avalon-night-info',
    });
    if (duringInfo && duringInfo.isEnabled) duringInfo.onPress();
    expect(onNightInfoPress).toHaveBeenCalledTimes(1);
    // The night step progress rides the bottom model during the night.
    expect(during.bottomActions.progress).toEqual(deriveAvalonBottomProgress(running.state));
    expect(during.bottomActions.progress).not.toBeNull();
    // Drain the queued narration; the confirm action stays the same.
    let guard = 0;
    while (running.state.isAudioPlaying && guard < 10) {
      running.send({ type: 'avalon.audio.ack' });
      guard += 1;
    }
    expect(running.state.isAudioPlaying).toBe(false);
    const after = createAvalonRoomShellModel({ ...nightInput, state: running.state });
    if (after.bottomActions.kind !== 'stacked') throw new Error('expected stacked bottom actions');
    const nightInfo = after.bottomActions.layout.primary.find(
      (action) => action.key === 'nightInfo',
    );
    expect(nightInfo).toMatchObject({
      label: '确认信息',
      isEnabled: true,
      testID: 'avalon-night-info',
    });
    if (nightInfo && nightInfo.isEnabled) nightInfo.onPress();
    expect(onNightInfoPress).toHaveBeenCalledTimes(2);
  });

  it('lets a night participant confirm while the narration is still queued', () => {
    const running = session(5);
    running.send({ type: 'avalon.game.start' });
    for (let seat = 0; seat < 5; seat += 1) {
      running.send({ type: 'avalon.role.viewed' }, seat === 0 ? 'host' : `u${seat}`);
    }
    running.send({ type: 'avalon.game.begin' });
    // The opening narration is queued and playing; nobody has acked yet.
    expect(running.state.isAudioPlaying).toBe(true);
    expect(running.state.pendingAudioEffects.length).toBeGreaterThan(0);
    const evilSeat = Number(
      Object.entries(running.state.roles).find(([, roleId]) =>
        ['morgana', 'assassin', 'mordred', 'oberon', 'minion'].includes(roleId),
      )?.[0],
    );
    const onNightInfoPress = jest.fn();
    const model = createAvalonRoomShellModel({
      ...baseInput(running.state),
      isLobby: false,
      mySeat: evilSeat,
      effectiveSeat: evilSeat,
      userId: evilSeat === 0 ? 'host' : `u${evilSeat}`,
      onNightInfoPress,
    });
    if (model.bottomActions.kind !== 'stacked') throw new Error('expected stacked bottom actions');
    const nightInfo = model.bottomActions.layout.primary.find(
      (action) => action.key === 'nightInfo',
    );
    expect(nightInfo).toMatchObject({
      label: '确认信息',
      isEnabled: true,
      testID: 'avalon-night-info',
    });
    if (nightInfo && nightInfo.isEnabled) nightInfo.onPress();
    expect(onNightInfoPress).toHaveBeenCalledTimes(1);
    // The confirm command itself dispatches and is recorded while the
    // audio gate is still open; the step settles only once the host ack
    // also lands (confirm-first and ack-first are equivalent by design).
    running.send({ type: 'avalon.night.confirm' }, seatUser(evilSeat));
    expect(running.state.isAudioPlaying).toBe(true);
    if (running.state.phase.kind !== 'night') throw new Error('expected night phase');
    expect(running.state.phase.confirmedSeats).toContain(evilSeat);
  });
});

const seatUser = (seat: number) => (seat === 0 ? 'host' : `u${seat}`);

/** Starts a five-human game and walks it through viewing + night into nominate. */
function daytimeSession() {
  const running = session(5);
  running.send({ type: 'avalon.game.start' });
  for (let seat = 0; seat < 5; seat += 1) {
    running.send({ type: 'avalon.role.viewed' }, seatUser(seat));
  }
  running.send({ type: 'avalon.game.begin' });
  if (running.state.isAudioPlaying) running.send({ type: 'avalon.audio.ack' }, 'host');
  for (const step of ['evilReveal', 'merlinReveal', 'percivalReveal'] as const) {
    if (running.state.phase.kind !== 'night') break;
    for (const seat of getAvalonNightParticipants(running.state.roles, step)) {
      running.send({ type: 'avalon.night.confirm' }, seatUser(seat));
    }
    if (running.state.isAudioPlaying) running.send({ type: 'avalon.audio.ack' }, 'host');
  }
  if (running.state.phase.kind !== 'nominate') throw new Error('expected nominate phase');
  return running;
}

type RunningSession = ReturnType<typeof daytimeSession>;

/**
 * Nine-human game walked into nominate. The lady of the lake only exists in
 * 9/10-player games (engine rule), so lady assertions need this table size.
 */
function ninePlayerDaytimeSession(): RunningSession {
  let commandNumber = 0;
  let state: AvalonState = avalonEngine.createInitialState(
    { ...DEFAULT_AVALON_CONFIG, numberOfPlayers: 9 },
    { roomCode: '1234', hostUserId: 'host', nowMs: 1000, commandId: 'create' },
  );
  const send = (command: AvalonPublicCommand, userId = 'host') => {
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
  for (let seat = 0; seat < 9; seat += 1) {
    send({ type: 'room.seat.take', seat, profile: { displayName: `P${seat}` } }, seatUser(seat));
  }
  send({ type: 'avalon.game.start' });
  for (let seat = 0; seat < 9; seat += 1) {
    send({ type: 'avalon.role.viewed' }, seatUser(seat));
  }
  send({ type: 'avalon.game.begin' });
  if (state.isAudioPlaying) send({ type: 'avalon.audio.ack' }, 'host');
  for (const step of ['evilReveal', 'merlinReveal', 'percivalReveal'] as const) {
    if (state.phase.kind !== 'night') break;
    for (const seat of getAvalonNightParticipants(state.roles, step)) {
      send({ type: 'avalon.night.confirm' }, seatUser(seat));
    }
    if (state.isAudioPlaying) send({ type: 'avalon.audio.ack' }, 'host');
  }
  if (state.phase.kind !== 'nominate') throw new Error('expected nominate phase');
  return {
    get state() {
      return state;
    },
    send,
  };
}

function shellFor(
  running: RunningSession,
  seat: number,
  overrides: Partial<AvalonRoomShellModelInput> = {},
) {
  const model = createAvalonRoomShellModel({
    ...baseInput(running.state),
    isLobby: false,
    isHost: seat === 0,
    mySeat: seat,
    effectiveSeat: seat,
    userId: seatUser(seat),
    ...overrides,
  });
  if (model.bottomActions.kind !== 'stacked') throw new Error('expected stacked bottom actions');
  return model.bottomActions;
}

/** Finds a stage action by key across the stage tiers (primary + secondary). */
function findStageAction(bottom: RoomBottomStackModel, key: string) {
  return [...bottom.layout.primary, ...bottom.layout.secondary].find(
    (action) => action.key === key,
  );
}

/** Finds a stage action by key in one exact tier (tier-ownership pins). */
function findTierAction(bottom: RoomBottomStackModel, tier: 'primary' | 'secondary', key: string) {
  return bottom.layout[tier].find((action) => action.key === key);
}

function roleSeat(running: RunningSession, roleId: string): number {
  const entry = Object.entries(running.state.roles).find(([, id]) => id === roleId);
  if (!entry) throw new Error(`role ${roleId} not dealt`);
  return Number(entry[0]);
}

function evilSeats(running: RunningSession): number[] {
  return Object.entries(running.state.roles)
    .filter(([, id]) => ['assassin', 'morgana', 'mordred', 'oberon', 'minion'].includes(id))
    .map(([seat]) => Number(seat));
}

/** Plays one quest round to completion: leader proposes, all approve, team plays, host settles. */
function playQuestRound(running: RunningSession, failSeats: ReadonlySet<number> = new Set()) {
  const state = running.state;
  if (state.phase.kind !== 'nominate') throw new Error('expected nominate phase');
  const leader = state.leaderSeat;
  const required = state.phase.requiredSize;
  const playerCount = state.config.numberOfPlayers;
  const team: number[] = [leader];
  for (let seat = 0; team.length < required; seat += 1) {
    if (!team.includes(seat)) team.push(seat);
  }
  running.send({ type: 'avalon.team.updateDraft', seats: team }, seatUser(leader));
  running.send({ type: 'avalon.team.propose' }, seatUser(leader));
  for (let seat = 0; seat < playerCount; seat += 1) {
    running.send({ type: 'avalon.team.vote', vote: 'approve' }, seatUser(seat));
  }
  running.send({ type: 'avalon.vote.finish' });
  if (running.state.phase.kind !== 'quest') throw new Error('expected quest phase');
  for (const seat of team) {
    running.send(
      { type: 'avalon.quest.play', play: failSeats.has(seat) ? 'fail' : 'success' },
      seatUser(seat),
    );
  }
  running.send({ type: 'avalon.quest.finish' });
  return team;
}

/** Completes the lady check when the lady phase is showing; returns holder + target. */
function completeLadyIfPresent(running: RunningSession) {
  if (running.state.phase.kind !== 'lady') return null;
  const { holderSeat, examinedSeats } = running.state.phase;
  const seats = Array.from({ length: running.state.config.numberOfPlayers }, (_, seat) => seat);
  const target = seats.find((seat) => seat !== holderSeat && !examinedSeats.includes(seat));
  if (target === undefined) throw new Error('no eligible lady target');
  running.send({ type: 'avalon.lady.check', seat: target }, seatUser(holderSeat));
  running.send({ type: 'avalon.lady.acknowledge' }, seatUser(target));
  return { holderSeat, target };
}

describe('createAvalonRoomShellModel — daytime bottom actions', () => {
  it('nominate: the leader gets pick guidance and a propose button gated on the required size', () => {
    const running = daytimeSession();
    const leader = running.state.leaderSeat;
    const onProposeTeamPress = jest.fn();
    const empty = shellFor(running, leader, { onProposeTeamPress });
    expect(empty.message).toContain('点座位盘点选');
    const propose = findStageAction(empty, 'proposeTeam');
    expect(propose).toMatchObject({
      label: '提交队伍',
      isEnabled: false,
      disabledReason: '队员人数必须为 2 人',
      testID: 'avalon-nominate-submit',
    });
    // Tier ownership: propose is the stage main action — primary tier.
    expect(findTierAction(empty, 'primary', 'proposeTeam')).toBe(propose);
    expect(findTierAction(empty, 'secondary', 'proposeTeam')).toBeUndefined();
    // 草稿满员经服务端草稿驱动（队长 updateDraft 后 VM 投影 draftSeats）。
    running.send(
      { type: 'avalon.team.updateDraft', seats: [leader, (leader + 1) % 5] },
      seatUser(leader),
    );
    const full = shellFor(running, leader, { onProposeTeamPress });
    const ready = findStageAction(full, 'proposeTeam');
    expect(ready).toMatchObject({ label: '提交队伍', isEnabled: true });
    if (ready && ready.isEnabled) ready.onPress();
    expect(onProposeTeamPress).toHaveBeenCalledTimes(1);
  });

  it('nominate: a non-leader waits and gets no propose button', () => {
    const running = daytimeSession();
    const leader = running.state.leaderSeat;
    const other = (leader + 1) % 5;
    const bottom = shellFor(running, other);
    expect(bottom.message).toBe(`等待队长组队（${leader + 1} 号座位），本轮需要 2 名队员。`);
    expect(findStageAction(bottom, 'proposeTeam')).toBeUndefined();
  });

  it('early strike: only the assassin carries the strike button during the day', () => {
    const running = daytimeSession();
    const assassin = roleSeat(running, 'assassin');
    const onEarlyStrikePress = jest.fn();
    const assassinBottom = shellFor(running, assassin, { onEarlyStrikePress });
    const strike = findStageAction(assassinBottom, 'earlyStrike');
    expect(strike).toMatchObject({ label: '刺杀', isEnabled: true, testID: 'avalon-early-strike' });
    expect(findTierAction(assassinBottom, 'primary', 'earlyStrike')).toBe(strike);
    if (strike && strike.isEnabled) strike.onPress();
    expect(onEarlyStrikePress).toHaveBeenCalledTimes(1);
    const merlinBottom = shellFor(running, roleSeat(running, 'merlin'));
    expect(findStageAction(merlinBottom, 'earlyStrike')).toBeUndefined();
  });

  it('early strike pick mode: bottom area is the seat-board pick prompt with only a cancel action', () => {
    const running = daytimeSession();
    const assassin = roleSeat(running, 'assassin');
    const onCancelEarlyStrikePress = jest.fn();
    const bottom = shellFor(running, assassin, { strikePickMode: true, onCancelEarlyStrikePress });
    expect(bottom.message).toBe(
      '点座位盘点选一名玩家进行提前刺杀（除自己外任意座位），点选后会再次确认。刺中梅林坏人直接获胜，刺错好人直接获胜。',
    );
    // 独占底部区：只剩局内常驻「查看身份」与取消入口，阶段主按钮（如提交队伍）不出现。
    // 层级归属：查看身份在 ghost 层独行，取消刺杀在 secondary 层，primary 为空。
    expect(bottom.layout.ghost.map((action) => action.key)).toEqual(['viewRole']);
    expect(bottom.layout.secondary.map((action) => action.key)).toEqual(['earlyStrike']);
    expect(bottom.layout.primary).toEqual([]);
    const cancel = findStageAction(bottom, 'earlyStrike');
    expect(cancel).toMatchObject({
      label: '取消刺杀',
      isEnabled: true,
      testID: 'avalon-early-strike',
    });
    if (cancel && cancel.isEnabled) cancel.onPress();
    expect(onCancelEarlyStrikePress).toHaveBeenCalledTimes(1);
  });

  it('vote: voters get the open button, their ballot in the message, then the armed countdown', () => {
    const running = daytimeSession();
    const leader = running.state.leaderSeat;
    const team = [leader, (leader + 1) % 5];
    running.send({ type: 'avalon.team.updateDraft', seats: team }, seatUser(leader));
    running.send({ type: 'avalon.team.propose' }, seatUser(leader));
    const voter = leader;
    const onOpenVotePress = jest.fn();
    const before = shellFor(running, voter, { onOpenVotePress });
    const open = findStageAction(before, 'openVote');
    expect(open).toMatchObject({ label: '去投票', isEnabled: true, testID: 'avalon-vote-open' });
    expect(findTierAction(before, 'primary', 'openVote')).toBe(open);
    if (open && open.isEnabled) open.onPress();
    expect(onOpenVotePress).toHaveBeenCalledTimes(1);
    running.send({ type: 'avalon.team.vote', vote: 'approve' }, seatUser(voter));
    const cast = shellFor(running, voter);
    expect(findStageAction(cast, 'openVote')).toMatchObject({
      label: '修改投票',
    });
    expect(cast.message).toBe('你已投：赞成（揭晓前可改票）· 已投 1/5');
    for (let seat = 0; seat < 5; seat += 1) {
      if (seat !== voter)
        running.send({ type: 'avalon.team.vote', vote: 'approve' }, seatUser(seat));
    }
    if (running.state.phase.kind !== 'vote' || running.state.phase.deadlineAt === null) {
      throw new Error('expected the armed vote phase');
    }
    const armed = shellFor(running, voter, { settleCountdownSeconds: 4 });
    expect(armed.message).toBe('已全部投票，4 秒后揭晓');
  });

  it('quest: only team members get the play button, and no card content ever leaks', () => {
    const running = daytimeSession();
    const leader = running.state.leaderSeat;
    const evil = evilSeats(running).find((seat) => seat !== leader);
    if (evil === undefined) throw new Error('expected an evil seat besides the leader');
    const team = [leader, evil];
    running.send({ type: 'avalon.team.updateDraft', seats: team }, seatUser(leader));
    running.send({ type: 'avalon.team.propose' }, seatUser(leader));
    for (let seat = 0; seat < 5; seat += 1) {
      running.send({ type: 'avalon.team.vote', vote: 'approve' }, seatUser(seat));
    }
    running.send({ type: 'avalon.vote.finish' });
    const outsider = [0, 1, 2, 3, 4].find((seat) => !team.includes(seat));
    if (outsider === undefined) throw new Error('expected a non-team seat');
    const outsiderBottom = shellFor(running, outsider);
    expect(findStageAction(outsiderBottom, 'openQuest')).toBeUndefined();
    expect(outsiderBottom.message).toBe('等待队员出牌…');
    const memberBottom = shellFor(running, evil);
    expect(findStageAction(memberBottom, 'openQuest')).toMatchObject({
      label: '去出牌',
      testID: 'avalon-quest-open',
    });
    expect(findTierAction(memberBottom, 'primary', 'openQuest')).toBeDefined();
    expect(findTierAction(memberBottom, 'secondary', 'openQuest')).toBeUndefined();
    running.send({ type: 'avalon.quest.play', play: 'fail' }, seatUser(evil));
    const played = shellFor(running, evil);
    expect(findStageAction(played, 'openQuest')).toMatchObject({
      label: '修改出牌',
    });
    expect(played.message).toBe('你已出牌，等待揭晓');
    expect(played.message).not.toContain('失败');
  });

  it('lady: holder guidance, target acknowledge button, and a holder-only result reopen', () => {
    const running = ninePlayerDaytimeSession();
    playQuestRound(running);
    playQuestRound(running);
    if (running.state.phase.kind !== 'lady') throw new Error('expected the lady phase');
    const { holderSeat, examinedSeats } = running.state.phase;
    const holderBottom = shellFor(running, holderSeat);
    expect(holderBottom.message).toContain('点座位盘点选');
    expect(holderBottom.message).toContain('查验');
    const seats = Array.from({ length: 9 }, (_, seat) => seat);
    const target = seats.find((seat) => seat !== holderSeat && !examinedSeats.includes(seat));
    if (target === undefined) throw new Error('no eligible lady target');
    running.send({ type: 'avalon.lady.check', seat: target }, seatUser(holderSeat));
    const onLadyAcknowledgePress = jest.fn();
    const targetBottom = shellFor(running, target, { onLadyAcknowledgePress });
    expect(targetBottom.message).toContain('要查验你的阵营');
    const ack = findStageAction(targetBottom, 'ladyAcknowledge');
    expect(ack).toMatchObject({
      label: '查看查验请求',
      isEnabled: true,
      testID: 'avalon-lady-acknowledge-open',
    });
    expect(findTierAction(targetBottom, 'primary', 'ladyAcknowledge')).toBe(ack);
    if (ack && ack.isEnabled) ack.onPress();
    expect(onLadyAcknowledgePress).toHaveBeenCalledTimes(1);
    running.send({ type: 'avalon.lady.acknowledge' }, seatUser(target));
    const holderAfter = shellFor(running, holderSeat);
    expect(findStageAction(holderAfter, 'ladyResult')).toMatchObject({
      label: '查验结果',
      testID: 'avalon-lady-result-open',
    });
    // Tier ownership: the result reopen is a follow-up — secondary tier.
    expect(findTierAction(holderAfter, 'secondary', 'ladyResult')).toBeDefined();
    expect(findTierAction(holderAfter, 'primary', 'ladyResult')).toBeUndefined();
    const targetAfter = shellFor(running, target);
    expect(findStageAction(targetAfter, 'ladyResult')).toBeUndefined();
  });

  it('assassin: the assassin picks, evil waits to confer, good waits in the dark', () => {
    const running = daytimeSession();
    playQuestRound(running);
    playQuestRound(running);
    completeLadyIfPresent(running);
    playQuestRound(running);
    completeLadyIfPresent(running);
    if (running.state.phase.kind !== 'assassin') throw new Error('expected the assassin phase');
    const assassin = roleSeat(running, 'assassin');
    expect(shellFor(running, assassin).message).toContain('指认其为梅林');
    const otherEvil = evilSeats(running).find((seat) => seat !== assassin);
    if (otherEvil === undefined) throw new Error('expected a second evil seat');
    expect(shellFor(running, otherEvil).message).toBe('坏人商量时间（线下口头），等待刺客指认。');
    expect(shellFor(running, roleSeat(running, 'merlin')).message).toBe('坏人正在商量刺杀目标…');
  });
});

/** Reads the current phase across a function boundary (no narrowing). */
function currentPhase(running: RunningSession): AvalonState['phase'] {
  return running.state.phase;
}

/** Walks a five-human game into the first night step (evilReveal). */
function nightSession() {
  const running = session(5);
  running.send({ type: 'avalon.game.start' });
  for (let seat = 0; seat < 5; seat += 1) {
    running.send({ type: 'avalon.role.viewed' }, seatUser(seat));
  }
  running.send({ type: 'avalon.game.begin' });
  if (running.state.isAudioPlaying) running.send({ type: 'avalon.audio.ack' }, 'host');
  if (running.state.phase.kind !== 'night') throw new Error('expected night phase');
  return running;
}

describe('createAvalonRoomShellModel — PR-B waiting messages', () => {
  it('night: non-participants and confirmed participants wait on the step, pending participants act', () => {
    const running = nightSession();
    const participants = getAvalonNightParticipants(running.state.roles, 'evilReveal');
    const nonParticipant = [0, 1, 2, 3, 4].find((seat) => !participants.includes(seat));
    if (nonParticipant === undefined) throw new Error('expected a non-participant seat');
    expect(shellFor(running, nonParticipant).message).toBe('等待本步玩家确认');
    const pending = participants[0];
    if (pending === undefined) throw new Error('expected a participant seat');
    const pendingShell = shellFor(running, pending);
    expect(pendingShell.message).toBeNull();
    expect(findStageAction(pendingShell, 'nightInfo')).toBeDefined();
    expect(findTierAction(pendingShell, 'primary', 'nightInfo')).toBeDefined();
    running.send({ type: 'avalon.night.confirm' }, seatUser(pending));
    const confirmedShell = shellFor(running, pending);
    expect(confirmedShell.message).toBe('等待本步玩家确认');
    expect(findStageAction(confirmedShell, 'nightInfo')).toBeUndefined();
  });

  it('vote: a player who has voted sees the cast count, a pending voter keeps the bare action', () => {
    const running = daytimeSession();
    if (running.state.phase.kind !== 'nominate') throw new Error('expected nominate phase');
    const leader = running.state.leaderSeat;
    const required = running.state.phase.requiredSize;
    const team: number[] = [leader];
    for (let seat = 0; team.length < required; seat += 1) {
      if (!team.includes(seat)) team.push(seat);
    }
    running.send({ type: 'avalon.team.updateDraft', seats: team }, seatUser(leader));
    running.send({ type: 'avalon.team.propose' }, seatUser(leader));
    if (currentPhase(running).kind !== 'vote') throw new Error('expected vote phase');
    running.send({ type: 'avalon.team.vote', vote: 'approve' }, seatUser(1));
    expect(shellFor(running, 1).message).toBe('你已投：赞成（揭晓前可改票）· 已投 1/5');
    expect(shellFor(running, 2).message).toBeNull();
  });

  it('lady: bystanders read the public process before and after the target is chosen', () => {
    const running = ninePlayerDaytimeSession();
    playQuestRound(running);
    completeLadyIfPresent(running);
    playQuestRound(running);
    if (running.state.phase.kind !== 'lady') throw new Error('expected lady phase');
    const { holderSeat, examinedSeats } = running.state.phase;
    const seats = Array.from({ length: 9 }, (_, seat) => seat);
    const bystander = seats.find((seat) => seat !== holderSeat);
    if (bystander === undefined) throw new Error('expected a bystander seat');
    expect(shellFor(running, bystander).message).toBe(
      `${holderSeat + 1} 号 · P${holderSeat} 正在选择查验对象`,
    );
    const target = seats.find((seat) => seat !== holderSeat && !examinedSeats.includes(seat));
    if (target === undefined) throw new Error('expected an eligible lady target');
    running.send({ type: 'avalon.lady.check', seat: target }, seatUser(holderSeat));
    const other = seats.find((seat) => seat !== holderSeat && seat !== target);
    if (other === undefined) throw new Error('expected another bystander seat');
    expect(shellFor(running, other).message).toBe(
      `${holderSeat + 1} 号 · P${holderSeat} 已选择查验 ${target + 1} 号 · P${target}，等待对方确认`,
    );
  });

  it('ended: seated non-host players wait on the host, the host gets no wait sentence', () => {
    const running = daytimeSession();
    for (let round = 0; round < 5 && running.state.phase.kind !== 'ended'; round += 1) {
      if (running.state.phase.kind !== 'nominate') throw new Error('expected nominate phase');
      const leader = running.state.leaderSeat;
      const required = running.state.phase.requiredSize;
      const evils = evilSeats(running);
      const evilOnTeam = evils.find((seat) => seat !== leader) ?? evils[0];
      if (evilOnTeam === undefined) throw new Error('expected an evil seat');
      const team: number[] = [leader];
      if (!team.includes(evilOnTeam)) team.push(evilOnTeam);
      for (let seat = 0; team.length < required; seat += 1) {
        if (!team.includes(seat)) team.push(seat);
      }
      running.send({ type: 'avalon.team.updateDraft', seats: team }, seatUser(leader));
      running.send({ type: 'avalon.team.propose' }, seatUser(leader));
      for (let seat = 0; seat < 5; seat += 1) {
        running.send({ type: 'avalon.team.vote', vote: 'approve' }, seatUser(seat));
      }
      running.send({ type: 'avalon.vote.finish' });
      if (currentPhase(running).kind !== 'quest') throw new Error('expected quest phase');
      for (const seat of team) {
        running.send(
          { type: 'avalon.quest.play', play: seat === evilOnTeam ? 'fail' : 'success' },
          seatUser(seat),
        );
      }
      running.send({ type: 'avalon.quest.finish' });
    }
    if (running.state.phase.kind !== 'ended') throw new Error('expected ended phase');
    expect(shellFor(running, 2).message).toBe('等待房主操作（再来一局 / 返回大厅）');
    expect(shellFor(running, 0).message).toBeNull();
  });
});
