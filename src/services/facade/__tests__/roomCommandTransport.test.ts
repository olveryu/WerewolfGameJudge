import * as Sentry from '@sentry/react-native';
import {
  createRoomCommandResult,
  RoomCommandProtocolError,
  WEREWOLF_STATE_CODEC,
} from '@werewolf/game-engine';
import type { GameState } from '@werewolf/game-engine/protocol/types';

import { setRefreshHandler, setTokenProvider } from '@/services/cloudflare/cfFetch';
import { RoomCommandSession } from '@/services/facade/roomCommandSession';
import { isRoomCommandDeliveryUnknown } from '@/services/facade/roomCommandTransport';

import { buildApiTestState } from './apiTestState';

jest.mock('@sentry/react-native', () => ({
  captureException: jest.fn(),
  withScope: jest.fn((callback: (scope: unknown) => void) =>
    callback({
      setTag: jest.fn(),
      setFingerprint: jest.fn(),
    }),
  ),
}));

jest.mock('@/utils/logger', () => {
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  return { cfFetchLog: logger, facadeLog: logger };
});

interface ParsedEnvelope {
  roomCode: string;
  commandId: string;
  command: Record<string, unknown>;
  controlledSeat: number | null;
}

function parseEnvelope(init: RequestInit | undefined): ParsedEnvelope {
  if (typeof init?.body !== 'string') throw new Error('Expected a JSON request body');
  const value: unknown = JSON.parse(init.body);
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Expected an object request body');
  }
  if (
    !('roomCode' in value) ||
    typeof value.roomCode !== 'string' ||
    !('commandId' in value) ||
    typeof value.commandId !== 'string' ||
    !('command' in value) ||
    value.command === null ||
    typeof value.command !== 'object' ||
    Array.isArray(value.command) ||
    !('controlledSeat' in value) ||
    (value.controlledSeat !== null && typeof value.controlledSeat !== 'number')
  ) {
    throw new Error('Invalid room command envelope');
  }
  return {
    roomCode: value.roomCode,
    commandId: value.commandId,
    command: value.command as Record<string, unknown>,
    controlledSeat: value.controlledSeat,
  };
}

function jsonResponse(value: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    headers: { get: () => 'application/json' },
    json: () => Promise.resolve(value),
  } as unknown as Response;
}

function createDeferred<T>(): {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
} {
  let resolvePromise!: (value: T) => void;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: resolvePromise };
}

function committedResult(
  commandId: string,
  state: GameState,
  outcome: { kind: 'success'; reason?: string } | { kind: 'domainRejected'; reason: string } = {
    kind: 'success',
  },
) {
  return createRoomCommandResult({
    kind: 'committed',
    commandId,
    state,
    revision: 2,
    outcome,
  });
}

