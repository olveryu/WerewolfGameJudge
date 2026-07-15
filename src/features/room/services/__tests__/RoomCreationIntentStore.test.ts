import { ROOM_CREATION_INTENTS_KEY } from '@/config/storageKeys';
import { RoomCreationIntentStore } from '@/features/room/services/RoomCreationIntentStore';

const mockStoredValues = new Map<string, string>();
const mockNewRequestId = jest.fn<string, []>();

jest.mock('@werewolf/game-engine/platform/identifiers', () => ({
  newRequestId: () => mockNewRequestId(),
}));

jest.mock('@/services/infra/localStorage', () => ({
  storage: {
    getString: jest.fn((key: string) => mockStoredValues.get(key)),
    set: jest.fn((key: string, value: string) => mockStoredValues.set(key, value)),
    remove: jest.fn((key: string) => mockStoredValues.delete(key)),
  },
}));

describe('RoomCreationIntentStore', () => {
  beforeEach(() => {
    mockStoredValues.clear();
    mockNewRequestId.mockReset();
  });

  it('reuses one persisted creation ID until the completed intent is removed', () => {
    mockNewRequestId.mockReturnValue('creation-id-1');
    const firstStore = new RoomCreationIntentStore();

    expect(firstStore.getOrCreate('same-room-intent')).toBe('creation-id-1');
    expect(new RoomCreationIntentStore().getOrCreate('same-room-intent')).toBe('creation-id-1');
    expect(mockNewRequestId).toHaveBeenCalledTimes(1);

    firstStore.remove('creation-id-1');
    expect(mockStoredValues.has(ROOM_CREATION_INTENTS_KEY)).toBe(false);
  });

  it('keeps independent creation IDs for independent intents', () => {
    mockNewRequestId.mockReturnValueOnce('creation-id-1').mockReturnValueOnce('creation-id-2');
    const store = new RoomCreationIntentStore();

    expect(store.getOrCreate('werewolf-intent')).toBe('creation-id-1');
    expect(store.getOrCreate('fibking-intent')).toBe('creation-id-2');
  });

  it.each([
    ['an unversioned payload', JSON.stringify([])],
    [
      'duplicate intent keys',
      JSON.stringify({
        version: 1,
        intents: [
          { intentKey: 'same', creationId: 'first-id' },
          { intentKey: 'same', creationId: 'second-id' },
        ],
      }),
    ],
    [
      'duplicate creation IDs',
      JSON.stringify({
        version: 1,
        intents: [
          { intentKey: 'first', creationId: 'same-id' },
          { intentKey: 'second', creationId: 'same-id' },
        ],
      }),
    ],
    [
      'unknown fields',
      JSON.stringify({
        version: 1,
        intents: [{ intentKey: 'intent', creationId: 'creation-id', retry: true }],
      }),
    ],
  ])('fails fast for %s', (_label, raw) => {
    mockStoredValues.set(ROOM_CREATION_INTENTS_KEY, raw);
    expect(() => new RoomCreationIntentStore().getOrCreate('intent')).toThrow();
  });

  it('fails fast when removing an intent that does not exist', () => {
    expect(() => new RoomCreationIntentStore().remove('missing-id')).toThrow(
      'missing-id does not exist',
    );
  });
});
