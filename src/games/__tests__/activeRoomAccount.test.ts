import type {
  GameRoomAccountSnapshot,
  RoomAccountCapability,
} from '@/features/room/model/RoomAccountCapability';
import { createActiveRoomAccountSource } from '@/games/activeRoomAccount';
import { successfulRoomCommand, testRoomState } from '@/test-utils/roomCommand';

function createCapability(snapshot: GameRoomAccountSnapshot): RoomAccountCapability {
  return {
    gameType: snapshot.gameType,
    getSnapshot: () => snapshot,
    subscribe: () => () => {},
    updateProfile: async () =>
      successfulRoomCommand(testRoomState(snapshot.gameType), 'account-profile'),
    leaveSeat: async () => successfulRoomCommand(testRoomState(snapshot.gameType), 'account-leave'),
  };
}

describe('createActiveRoomAccountSource', () => {
  it('returns one stable idle snapshot when every game session is idle', () => {
    const source = createActiveRoomAccountSource([
      createCapability({
        gameType: 'werewolf',
        phase: 'idle',
        isSeated: false,
        canSwitchAccount: true,
        canSyncProfile: false,
      }),
    ]);

    expect(source.getSnapshot()).toBe(source.getSnapshot());
    expect(source.getSnapshot()).toEqual({
      phase: 'idle',
      isSeated: false,
      canSwitchAccount: true,
      canSyncProfile: false,
    });
  });

  it('exposes the active capability without game-specific state', async () => {
    const updateProfile = jest.fn(async () =>
      successfulRoomCommand(testRoomState('werewolf'), 'active-profile'),
    );
    const capability: RoomAccountCapability = {
      ...createCapability({
        gameType: 'werewolf',
        phase: 'ready',
        isSeated: true,
        canSwitchAccount: false,
        canSyncProfile: true,
      }),
      updateProfile,
    };
    const source = createActiveRoomAccountSource([capability]);
    const snapshot = source.getSnapshot();

    expect(snapshot.phase).toBe('ready');
    if (snapshot.phase === 'idle') throw new Error('Expected active room account');
    await snapshot.updateProfile({ displayName: 'Alice' });
    expect(updateProfile).toHaveBeenCalledWith({ displayName: 'Alice' });
  });

  it('fails fast when two game sessions are active', () => {
    const active = createCapability({
      gameType: 'werewolf',
      phase: 'entering',
      isSeated: false,
      canSwitchAccount: false,
      canSyncProfile: false,
    });
    const source = createActiveRoomAccountSource([active, active]);

    expect(() => source.getSnapshot()).toThrow(
      '[FAIL-FAST] More than one game room session is active',
    );
  });
});