describe('dispatchRoomCommand', () => {
  const originalFetch = global.fetch;
  const state = buildApiTestState();
  const applySnapshot = jest.fn<void, [GameState, number]>();
  let session: RoomCommandSession<GameState>;

  beforeEach(() => {
    jest.clearAllMocks();
    setTokenProvider(() => null);
    setRefreshHandler(async () => 'expired');
    session = new RoomCommandSession({
      codec: WEREWOLF_STATE_CODEC,
      store: { applySnapshot },
    });
    session.enterRoom('ABCD', 'user-1');
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  function dispatch(controlledSeat: number | null = null) {
    return session.dispatch({
      roomCode: 'ABCD',
      command: { type: 'werewolf.roles.assign' },
      controlledSeat,
      label: 'assignRoles',
    });
  }

  it('uses authenticated /room/command without client actor authority', async () => {
    setTokenProvider(() => 'access-token');
    global.fetch = jest.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const envelope = parseEnvelope(init);
      return jsonResponse(committedResult(envelope.commandId, state));
    });

    await expect(dispatch()).resolves.toEqual({ success: true });

    const firstCall = jest.mocked(global.fetch).mock.calls[0];
    if (firstCall === undefined) throw new Error('Expected one fetch call');
    if (typeof firstCall[0] !== 'string') throw new Error('Expected string request URL');
    expect(firstCall[0]).toContain('/room/command');
    const headers = firstCall[1]?.headers;
    if (headers === undefined || typeof headers !== 'object' || !('Authorization' in headers)) {
      throw new Error('Expected Authorization request header');
    }
    expect(headers.Authorization).toBe('Bearer access-token');
    const envelope = parseEnvelope(firstCall[1]);
    expect(envelope.roomCode).toBe('ABCD');
    expect(envelope.commandId).toEqual(expect.any(String));
    expect(envelope.command).toEqual({ type: 'werewolf.roles.assign' });
    expect(envelope.controlledSeat).toBeNull();
    expect(envelope.command).not.toHaveProperty('userId');
    expect(envelope.command).not.toHaveProperty('seat');
    expect(envelope.command).not.toHaveProperty('role');
    expect(applySnapshot).toHaveBeenCalledWith(state, 2);
  });

  it('applies a committed snapshot before mapping a domain rejection', async () => {
    global.fetch = jest.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const { commandId } = parseEnvelope(init);
      return jsonResponse(
        committedResult(commandId, state, {
          kind: 'domainRejected',
          reason: 'invalid_status',
        }),
      );
    });

    await expect(dispatch(3)).resolves.toEqual({
      success: false,
      reason: 'invalid_status',
    });
    expect(applySnapshot).toHaveBeenCalledWith(state, 2);
    const firstCall = jest.mocked(global.fetch).mock.calls[0];
    if (firstCall === undefined) throw new Error('Expected one fetch call');
    expect(parseEnvelope(firstCall[1]).controlledSeat).toBe(3);
  });

  it('maps a receipt-backed rejected decision without applying state', async () => {
    global.fetch = jest.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const { commandId } = parseEnvelope(init);
      return jsonResponse(
        createRoomCommandResult({ kind: 'rejected', commandId, reason: 'host_only' }),
      );
    });

    await expect(dispatch()).resolves.toEqual({ success: false, reason: 'host_only' });
    expect(applySnapshot).not.toHaveBeenCalled();
  });

  it('reuses the immutable commandId through a 5xx business retry', async () => {
    jest.useFakeTimers();
    const bodies: string[] = [];
    global.fetch = jest
      .fn()
      .mockImplementationOnce(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (typeof init?.body !== 'string') throw new Error('Expected request body');
        bodies.push(init.body);
        return jsonResponse({ reason: 'SERVER_ERROR' }, 503);
      })
      .mockImplementationOnce(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (typeof init?.body !== 'string') throw new Error('Expected request body');
        bodies.push(init.body);
        const { commandId } = parseEnvelope(init);
        return jsonResponse(committedResult(commandId, state));
      });

    const resultPromise = dispatch();
    await jest.advanceTimersByTimeAsync(300);

    await expect(resultPromise).resolves.toEqual({ success: true });
    expect(bodies).toHaveLength(2);
    expect(bodies[1]).toBe(bodies[0]);
  });

  it('reuses the immutable envelope through a timeout business retry', async () => {
    jest.useFakeTimers();
    const bodies: string[] = [];
    global.fetch = jest
      .fn()
      .mockImplementationOnce(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (typeof init?.body !== 'string') throw new Error('Expected request body');
        bodies.push(init.body);
        throw Object.assign(new Error('Timed out'), { name: 'TimeoutError' });
      })
      .mockImplementationOnce(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (typeof init?.body !== 'string') throw new Error('Expected request body');
        bodies.push(init.body);
        const { commandId } = parseEnvelope(init);
        return jsonResponse(committedResult(commandId, state));
      });

    const resultPromise = dispatch();
    await jest.advanceTimersByTimeAsync(300);

    await expect(resultPromise).resolves.toEqual({ success: true });
    expect(bodies[1]).toBe(bodies[0]);
  });

  it('reuses the envelope through cfFetch network retries', async () => {
    jest.useFakeTimers();
    const bodies: string[] = [];
    let attempt = 0;
    global.fetch = jest.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (typeof init?.body !== 'string') throw new Error('Expected request body');
      bodies.push(init.body);
      attempt += 1;
      if (attempt < 3) throw new TypeError('Failed to fetch');
      const { commandId } = parseEnvelope(init);
      return jsonResponse(committedResult(commandId, state));
    });

    const resultPromise = dispatch();
    await jest.advanceTimersByTimeAsync(3_000);

    await expect(resultPromise).resolves.toEqual({ success: true });
    expect(bodies).toHaveLength(3);
    expect(new Set(bodies).size).toBe(1);
  });

  it('reuses the envelope through the cfFetch 401 refresh retry', async () => {
    let token = 'expired-token';
    setTokenProvider(() => token);
    setRefreshHandler(async () => {
      token = 'fresh-token';
      return 'refreshed';
    });
    const bodies: string[] = [];
    const authorization: Array<string | undefined> = [];
    global.fetch = jest
      .fn()
      .mockImplementationOnce(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (typeof init?.body !== 'string') throw new Error('Expected request body');
        bodies.push(init.body);
        authorization.push((init.headers as Record<string, string>).Authorization);
        return jsonResponse({ reason: 'UNAUTHORIZED' }, 401);
      })
      .mockImplementationOnce(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (typeof init?.body !== 'string') throw new Error('Expected request body');
        bodies.push(init.body);
        authorization.push((init.headers as Record<string, string>).Authorization);
        const { commandId } = parseEnvelope(init);
        return jsonResponse(committedResult(commandId, state));
      });

    await expect(dispatch()).resolves.toEqual({ success: true });
    expect(bodies[1]).toBe(bodies[0]);
    expect(authorization).toEqual(['Bearer expired-token', 'Bearer fresh-token']);
  });

  it('retains an ordinary command ID after unknown delivery until a decision arrives', async () => {
    jest.useFakeTimers();
    const bodies: string[] = [];
    let networkIsAvailable = false;
    global.fetch = jest.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (typeof init?.body !== 'string') throw new Error('Expected request body');
      bodies.push(init.body);
      if (!networkIsAvailable) throw new TypeError('Failed to fetch');
      const { commandId } = parseEnvelope(init);
      return jsonResponse(committedResult(commandId, state));
    });

    const firstAttempt = dispatch();
    await jest.advanceTimersByTimeAsync(3_000);
    await expect(firstAttempt).resolves.toEqual({ success: false, reason: 'NETWORK_ERROR' });

    networkIsAvailable = true;
    await expect(dispatch()).resolves.toEqual({ success: true });

    const firstBody = bodies[0];
    if (firstBody === undefined) throw new Error('Expected a command body');
    expect(bodies).toHaveLength(4);
    expect(new Set(bodies)).toEqual(new Set([firstBody]));
  });

  it('retains the command ID when the server confirms no decision was created', async () => {
    const bodies: string[] = [];
    global.fetch = jest
      .fn()
      .mockImplementationOnce(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (typeof init?.body !== 'string') throw new Error('Expected request body');
        bodies.push(init.body);
        return jsonResponse({ success: false, reason: 'no_state' }, 404);
      })
      .mockImplementationOnce(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (typeof init?.body !== 'string') throw new Error('Expected request body');
        bodies.push(init.body);
        const { commandId } = parseEnvelope(init);
        return jsonResponse(committedResult(commandId, state));
      });

    await expect(dispatch()).resolves.toEqual({ success: false, reason: 'no_state' });
    await expect(dispatch()).resolves.toEqual({ success: true });

    expect(bodies).toHaveLength(2);
    expect(bodies[1]).toBe(bodies[0]);
  });

  it('releases a command ID only after its terminal decision', async () => {
    const commandIds: string[] = [];
    global.fetch = jest.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const { commandId } = parseEnvelope(init);
      commandIds.push(commandId);
      return jsonResponse(committedResult(commandId, state));
    });

    await expect(dispatch()).resolves.toEqual({ success: true });
    await expect(dispatch()).resolves.toEqual({ success: true });

    expect(commandIds).toHaveLength(2);
    expect(commandIds[1]).not.toBe(commandIds[0]);
  });

  it('reuses one immutable prepared envelope across separate dispatch calls', async () => {
    jest.useFakeTimers();
    const bodies: string[] = [];
    let networkIsAvailable = false;
    global.fetch = jest.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (typeof init?.body !== 'string') throw new Error('Expected request body');
      bodies.push(init.body);
      if (!networkIsAvailable) throw new TypeError('Failed to fetch');
      const { commandId } = parseEnvelope(init);
      return jsonResponse(committedResult(commandId, state));
    });
    const prepared = session.prepare({
      roomCode: 'ABCD',
      command: { type: 'werewolf.audio.ack' },
      controlledSeat: null,
    });
    const dispatchPrepared = () => session.dispatchPrepared(prepared, 'postAudioAck');

    expect(Object.isFrozen(prepared)).toBe(true);
    expect(Object.isFrozen(prepared.command)).toBe(true);

    const lostResponseAttempt = dispatchPrepared();
    await jest.advanceTimersByTimeAsync(3_000);
    await expect(lostResponseAttempt).resolves.toEqual({
      kind: 'deliveryUnknown',
      result: { success: false, reason: 'NETWORK_ERROR' },
    });

    networkIsAvailable = true;
    await expect(dispatchPrepared()).resolves.toEqual({
      kind: 'decided',
      result: { success: true },
    });

    const firstBody = bodies[0];
    if (firstBody === undefined) throw new Error('Expected a prepared command body');
    expect(bodies).toHaveLength(4);
    expect(new Set(bodies)).toEqual(new Set([firstBody]));
    expect(parseEnvelope({ body: firstBody }).commandId).toBe(prepared.commandId);
  });

  it('retains the command ID after protocol corruption', async () => {
    const bodies: string[] = [];
    global.fetch = jest
      .fn()
      .mockImplementationOnce(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (typeof init?.body !== 'string') throw new Error('Expected request body');
        bodies.push(init.body);
        return jsonResponse(committedResult('different-command-id', state));
      })
      .mockImplementationOnce(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (typeof init?.body !== 'string') throw new Error('Expected request body');
        bodies.push(init.body);
        const { commandId } = parseEnvelope(init);
        return jsonResponse(committedResult(commandId, state));
      });

    await expect(dispatch()).rejects.toBeInstanceOf(RoomCommandProtocolError);
    expect(applySnapshot).not.toHaveBeenCalled();
    expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(RoomCommandProtocolError));

    await expect(dispatch()).resolves.toEqual({ success: true });
    expect(bodies[1]).toBe(bodies[0]);
  });

  it('does not apply a late snapshot after leaving the command session', async () => {
    const response = createDeferred<Response>();
    let commandId = '';
    global.fetch = jest.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      commandId = parseEnvelope(init).commandId;
      return response.promise;
    });

    const pending = dispatch();
    await Promise.resolve();
    session.leaveRoom();
    if (commandId.length === 0) throw new Error('Expected pending room command response');
    response.resolve(jsonResponse(committedResult(commandId, state)));

    await expect(pending).resolves.toEqual({ success: true });
    expect(applySnapshot).not.toHaveBeenCalled();
  });
});

describe('isRoomCommandDeliveryUnknown', () => {
  it.each([
    'NETWORK_ERROR',
    'TIMEOUT',
    'SERVER_ERROR',
    'INTERNAL_ERROR',
    'SERVICE_UNAVAILABLE',
    'OVERLOADED',
  ])('classifies %s as an indeterminate delivery', (reason) => {
    expect(isRoomCommandDeliveryUnknown({ success: false, reason })).toBe(true);
  });

  it('does not retry receipt-backed or domain rejections', () => {
    expect(isRoomCommandDeliveryUnknown({ success: false, reason: 'invalid_status' })).toBe(false);
    expect(isRoomCommandDeliveryUnknown({ success: true })).toBe(false);
  });
});
