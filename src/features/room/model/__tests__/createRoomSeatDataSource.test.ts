import type { CreateRoomSeatDataSourceInput } from '../createRoomSeatDataSource';
import { createRoomSeatDataSource } from '../createRoomSeatDataSource';

const ROSTER: CreateRoomSeatDataSourceInput['roster'] = {
  0: {
    userId: 'user-a',
    profile: { displayName: '阿珍', avatarUrl: 'https://example.test/a.png', level: 7 },
  },
  1: { kind: 'bot' },
};

function buildInput(
  overrides: Partial<CreateRoomSeatDataSourceInput> = {},
): CreateRoomSeatDataSourceInput {
  return {
    seatCount: 4,
    revision: 12,
    roster: ROSTER,
    viewerUserId: 'user-a',
    controlledSeat: null,
    isLobby: true,
    botUserId: (seat) => `game-bot:room-1:${seat}`,
    outOfRangeError: (seat) => `Game seat source index is out of range: ${seat}`,
    lockedSeatReason: '游戏进行中不能入座',
    ...overrides,
  };
}

describe('createRoomSeatDataSource', () => {
  it('composes the standard revision key from revision and controlled seat', () => {
    expect(createRoomSeatDataSource(buildInput()).revision).toBe('12:self');
    expect(createRoomSeatDataSource(buildInput({ controlledSeat: 2 })).revision).toBe('12:2');
    expect(createRoomSeatDataSource(buildInput({ revisionKey: '12:null:3:true' })).revision).toBe(
      '12:null:3:true',
    );
  });

  it('projects a human occupant through the shared player projection', () => {
    const seat = createRoomSeatDataSource(buildInput()).getSeat(0);
    expect(seat.player).toEqual({
      kind: 'human',
      userId: 'user-a',
      displayName: '阿珍',
      avatarUrl: 'https://example.test/a.png',
      avatarFrame: undefined,
      seatFlair: undefined,
      seatAnimation: undefined,
      nameStyle: undefined,
      seatPetId: undefined,
      level: 7,
      isAnonymous: false,
    });
    expect(seat.isSelf).toBe(true);
  });

  it('synthesizes a bot player from the game bot id and shared bot name', () => {
    const seat = createRoomSeatDataSource(buildInput()).getSeat(1);
    expect(seat.player?.kind).toBe('bot');
    expect(seat.player?.userId).toBe('game-bot:room-1:1');
    expect(seat.player?.displayName).toBe('机器人2号');
    expect(seat.isSelf).toBe(false);
  });

  it('leaves an empty seat playerless and unlocked in the lobby', () => {
    const seat = createRoomSeatDataSource(buildInput()).getSeat(3);
    expect(seat.player).toBeNull();
    expect(seat.disabledReason).toBeUndefined();
    expect(seat.showLevel).toBe(true);
    expect(seat.decorationsEnabled).toBe(true);
  });

  it('locks an empty seat outside the lobby with the game wording', () => {
    const seat = createRoomSeatDataSource(buildInput({ isLobby: false })).getSeat(3);
    expect(seat.disabledReason).toBe('游戏进行中不能入座');
    expect(seat.showLevel).toBe(false);
    expect(seat.decorationsEnabled).toBe(false);
  });

  it('never locks an occupied seat outside the lobby', () => {
    const seat = createRoomSeatDataSource(buildInput({ isLobby: false })).getSeat(0);
    expect(seat.disabledReason).toBeUndefined();
  });

  it('defaults the game-specific fields and marks the controlled seat', () => {
    const seat = createRoomSeatDataSource(buildInput({ controlledSeat: 1 })).getSeat(1);
    expect(seat.highlight).toBe('controlled');
    expect(seat.secondaryLabel).toBeNull();
    expect(seat.statusBadge).toBeNull();
    expect(seat.showReadyBadge).toBe(false);
    expect(seat.isStatusEmphasized).toBe(false);
  });

  it('passes the assembled player into the injected resolvers', () => {
    const source = createRoomSeatDataSource(
      buildInput({
        resolveSecondaryLabel: (seat, player) => (player === null ? null : `座位${seat}`),
        resolveStatusBadge: (seat, player) =>
          player === null ? null : { label: '已提交', tone: 'success' },
        resolveShowReadyBadge: (seat) => seat === 0,
        resolveIsStatusEmphasized: (seat) => seat === 1,
        resolveHighlight: (seat) => (seat === 0 ? 'selected' : undefined),
        resolveDisabledReason: (seat, player) =>
          player !== null && seat === 1 ? '该玩家已出局' : undefined,
      }),
    );
    const human = source.getSeat(0);
    expect(human.secondaryLabel).toBe('座位0');
    expect(human.statusBadge).toEqual({ label: '已提交', tone: 'success' });
    expect(human.showReadyBadge).toBe(true);
    expect(human.highlight).toBe('selected');
    const bot = source.getSeat(1);
    expect(bot.isStatusEmphasized).toBe(true);
    expect(bot.disabledReason).toBe('该玩家已出局');
    const empty = source.getSeat(2);
    expect(empty.secondaryLabel).toBeNull();
    expect(empty.statusBadge).toBeNull();
    // The disabled-reason override wins even in the lobby.
    expect(empty.disabledReason).toBeUndefined();
  });

  it('rejects out-of-range seats with the game message', () => {
    const source = createRoomSeatDataSource(buildInput());
    expect(() => source.getSeat(4)).toThrow('Game seat source index is out of range: 4');
    expect(() => source.getSeat(-1)).toThrow('Game seat source index is out of range: -1');
    expect(() => source.getSeat(1.5)).toThrow('Game seat source index is out of range: 1.5');
  });
});
