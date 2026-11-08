import { createOutboxStorage, type DurableCommandRecord } from '@/platform/realtime/outboxStorage';
import { createMemoryTokenStorage } from '@/test-utils/httpClient';

const NOW = 1_700_000_000_000;

function unreadableIsABug(error: Error): never {
  throw error;
}

function record(overrides: Partial<DurableCommandRecord> = {}): DurableCommandRecord {
  return {
    roomCode: '1234',
    roomId: 'room-1',
    userId: 'user-1',
    commandId: 'cmd-1',
    command: { type: 'x' },
    controlledSeat: null,
    label: '标签',
    createdAtMs: NOW,
    ...overrides,
  };
}

describe('outboxStorage', () => {
  it('round-trips records partitioned by room and user, oldest first', () => {
    const storage = createOutboxStorage(createMemoryTokenStorage(), () => NOW, unreadableIsABug);
    storage.save(record({ commandId: 'b', createdAtMs: NOW - 10 }));
    storage.save(record({ commandId: 'a', createdAtMs: NOW - 20 }));
    storage.save(record({ commandId: 'other-room', roomId: 'room-2' }));
    storage.save(record({ commandId: 'other-user', userId: 'user-2' }));

    expect(storage.load('room-1', 'user-1').map((r) => r.commandId)).toEqual(['a', 'b']);
    storage.remove('room-1', 'user-1', 'a');
    expect(storage.load('room-1', 'user-1').map((r) => r.commandId)).toEqual(['b']);
  });

  it('drops records older than the retention window on read', () => {
    let now = NOW;
    const storage = createOutboxStorage(createMemoryTokenStorage(), () => now, unreadableIsABug);
    storage.save(record({ commandId: 'old', createdAtMs: NOW }));
    now = NOW + 24 * 60 * 60 * 1_000 + 1;
    expect(storage.load('room-1', 'user-1')).toEqual([]);
  });

  it('refuses duplicate command IDs', () => {
    const storage = createOutboxStorage(createMemoryTokenStorage(), () => NOW, unreadableIsABug);
    storage.save(record());
    expect(() => storage.save(record())).toThrow('[FAIL-FAST]');
  });

  it('reports and drops a document it cannot read instead of failing every later load', () => {
    const backing = createMemoryTokenStorage();
    const unreadable: Error[] = [];
    const storage = createOutboxStorage(
      backing,
      () => NOW,
      (error) => unreadable.push(error),
    );

    backing.set('@room_command_outbox_v2', JSON.stringify({ version: 1, commands: [] }));
    expect(storage.load('room-1', 'user-1')).toEqual([]);
    expect(unreadable.map((error) => error.message)).toEqual(['Outbox document is not version 2']);
    expect(backing.getString('@room_command_outbox_v2')).toBeUndefined();

    backing.set(
      '@room_command_outbox_v2',
      JSON.stringify({ version: 2, records: [{ ...record(), surprise: true }] }),
    );
    expect(storage.load('room-1', 'user-1')).toEqual([]);
    expect(unreadable[1]?.message).toMatch(/unexpected fields/);

    backing.set('@room_command_outbox_v2', '{not json');
    expect(storage.load('room-1', 'user-1')).toEqual([]);
    expect(unreadable).toHaveLength(3);

    // The device is usable again: a fresh save round-trips.
    storage.save(record());
    expect(storage.load('room-1', 'user-1').map((r) => r.commandId)).toEqual(['cmd-1']);
  });
});
