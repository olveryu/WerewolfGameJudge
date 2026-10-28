import type { GameState } from '@game-judge/game-engine/games/werewolf/public';
import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';
import { createRoomSnapshot } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import { resolveRandomAnimation } from '@game-judge/game-engine/product/rewards';

import { WerewolfRoomAccountCapability } from '@/games/werewolf/profile/WerewolfRoomAccountCapability';
import type { WerewolfGameClient } from '@/games/werewolf/runtime/WerewolfGameClient';
import type { ReadyLinkSnapshot } from '@/platform/realtime/types';
import { readyLinkSnapshot } from '@/test-utils/linkSnapshot';
import { successfulRoomCommand } from '@/test-utils/roomCommand';
import { buildWerewolfTestState } from '@/test-utils/werewolfState';

function createReadySnapshot(isSeated: boolean): ReadyLinkSnapshot<GameState> {
  const state = buildWerewolfTestState({
    roomCode: '1234',
    hostUserId: 'u1',
    status: GameStatus.Seated,
    players: isSeated ? { 0: null, 1: { seat: 1, role: null } } : {},
    roster: isSeated ? { 1: { seat: 1, userId: 'u1', profile: { displayName: 'P' } } } : {},
  });
  return readyLinkSnapshot<GameState>(
    {
      room: {
        roomCode: '1234',
        roomId: 'room-id',
        gameType: 'werewolf',
        hostUserId: 'u1',
        createdAt: new Date('2026-07-14T12:00:00.000Z'),
      },
      userId: 'u1',
    },
    createRoomSnapshot(state, 1),
  );
}

function createClient(isSeated: boolean) {
  const dispatch = jest.fn(async () =>
    successfulRoomCommand(createReadySnapshot(false).room.state, 'command-id'),
  );
  const roomSession = {
    getSnapshot: () => createReadySnapshot(isSeated),
    subscribe: () => () => {},
    dispatch,
  };
  return {
    client: { roomSession } as unknown as WerewolfGameClient,
    dispatch,
  };
}

describe('WerewolfRoomAccountCapability', () => {
  it('maps the seated room snapshot to account capabilities', () => {
    const { client } = createClient(true);
    const capability = new WerewolfRoomAccountCapability(client);

    expect(capability.getSnapshot()).toMatchObject({
      gameType: 'werewolf',
      phase: 'ready',
      isSeated: true,
      canSwitchAccount: true,
      canSyncProfile: true,
    });
  });

  it('maps the neutral profile patch to one Werewolf profile command', async () => {
    const { client, dispatch } = createClient(true);
    const capability = new WerewolfRoomAccountCapability(client);

    await capability.updateProfile({ displayName: 'Alice', revealEffect: 'roulette' });

    expect(dispatch).toHaveBeenCalledWith(
      {
        type: 'room.profile.update',
        profile: {
          displayName: 'Alice',
          avatarUrl: undefined,
          avatarFrame: undefined,
          seatFlair: undefined,
          nameStyle: undefined,
          revealEffect: 'roulette',
          seatAnimation: undefined,
        },
      },
      { controlledSeat: null, label: '同步资料', durable: false },
    );
  });

  it('dispatches the canonical shared leave command', async () => {
    const { client, dispatch } = createClient(true);
    const capability = new WerewolfRoomAccountCapability(client);

    await capability.leaveSeat();

    expect(dispatch).toHaveBeenCalledWith(
      { type: 'room.seat.leave' },
      { controlledSeat: null, label: '离座', durable: false },
    );
  });

  it('resolves random reveal effects once at the shared account boundary', async () => {
    const { client, dispatch } = createClient(true);
    const capability = new WerewolfRoomAccountCapability(client);

    await capability.updateProfile({ revealEffect: 'random' });

    expect(dispatch).toHaveBeenCalledWith(
      {
        type: 'room.profile.update',
        profile: {
          displayName: undefined,
          avatarUrl: undefined,
          avatarFrame: undefined,
          seatFlair: undefined,
          nameStyle: undefined,
          revealEffect: resolveRandomAnimation('1234u1'),
          seatAnimation: undefined,
        },
      },
      { controlledSeat: null, label: '同步资料', durable: false },
    );
  });

  it('maps the account clear sentinel to the canonical room reveal effect', async () => {
    const { client, dispatch } = createClient(true);
    const capability = new WerewolfRoomAccountCapability(client);

    await capability.updateProfile({ revealEffect: '' });

    expect(dispatch).toHaveBeenCalledWith(
      {
        type: 'room.profile.update',
        profile: {
          displayName: undefined,
          avatarUrl: undefined,
          avatarFrame: undefined,
          seatFlair: undefined,
          nameStyle: undefined,
          revealEffect: 'none',
          seatAnimation: undefined,
        },
      },
      { controlledSeat: null, label: '同步资料', durable: false },
    );
  });

  it('fails fast when an unseated user attempts room profile operations', async () => {
    const { client } = createClient(false);
    const capability = new WerewolfRoomAccountCapability(client);

    await expect(capability.updateProfile({ displayName: 'Alice' })).rejects.toThrow(
      'Active room profile sync requires a seated player',
    );
    await expect(capability.leaveSeat()).rejects.toThrow(
      'Active room leave requires a seated player',
    );
  });
});
