/**
 * createAvalonHostManagement characterization (AU-31): phase × host
 * snapshots from real engine states in a bot-filled room (every bot
 * action driven by the host through controlled seats, as in play).
 */
import {
  avalonEngine,
  type AvalonPublicCommand,
  type AvalonState,
  DEFAULT_AVALON_CONFIG,
  getAvalonNightParticipants,
  isAvalonBotSeat,
  isAvalonEvilRole,
  parseAvalonState,
} from '@game-judge/game-engine/games/avalon/public';

import {
  createRoomSetupCapabilities,
  type RoomCapabilities,
} from '@/features/room/model/RoomCapabilities';

import { createAvalonHostManagement } from '../avalonRoomAdapter';

type CommandContext = Parameters<typeof avalonEngine.decide>[2];

const PLAYER_COUNT = 6;

function capabilities(
  isSetup: boolean,
): Pick<RoomCapabilities, 'canConfigureGame' | 'canFillBots' | 'canClearSeats'> {
  return createRoomSetupCapabilities({
    isSetup,
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
  });
}

const submit = jest.fn(async () => true);
const releaseBot = jest.fn();

function build(state: AvalonState, isHost: boolean, isSetup: boolean) {
  return createAvalonHostManagement({
    state,
    isHost,
    capabilities: capabilities(isSetup),
    isSubmitting: false,
    controlledSeat: null,
    releaseBot,
    submit,
  });
}

function session() {
  const nowMs = 1000;
  let commandNumber = 0;
  let state: AvalonState = avalonEngine.createInitialState(
    { ...DEFAULT_AVALON_CONFIG, numberOfPlayers: PLAYER_COUNT },
    { roomCode: '1234', hostUserId: 'host', nowMs, commandId: 'create' },
  );
  const send = (command: AvalonPublicCommand, controlledSeat: number | null = null) => {
    const context: CommandContext = {
      actor: { kind: 'user', userId: 'host' },
      controlledSeat,
      nowMs,
      commandId: `command:${commandNumber++}`,
      randomSeed: `seed:${commandNumber}`,
    };
    const decision = avalonEngine.decide(state, command, context);
    if (decision.kind === 'reject') throw new Error(`rejected: ${decision.reason}`);
    state = parseAvalonState(
      JSON.parse(
        JSON.stringify(avalonEngine.normalize(decision.events.reduce(avalonEngine.evolve, state))),
      ),
    );
  };
  /** Acts for a seat the way the client does: plainly for the host seat, via takeover for bots. */
  const sendAsSeat = (command: AvalonPublicCommand, seat: number) =>
    send(command, seat === 0 ? null : seat);
  const ackAudio = () => {
    if (state.isAudioPlaying) send({ type: 'avalon.audio.ack' });
  };
  return {
    get state() {
      return state;
    },
    send,
    sendAsSeat,
    ackAudio,
    seatHost() {
      send({ type: 'room.seat.take', seat: 0, profile: { displayName: '房主' } });
    },
    fill() {
      send({ type: 'room.seat.fillBots' });
    },
    /** Starts without marking the bots, leaving their viewed records open. */
    startWithUnmarkedBots() {
      send({ type: 'avalon.game.start' });
      send({ type: 'avalon.role.viewed' });
      ackAudio();
    },
    startToNominate() {
      send({ type: 'avalon.game.start' });
      // Only the host is human: the host views, then marks the bots,
      // then begins the game into the night.
      send({ type: 'avalon.role.viewed' });
      send({ type: 'avalon.role.markAllBotsViewed' });
      send({ type: 'avalon.game.begin' });
      ackAudio();
      while (state.phase.kind === 'night') {
        const participants = getAvalonNightParticipants(state.roles, state.phase.step);
        for (const seat of participants) sendAsSeat({ type: 'avalon.night.confirm' }, seat);
        ackAudio();
      }
    },
    passLady() {
      const phase = state.phase;
      if (phase.kind !== 'lady') return;
      const pick = Array.from({ length: PLAYER_COUNT }, (_, seat) => seat).find(
        (seat) => seat !== phase.holderSeat && !phase.examinedSeats.includes(seat),
      );
      if (pick === undefined) throw new Error('no lady target available');
      sendAsSeat({ type: 'avalon.lady.check', seat: pick }, phase.holderSeat);
      sendAsSeat({ type: 'avalon.lady.acknowledge' }, pick);
      ackAudio();
    },
    /** One quest round rigged to fail: an evil seat is always on the team and plays fail. */
    failQuestRound() {
      const phase = state.phase;
      if (phase.kind !== 'nominate') throw new Error(`expected nominate, got ${phase.kind}`);
      const evilSeat = Array.from({ length: PLAYER_COUNT }, (_, seat) => seat).find((seat) =>
        isAvalonEvilRole(state.roles[seat]!),
      );
      if (evilSeat === undefined) throw new Error('no evil seat dealt');
      const team = [
        evilSeat,
        ...Array.from({ length: PLAYER_COUNT }, (_, seat) => seat).filter(
          (seat) => seat !== evilSeat,
        ),
      ].slice(0, phase.requiredSize);
      sendAsSeat({ type: 'avalon.team.propose', seats: team }, state.leaderSeat);
      for (let seat = 0; seat < PLAYER_COUNT; seat += 1)
        sendAsSeat({ type: 'avalon.team.vote', vote: 'approve' }, seat);
      send({ type: 'avalon.vote.finish' });
      const questPhase = state.phase;
      if (questPhase.kind !== 'quest') throw new Error(`expected quest, got ${questPhase.kind}`);
      for (const seat of questPhase.teamSeats)
        sendAsSeat(
          { type: 'avalon.quest.play', play: seat === evilSeat ? 'fail' : 'success' },
          seat,
        );
      if (state.phase.kind === 'quest') send({ type: 'avalon.quest.finish' });
      ackAudio();
      this.passLady();
    },
    playToEnded() {
      for (let round = 0; round < 5 && state.phase.kind !== 'ended'; round += 1) {
        this.failQuestRound();
      }
    },
    isBotSeat(seat: number) {
      return isAvalonBotSeat(state, seat);
    },
  };
}

