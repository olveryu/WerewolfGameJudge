import {
  readAIChatBubblePosition,
  writeAIChatBubblePosition,
} from '@/games/werewolf/services/aiChatBubblePositionStore';
import {
  clearAIChatMessages,
  readAIChatMessages,
  writeAIChatMessages,
} from '@/games/werewolf/services/aiChatLocalStore';

const mockStoredValues = new Map<string, string>();
jest.mock('@/services/infra/localStorage', () => ({
  storage: {
    getString: jest.fn((key: string) => mockStoredValues.get(key)),
    set: jest.fn((key: string, value: string) => mockStoredValues.set(key, value)),
    remove: jest.fn((key: string) => mockStoredValues.delete(key)),
  },
}));

describe('Werewolf AI chat local stores', () => {
  const owner = { userId: 'user-1', roomId: 'room-1' };

  beforeEach(() => {
    mockStoredValues.clear();
  });

  it('persists the newest fifty strict chat messages', () => {
    const messages = Array.from({ length: 51 }, (_, index) => ({
      id: `message-${index}`,
      role: index % 2 === 0 ? ('user' as const) : ('assistant' as const),
      content: `content-${index}`,
      timestamp: index,
    }));

    writeAIChatMessages(owner, messages);

    expect(readAIChatMessages(owner)).toEqual(messages.slice(1));
    clearAIChatMessages(owner);
    expect(readAIChatMessages(owner)).toEqual([]);
  });

  it('isolates chat history by user and room instance', () => {
    writeAIChatMessages(owner, [{ id: '1', role: 'user', content: 'room one', timestamp: 1 }]);

    expect(readAIChatMessages({ userId: 'user-2', roomId: 'room-1' })).toEqual([]);
    expect(readAIChatMessages({ userId: 'user-1', roomId: 'room-2' })).toEqual([]);
  });

  it.each([
    [{ id: '', role: 'user', content: 'x', timestamp: 1 }],
    [{ id: '1', role: 'system', content: 'x', timestamp: 1 }],
    [{ id: '1', role: 'user', content: 'x', timestamp: -1 }],
    [{ id: '1', role: 'user', content: 'x', timestamp: 1, extra: true }],
  ])('rejects malformed stored chat messages', (message) => {
    mockStoredValues.set(
      '@werewolf:ai-chat:messages:user-1:room-1',
      JSON.stringify({ version: 1, messages: [message] }),
    );
    expect(() => readAIChatMessages(owner)).toThrow();
  });

  it('rejects the old unversioned chat payload instead of keeping a compatibility reader', () => {
    mockStoredValues.set('@werewolf:ai-chat:messages:user-1:room-1', JSON.stringify([]));
    expect(() => readAIChatMessages(owner)).toThrow();
  });

  it('persists finite bubble coordinates with an exact shape', () => {
    writeAIChatBubblePosition('user-1', { x: 12.5, y: 30 });
    expect(readAIChatBubblePosition('user-1')).toEqual({ x: 12.5, y: 30 });
    expect(readAIChatBubblePosition('user-2')).toBeNull();
  });

  it.each([
    { x: Number.NaN, y: 1 },
    { x: 1, y: Number.POSITIVE_INFINITY },
    { x: 1, y: 2, extra: true },
  ])('rejects malformed bubble coordinates', (position) => {
    mockStoredValues.set(
      '@werewolf:ai-chat:bubble-position:user-1',
      JSON.stringify({ version: 1, ...position }),
    );
    expect(() => readAIChatBubblePosition('user-1')).toThrow();
  });

  it('rejects the old unversioned bubble payload instead of keeping a compatibility reader', () => {
    mockStoredValues.set(
      '@werewolf:ai-chat:bubble-position:user-1',
      JSON.stringify({ x: 1, y: 2 }),
    );
    expect(() => readAIChatBubblePosition('user-1')).toThrow();
  });
});
