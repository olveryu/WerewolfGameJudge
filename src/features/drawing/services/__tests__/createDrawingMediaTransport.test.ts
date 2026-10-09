/** Contract tests for the shared drawing media transport factory. */

import {
  parseRoomCommandResult,
  type RoomCommandResult,
} from '@game-judge/game-engine/platform/protocol/commandResult';
import type {
  BaseGameState,
  GameStateCodec,
} from '@game-judge/game-engine/platform/protocol/roomSnapshot';

import { cfGetBinary, cfPutBinary } from '@/services/cloudflare/cfFetch';

import { createDrawingMediaTransport } from '../createDrawingMediaTransport';

jest.mock('@/services/cloudflare/cfFetch', () => ({
  cfGetBinary: jest.fn(),
  cfPutBinary: jest.fn(),
}));

jest.mock('@game-judge/game-engine/platform/protocol/commandResult', () => {
  const actual = jest.requireActual<
    typeof import('@game-judge/game-engine/platform/protocol/commandResult')
  >('@game-judge/game-engine/platform/protocol/commandResult');
  return { ...actual, parseRoomCommandResult: jest.fn() };
});

interface FakeState extends BaseGameState<string> {
  readonly kind: 'fake';
}

const fakeCodec = {} as GameStateCodec<FakeState>;
const transport = createDrawingMediaTransport<FakeState>({
  gameId: 'pictionary',
  gameName: 'Pictionary',
  stateCodec: fakeCodec,
});

const mockPut = cfPutBinary as jest.MockedFunction<typeof cfPutBinary>;
const mockGet = cfGetBinary as jest.MockedFunction<typeof cfGetBinary>;
const mockParse = parseRoomCommandResult as jest.MockedFunction<typeof parseRoomCommandResult>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('createDrawingMediaTransport.uploadDrawing', () => {
  it('PUTs to the game submissions route without a seat query', async () => {
    mockPut.mockResolvedValue('ok');
    const png = new Blob(['x'], { type: 'image/png' });
    await transport.uploadDrawing('ROOM 1', 'sub/2', png, null);
    expect(mockPut).toHaveBeenCalledWith(
      '/api/games/pictionary/rooms/ROOM%201/submissions/sub%2F2',
      png,
      'image/png',
      expect.any(Function),
      { signal: undefined },
    );
  });

  it('appends the controlledSeat query when controlling a bot', async () => {
    mockPut.mockResolvedValue('ok');
    await transport.uploadDrawing('R1', 'S1', new Blob(['x']), 3);
    expect(mockPut.mock.calls[0]?.[0]).toBe(
      '/api/games/pictionary/rooms/R1/submissions/S1?controlledSeat=3',
    );
  });

  it('rejects an invalid controlled seat before any request', async () => {
    await expect(transport.uploadDrawing('R1', 'S1', new Blob(['x']), -1)).rejects.toThrow(
      '[FAIL-FAST] Invalid controlled Pictionary seat: -1',
    );
    expect(mockPut).not.toHaveBeenCalled();
  });

  it('rejects an empty path segment before any request', async () => {
    await expect(transport.uploadDrawing('', 'S1', new Blob(['x']), null)).rejects.toThrow(
      '[FAIL-FAST] Pictionary media path segment is empty',
    );
    expect(mockPut).not.toHaveBeenCalled();
  });

  it('verifies the response commandId against the game media-commit id', async () => {
    mockPut.mockImplementation(
      async (_url: string, _body: unknown, _type: string, parse: (value: unknown) => unknown) =>
        parse({}),
    );
    mockParse.mockReturnValue({ commandId: 'other:cmd' } as RoomCommandResult<FakeState>);
    await expect(transport.uploadDrawing('R1', 'S1', new Blob(['x']), null)).rejects.toThrow(
      'Pictionary media commandId mismatch: expected pictionary-media-commit:S1, received other:cmd',
    );
  });
});

describe('createDrawingMediaTransport.readDrawingDataUri', () => {
  it('GETs the media route and returns a base64 PNG data URI', async () => {
    mockGet.mockResolvedValue(new Uint8Array([104, 105]).buffer);
    const uri = await transport.readDrawingDataUri('R1', 'E1', null);
    expect(mockGet).toHaveBeenCalledWith('/api/games/pictionary/rooms/R1/media/E1', 'image/png', {
      signal: undefined,
    });
    expect(uri).toBe('data:image/png;base64,aGk=');
  });
});