describe('createAvalonHostManagement', () => {
  it('returns null for non-hosts', () => {
    const game = session();
    game.seatHost();
    expect(build(game.state, false, true)).toBeNull();
  });

  it('pins the lobby panel: start reason counts the missing seats, room trio present', () => {
    const game = session();
    game.seatHost();
    const model = build(game.state, true, true);
    expect(model?.preview).toBe('分配角色');
    expect(model?.status).toBe('等待入座 · 1/6');
    expect(model?.sections[0]?.actions[0]).toMatchObject({
      key: 'start-game',
      label: '分配角色',
      testID: 'start-game-button',
      isEnabled: false,
      disabledReason: '座位尚未坐满（还差 5 人）',
    });
    expect(model?.sections[1]?.actions.map((action) => action.key)).toEqual([
      'configure-game',
      'fill-bots',
      'clear-seats',
    ]);
    game.fill();
    expect(build(game.state, true, true)?.sections[0]?.actions[0]).toMatchObject({
      isEnabled: true,
    });
  });

  it('pins the nominate panel: always-present room section only', () => {
    const game = session();
    game.seatHost();
    game.fill();
    game.startToNominate();
    expect(game.state.phase.kind).toBe('nominate');
    const model = build(game.state, true, false);
    expect(model?.preview).toBe('房主管理');
    expect(model?.sections.map((section) => section.key)).toEqual(['room']);
  });

  it('offers the bot-viewing scaffold while bot seats are unmarked, then drops it', () => {
    const game = session();
    game.seatHost();
    game.fill();
    game.startWithUnmarkedBots();
    expect(game.state.phase.kind).toBe('viewing');
    const model = build(game.state, true, false);
    // Viewing panel: begin waits for the checkpoint (only the host has
    // viewed), the scaffold action fills the bot records.
    expect(model?.preview).toBe('开始游戏');
    expect(model?.status).toBe('等待全员查看身份 · 1/6');
    expect(model?.sections.map((entry) => entry.key)).toEqual(['game', 'bot-viewing', 'room']);
    expect(model?.sections[0]?.actions[0]).toMatchObject({
      key: 'start-game',
      label: '开始游戏',
      isEnabled: false,
      disabledReason: '还有玩家未查看身份',
    });
    const section = model?.sections.find((entry) => entry.key === 'bot-viewing');
    expect(section?.actions.map((action) => action.key)).toEqual(['mark-bots-viewed']);
    expect(section?.actions[0]).toMatchObject({ label: '标记机器人已查看', variant: 'secondary' });

    game.send({ type: 'avalon.role.markAllBotsViewed' });
    const after = build(game.state, true, false);
    expect(after?.sections.find((entry) => entry.key === 'bot-viewing')).toBeUndefined();
    expect(after?.sections[0]?.actions[0]).toMatchObject({ key: 'start-game', isEnabled: true });
  });

  it('pins the vote and quest panels with their manual settle actions', () => {
    const game = session();
    game.seatHost();
    game.fill();
    game.startToNominate();
    const phase = game.state.phase;
    if (phase.kind !== 'nominate') throw new Error('expected nominate');
    const team = Array.from({ length: phase.requiredSize }, (_, seat) => seat);
    game.sendAsSeat({ type: 'avalon.team.propose', seats: team }, game.state.leaderSeat);
    expect(game.state.phase.kind).toBe('vote');
    const voteModel = build(game.state, true, false);
    expect(voteModel?.preview).toBe('结束投票');
    expect(voteModel?.sections.map((section) => section.key)).toEqual(['vote', 'room']);
    expect(voteModel?.sections[0]?.actions[0]).toMatchObject({
      key: 'finish-vote',
      label: '结束投票',
      testID: 'avalon-finish-vote',
    });
    for (let seat = 0; seat < PLAYER_COUNT; seat += 1)
      game.sendAsSeat({ type: 'avalon.team.vote', vote: 'approve' }, seat);
    game.send({ type: 'avalon.vote.finish' });
    expect(game.state.phase.kind).toBe('quest');
    const questModel = build(game.state, true, false);
    expect(questModel?.preview).toBe('结束任务');
    expect(questModel?.sections.map((section) => section.key)).toEqual(['quest', 'room']);
    expect(questModel?.sections[0]?.actions[0]).toMatchObject({
      key: 'finish-quest',
      label: '结束任务',
      testID: 'avalon-finish-quest',
    });
  });

  it('pins the terminal panel on the shared builders after three failed quests', () => {
    const game = session();
    game.seatHost();
    game.fill();
    game.startToNominate();
    game.playToEnded();
    expect(game.state.phase.kind).toBe('ended');
    const model = build(game.state, true, false);
    expect(model?.preview).toBe('本局已结束');
    const actions = model?.sections[0]?.actions ?? [];
    expect(actions.map((action) => action.key)).toEqual(['next-round', 'return-lobby']);
    expect(actions.map((action) => action.testID)).toEqual([
      'next-round-button',
      'return-lobby-button',
    ]);
  });
});
