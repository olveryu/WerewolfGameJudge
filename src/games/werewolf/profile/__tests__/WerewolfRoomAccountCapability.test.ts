import type { GameState } from '@game-judge/game-engine/games/werewolf/public';
import { GameStatus, WEREWOLF_STATE_VERSION } from '@game-judge/game-engine/games/werewolf/public';
import { resolveRandomAnimation } from '@game-judge/game-engine/product/rewards';

import type { RoomSessionSnapshot } from '@/features/room/session/types';
import { WerewolfRoomAccountCapability } from '@/games/werewolf/profile/WerewolfRoomAccountCapability';
import type { WerewolfGameClient } from '@/games/werewolf/runtime/WerewolfGameClient';

function createReadySnapshot(isSeated: boolean): RoomSessionSnapshot<GameState> {
  return {
    phase: 'ready',
    epoch: 1,
    identity: {
      room: {
        roomCode: '1234',
        roomId: 'room-id',
        gameType: 'werewolf',
        hostUserId: 'u1',
        createdAt: new Date('2026-07-14T12:00:00.000Z'),
      },
      userId: 'u1',
    },
    connection: 'live',
    pendingCommandCount: 0,
    lastRecoveredCommandRejection: null,
    snapshot: {
      gameType: 'werewolf',
      stateVersion: WEREWOLF_STATE_VERSION,
      revision: 1,
      state: {
        status: GameStatus.Seated,
        players: isSeated ? { 1: { userId: 'u1' } } : {},
      } as GameState,
    },
    lastCommand: null,
    error: null,
  };
}

function createClient(isSeated: boolean) {
  const dispatch = jest.fn(async () => ({
    kind: 'decided' as const,
    decision: {
      kind: 'committed' as const,
      commandId: 'command-id',
      snapshot: createReadySnapshot(false).snapshot,
      outcome: { kind: 'applied' as const },
    },
  }));
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
      { controlledSeat: null, label: 'updateRoomProfile' },
    );
  });

  it('dispatches the canonical shared leave command', async () => {
    const { client, dispatch } = createClient(true);
    const capability = new WerewolfRoomAccountCapability(client);

    await capability.leaveSeat();

    expect(dispatch).toHaveBeenCalledWith(
      { type: 'room.seat.leave' },
      { controlledSeat: null, label: 'leaveRoomSeat' },
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
      { controlledSeat: null, label: 'updateRoomProfile' },
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
