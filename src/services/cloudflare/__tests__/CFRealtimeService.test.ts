import { WEREWOLF_STATE_CODEC } from '@werewolf/game-engine';
import { buildInitialGameState } from '@werewolf/game-engine/engine/state/buildInitialState';
import type { GameTemplate } from '@werewolf/game-engine/models/Template';
import {
  createRoomSnapshot,
  createStateUpdateMessage,
} from '@werewolf/game-engine/platform/protocol/roomSnapshot';

import type { TransportEventHandlers } from '@/services/types/IRealtimeTransport';

import { ensureFreshToken } from '../cfFetch';
import { CFRealtimeService } from '../CFRealtimeService';

jest.mock('../cfFetch', () => ({
  ensureFreshToken: jest.fn(),
}));

jest.mock('@/utils/errorPipeline', () => ({
  handleError: jest.fn(),
}));

const TEMPLATE: GameTemplate = {
  name: 'Realtime service',
  numberOfPlayers: 4,
  roles: ['wolf', 'seer', 'villager', 'villager'],
};
const ROOM = { roomCode: '1234', roomId: 'room-id-1234' } as const;

class MockWebSocket {
  // eslint-disable-next-line @typescript-eslint/naming-convention -- WebSocket API constant
  static readonly OPEN = 1;
  static instances: MockWebSocket[] = [];

  readonly url: string;
  readyState = MockWebSocket.OPEN;
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  readonly close = jest.fn();
  readonly send = jest.fn();

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }
}

const mockEnsureFreshToken = jest.mocked(ensureFreshToken);

function createHandlers(): jest.Mocked<TransportEventHandlers> {
  return {
    onOpen: jest.fn(),
    onClose: jest.fn(),
    onError: jest.fn(),
    onStateUpdate: jest.fn(),
    onSettleResult: jest.fn(),
    onPong: jest.fn(),
  };
}

async function connectService(): Promise<{
  service: CFRealtimeService;
  handlers: jest.Mocked<TransportEventHandlers>;
  socket: MockWebSocket;
}> {
  const service = new CFRealtimeService(WEREWOLF_STATE_CODEC);
  const handlers = createHandlers();
  service.setEventHandlers(handlers);
  service.connect(ROOM, 'USER');
  await Promise.resolve();
  const socket = MockWebSocket.instances[0];
  if (!socket) throw new Error('Expected CFRealtimeService to create a WebSocket');
  socket.onopen?.();
  return { service, handlers, socket };
}

describe('CFRealtimeService protocol', () => {
  const originalWebSocket = global.WebSocket;

  beforeEach(() => {
    MockWebSocket.instances = [];
    mockEnsureFreshToken.mockResolvedValue('token');
    global.WebSocket = MockWebSocket as unknown as typeof WebSocket;
  });

  afterEach(() => {
    global.WebSocket = originalWebSocket;
    jest.clearAllMocks();
  });

  it('fails fast when connect is called before handlers are registered', () => {
    const service = new CFRealtimeService(WEREWOLF_STATE_CODEC);

    expect(() => service.connect(ROOM, 'USER')).toThrow(
      'CFRealtimeService requires event handlers before connect',
    );
    expect(MockWebSocket.instances).toHaveLength(0);
  });

  it('emits the canonical state update message', async () => {
    const { service, handlers, socket } = await connectService();
    const state = buildInitialGameState('ROOM', 'HOST', TEMPLATE);
    const message = createStateUpdateMessage(createRoomSnapshot(state, 4), 'room.seat.take');

    socket.onmessage?.({ data: JSON.stringify(message) } as MessageEvent);

    expect(handlers.onStateUpdate).toHaveBeenCalledWith(message);
    service.disconnect();
  });

  it('rejects the removed legacy state update shape and closes with 1002', async () => {
    const { handlers, socket } = await connectService();
    const state = buildInitialGameState('ROOM', 'HOST', TEMPLATE);

    socket.onmessage?.({
      data: JSON.stringify({ type: 'STATE_UPDATE', state, revision: 4, lastAction: 'SIT' }),
    } as MessageEvent);

    expect(handlers.onStateUpdate).not.toHaveBeenCalled();
    expect(handlers.onError).toHaveBeenCalledWith(expect.any(Error));
    expect(socket.close).toHaveBeenCalledWith(1002, 'protocol_error');
  });

  it('rejects a non-increasing revision on one socket', async () => {
    const { handlers, socket } = await connectService();
    const state = buildInitialGameState('ROOM', 'HOST', TEMPLATE);
    socket.onmessage?.({
      data: JSON.stringify(
        createStateUpdateMessage(createRoomSnapshot(state, 4), 'room.seat.take'),
      ),
    } as MessageEvent);
    socket.onmessage?.({
      data: JSON.stringify(
        createStateUpdateMessage(createRoomSnapshot(state, 3), 'room.seat.leave'),
      ),
    } as MessageEvent);

    expect(handlers.onStateUpdate).toHaveBeenCalledTimes(1);
    const revisionError = handlers.onError.mock.calls[0]?.[0];
    if (!(revisionError instanceof Error)) throw new Error('Expected revision protocol error');
    expect(revisionError.message).toContain('did not advance');
    expect(socket.close).toHaveBeenCalledWith(1002, 'protocol_error');
  });

  it('parses every durable settlement delivery for the facade acknowledgement owner', async () => {
    const { handlers, socket } = await connectService();
    const message = {
      type: 'SETTLE_RESULT',
      eventId: 'settlement-event-1',
      gameType: 'werewolf',
      settlementId: 'settlement-1',
      endedRevision: 12,
      xpEarned: 15,
      newXp: 40,
      newLevel: 2,
      previousLevel: 1,
      normalDrawsEarned: 2,
      goldenDrawsEarned: 1,
    };

    socket.onmessage?.({ data: JSON.stringify(message) } as MessageEvent);
    socket.onmessage?.({ data: JSON.stringify(message) } as MessageEvent);

    expect(handlers.onSettleResult).toHaveBeenCalledTimes(2);
    expect(handlers.onSettleResult).toHaveBeenCalledWith({
      eventId: 'settlement-event-1',
      gameType: 'werewolf',
      settlementId: 'settlement-1',
      endedRevision: 12,
      xpEarned: 15,
      newXp: 40,
      newLevel: 2,
      previousLevel: 1,
      normalDrawsEarned: 2,
      goldenDrawsEarned: 1,
    });
  });

  it('rejects a settlement message without its durable event ID', async () => {
    const { handlers, socket } = await connectService();
    const message = {
      type: 'SETTLE_RESULT',
      gameType: 'werewolf',
      settlementId: 'settlement-2',
      endedRevision: 12,
      xpEarned: 15,
      newXp: 40,
      newLevel: 2,
      previousLevel: 1,
      normalDrawsEarned: 2,
      goldenDrawsEarned: 1,
    };
    socket.onmessage?.({ data: JSON.stringify(message) } as MessageEvent);

    expect(handlers.onSettleResult).not.toHaveBeenCalled();
    const settlementError = handlers.onError.mock.calls[0]?.[0];
    if (!(settlementError instanceof Error)) {
      throw new Error('Expected settlement protocol error');
    }
    expect(settlementError.message).toContain('missing field');
    expect(socket.close).toHaveBeenCalledWith(1002, 'protocol_error');
  });
});
