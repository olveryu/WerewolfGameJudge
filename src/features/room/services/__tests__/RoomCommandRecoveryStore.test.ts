import { ROOM_COMMAND_RECOVERY_KEY } from '@/config/storageKeys';
import { RoomCommandRecoveryStore } from '@/features/room/services/RoomCommandRecoveryStore';

const NOW_MS = Date.parse('2026-08-22T08:00:00.000Z');

function createStorage() {
  const values = new Map<string, string>();
  return {
    values,
    getString: (key: string) => values.get(key),
    set: (key: string, value: string) => values.set(key, value),
    remove: (key: string) => values.delete(key),
  };
}

function createCommand() {
  return {
    roomCode: '2473',
    roomId: 'room-id-2473',
    userId: 'user-9',
    commandId: 'command-1',
    command: {
      type: 'werewolf.action.submit',
      input: { kind: 'target', target: 3 },
      expectedStep: {
        currentStepId: 'seerCheck',
        currentStepIndex: 4,
        roleRevealRandomNonce: null,
      },
    },
    controlledSeat: null,
    label: 'submitAction',
  };
}

describe('RoomCommandRecoveryStore', () => {
  it('round-trips the exact canonical command for one room and user', () => {
    const recoveryStorage = createStorage();
    const store = new RoomCommandRecoveryStore(recoveryStorage, () => NOW_MS);

    store.save(createCommand());

    expect(store.load('room-id-2473', 'user-9')).toEqual([
      { ...createCommand(), createdAtMs: NOW_MS },
    ]);
    expect(store.load('room-id-2473', 'another-user')).toEqual([]);
  });

  it('rejects a command ID whose stored payload changes', () => {
    const recoveryStorage = createStorage();
    const store = new RoomCommandRecoveryStore(recoveryStorage, () => NOW_MS);
    store.save(createCommand());

    expect(() =>
      store.save({
        ...createCommand(),
        command: { type: 'werewolf.action.submit', input: { kind: 'target', target: 8 } },
      }),
    ).toThrow('changed after storage');
  });

  it('treats saving the same command ID and payload again as idempotent', () => {
    const recoveryStorage = createStorage();
    let nowMs = NOW_MS;
    const store = new RoomCommandRecoveryStore(recoveryStorage, () => nowMs);
    store.save(createCommand());
    nowMs += 1_000;

    expect(() => store.save(createCommand())).not.toThrow();
    expect(store.load('room-id-2473', 'user-9')).toEqual([
      { ...createCommand(), createdAtMs: NOW_MS },
    ]);
  });

  it('rejects malformed persisted envelopes instead of restoring an unchecked command', () => {
    const recoveryStorage = createStorage();
    recoveryStorage.values.set(
      ROOM_COMMAND_RECOVERY_KEY,
      JSON.stringify({ version: 1, commands: [{ commandId: 'command-1' }] }),
    );
    const store = new RoomCommandRecoveryStore(recoveryStorage, () => NOW_MS);

    expect(() => store.load('room-id-2473', 'user-9')).toThrow('unsupported fields');
  });

  it('removes expired commands before returning recovery work', () => {
    const recoveryStorage = createStorage();
    const store = new RoomCommandRecoveryStore(recoveryStorage, () => NOW_MS);
    store.save(createCommand());
    const eightDaysLater = NOW_MS + 8 * 24 * 60 * 60 * 1_000;
    const laterStore = new RoomCommandRecoveryStore(recoveryStorage, () => eightDaysLater);

    expect(laterStore.load('room-id-2473', 'user-9')).toEqual([]);
    expect(recoveryStorage.values.has(ROOM_COMMAND_RECOVERY_KEY)).toBe(false);
  });

  it('removes only the decided command for the matching room and user', () => {
    const recoveryStorage = createStorage();
    const store = new RoomCommandRecoveryStore(recoveryStorage, () => NOW_MS);
    store.save(createCommand());
    store.save({
      ...createCommand(),
      roomId: 'another-room',
      commandId: 'command-2',
    });

    store.remove('room-id-2473', 'user-9', 'command-1');

    expect(store.load('room-id-2473', 'user-9')).toEqual([]);
    expect(store.load('another-room', 'user-9')).toHaveLength(1);
  });
});
