/**
 * createAvalonSeatDataSource badges: the quest phase marks team seats that
 * have already played with 已出牌 (existence only, never the card content),
 * mirroring the vote phase's 已投票 badge. States come from the real engine.
 */
import {
  type AvalonCommand,
  avalonEngine,
  type AvalonState,
  DEFAULT_AVALON_CONFIG,
  getAvalonNightParticipants,
} from '@game-judge/game-engine/games/avalon/public';

import { createAvalonSeatDataSource } from '../avalonRoomAdapter';

type CommandContext = Parameters<typeof avalonEngine.decide>[2];

function questPhaseSession() {
  let commandNumber = 0;
  let state: AvalonState = avalonEngine.createInitialState(
    { ...DEFAULT_AVALON_CONFIG, numberOfPlayers: 5 },
    { roomCode: '1234', hostUserId: 'host', nowMs: 1000, commandId: 'create' },
  );
  const send = (command: AvalonCommand, userId = 'host', controlledSeat: number | null = null) => {
    const context: CommandContext = {
      actor: { kind: 'user', userId },
      controlledSeat,
      nowMs: 1000,
      commandId: `command:${commandNumber++}`,
      randomSeed: `seed:${commandNumber}`,
    };
    const decision = avalonEngine.decide(state, command, context);
    if (decision.kind === 'reject') throw new Error(`rejected: ${decision.reason}`);
    state = decision.events.reduce(avalonEngine.evolve, state);
    return state;
  };
  const seatUser = (seat: number) => (seat === 0 ? 'host' : `u${seat}`);
  for (let seat = 0; seat < 5; seat += 1) {
    send({ type: 'room.seat.take', seat, profile: { displayName: `P${seat}` } }, seatUser(seat));
  }
  send({ type: 'avalon.game.start' });
  for (let seat = 0; seat < 5; seat += 1) {
    send({ type: 'avalon.role.viewed' }, seatUser(seat));
  }
  if (state.isAudioPlaying) send({ type: 'avalon.audio.ack' }, 'host');
  for (const step of ['evilReveal', 'merlinReveal', 'percivalReveal'] as const) {
    if (state.phase.kind !== 'night') break;
    for (const seat of getAvalonNightParticipants(state.roles, step)) {
      send({ type: 'avalon.night.confirm' }, seatUser(seat));
    }
    if (state.isAudioPlaying) send({ type: 'avalon.audio.ack' }, 'host');
  }
  const leader = state.leaderSeat;
  send({ type: 'avalon.team.propose', seats: [leader, (leader + 1) % 5] }, seatUser(leader));
  for (let seat = 0; seat < 5; seat += 1) {
    send({ type: 'avalon.team.vote', vote: 'approve' }, seatUser(seat));
  }
  send({ type: 'avalon.vote.finish' });
  if (state.phase.kind !== 'quest') throw new Error('expected quest phase');
  return {
    get state() {
      return state;
    },
    send,
    seatUser,
    leader,
  };
}

describe('createAvalonSeatDataSource — quest played badge', () => {
  it('marks a team seat as 已出牌 after it plays, and only that seat', () => {
    const session = questPhaseSession();
    const leader = session.leader;
    session.send({ type: 'avalon.quest.play', play: 'success' }, session.seatUser(leader));
    const source = createAvalonSeatDataSource(session.state, 1, 'host', null);
    expect(source.getSeat(leader).statusBadge).toEqual({ label: '队长 · 已出牌', tone: 'success' });
    const other = (leader + 1) % 5;
    expect(source.getSeat(other).statusBadge).toEqual({ label: '队员', tone: 'success' });
    const outsider = (leader + 2) % 5;
    expect(source.getSeat(outsider).statusBadge).toBeNull();
  });
});
