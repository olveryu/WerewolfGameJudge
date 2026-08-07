import {
  cfGet,
  cfPost,
  CloudflareHttpError,
  CloudflareResponseJsonError,
  CloudflareResponseProtocolError,
  setRefreshHandler,
  setTokenProvider,
} from '../cfFetch';
import { parseSuccessResponse } from '../responseCodecs';

const originalFetch = global.fetch;
const mockFetch = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('cfFetch response boundary', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    global.fetch = mockFetch;
    setTokenProvider(() => null);
    setRefreshHandler(async () => 'expired');
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('returns only the value accepted by the endpoint decoder', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ value: 'decoded' }));

    await expect(
      cfGet(
        '/codec-test',
        (value) => {
          if (
            value === null ||
            typeof value !== 'object' ||
            !('value' in value) ||
            typeof value.value !== 'string'
          ) {
            throw new Error('value response must contain a string');
          }
          return value.value;
        },
        { noRetry: true, skipAuthIntercept: true },
      ),
    ).resolves.toBe('decoded');
  });

  it('wraps a rejected success payload as a protocol error with endpoint context', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ value: 1 }));

    const request = cfGet(
      '/strict-contract',
      () => {
        throw new Error('invalid owner payload');
      },
      { noRetry: true, skipAuthIntercept: true },
    );

    await expect(request).rejects.toMatchObject({
      name: 'CloudflareResponseProtocolError',
      path: '/strict-contract',
      status: 200,
      body: { value: 1 },
    });
    await expect(request).rejects.toBeInstanceOf(CloudflareResponseProtocolError);
  });

  it('classifies an unreadable successful JSON body separately from decoder failures', async () => {
    const response = jsonResponse({ success: true });
    jest.spyOn(response, 'text').mockRejectedValueOnce(new TypeError('body stream terminated'));
    const decode = jest.fn();
    mockFetch.mockResolvedValue(response);

    const request = cfGet('/unreadable-body', decode, {
      noRetry: true,
      skipAuthIntercept: true,
    });

    await expect(request).rejects.toMatchObject({
      name: 'CloudflareResponseJsonError',
      path: '/unreadable-body',
      status: 200,
      phase: 'body-read',
    });
    await expect(request).rejects.toBeInstanceOf(CloudflareResponseJsonError);
    expect(decode).not.toHaveBeenCalled();
  });

  it('classifies malformed JSON before the endpoint decoder runs', async () => {
    const decode = jest.fn();
    mockFetch.mockResolvedValue(
      new Response('{"truncated":', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const request = cfGet('/malformed-success-json', decode, {
      noRetry: true,
      skipAuthIntercept: true,
    });

    await expect(request).rejects.toMatchObject({
      name: 'CloudflareResponseJsonError',
      path: '/malformed-success-json',
      status: 200,
      phase: 'json-parse',
    });
    await expect(request).rejects.toBeInstanceOf(CloudflareResponseJsonError);
    expect(decode).not.toHaveBeenCalled();
  });

  it.each([
    [{ success: false, reason: 'INVALID_CREDENTIALS' }, 'INVALID_CREDENTIALS'],
    [{ error: 'unauthorized' }, 'unauthorized'],
  ])('normalizes the Worker error envelope %p', async (body, reason) => {
    mockFetch.mockResolvedValue(jsonResponse(body, 401));

    const request = cfGet('/error-contract', () => undefined, {
      noRetry: true,
      skipAuthIntercept: true,
    });

    await expect(request).rejects.toMatchObject({ status: 401, reason, body });
    await expect(request).rejects.toBeInstanceOf(CloudflareHttpError);
  });

  it('marks a malformed JSON error envelope as a server contract failure', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ message: 'not canonical' }, 400));

    await expect(
      cfGet('/malformed-error', () => undefined, {
        noRetry: true,
        skipAuthIntercept: true,
      }),
    ).rejects.toMatchObject({
      name: 'CloudflareHttpError',
      status: 400,
      reason: 'SERVER_ERROR',
      body: { message: 'not canonical' },
    });
  });

  it('rejects an ambiguous error envelope instead of choosing one reason', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({ reason: 'INTERNAL_ERROR', error: 'unauthorized' }, 500),
    );

    await expect(
      cfGet('/ambiguous-error', () => undefined, {
        noRetry: true,
        skipAuthIntercept: true,
      }),
    ).rejects.toMatchObject({ reason: 'SERVER_ERROR' });
  });

  it('classifies non-JSON upstream failures without attempting an owner decode', async () => {
    const decode = jest.fn();
    mockFetch.mockResolvedValue(
      new Response('<html>bad gateway</html>', {
        status: 502,
        headers: { 'content-type': 'text/html' },
      }),
    );

    await expect(
      cfGet('/upstream', decode, { noRetry: true, skipAuthIntercept: true }),
    ).rejects.toMatchObject({ status: 502, reason: 'SERVER_ERROR', body: null });
    expect(decode).not.toHaveBeenCalled();
  });

  it('decodes the retried response after one successful token refresh', async () => {
    let token = 'expired-token';
    setTokenProvider(() => token);
    setRefreshHandler(async () => {
      token = 'fresh-token';
      return 'refreshed';
    });
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ success: false, reason: 'TOKEN_REVOKED' }, 401))
      .mockResolvedValueOnce(jsonResponse({ success: true }));

    await expect(
      cfPost('/refresh-retry', undefined, parseSuccessResponse, { noRetry: true }),
    ).resolves.toBeUndefined();

    const retryCall = mockFetch.mock.calls[1];
    if (retryCall === undefined) throw new Error('Expected one request after token refresh');
    expect(new Headers(retryCall[1]?.headers).get('Authorization')).toBe('Bearer fresh-token');
  });

  it('combines caller cancellation with the request timeout signal', async () => {
    const controller = new AbortController();
    mockFetch.mockImplementationOnce(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          const signal = init?.signal;
          if (signal === null || signal === undefined) {
            throw new Error('Expected fetch to receive an AbortSignal');
          }
          signal.addEventListener(
            'abort',
            () => {
              const error = new Error('The fetch request was aborted');
              error.name = 'AbortError';
              reject(error);
            },
            { once: true },
          );
        }),
    );

    const request = cfPost('/cancelled-request', undefined, parseSuccessResponse, {
      noRetry: true,
      signal: controller.signal,
      skipAuthIntercept: true,
    });
    controller.abort();

    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    const fetchSignal = mockFetch.mock.calls[0]?.[1]?.signal;
    expect(fetchSignal).not.toBe(controller.signal);
    expect(fetchSignal?.aborted).toBe(true);
  });

  it('keeps caller cancellation attached while decoding the response body', async () => {
    const controller = new AbortController();
    let notifyBodyReadStarted: (() => void) | null = null;
    const bodyReadStarted = new Promise<void>((resolve) => {
      notifyBodyReadStarted = resolve;
    });
    const response = jsonResponse({ success: true });
    mockFetch.mockImplementationOnce((_input, init) => {
      const signal = init?.signal;
      if (signal === null || signal === undefined) {
        throw new Error('Expected fetch to receive an AbortSignal');
      }
      jest.spyOn(response, 'text').mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            if (notifyBodyReadStarted === null) {
              throw new Error('Expected response body read observer');
            }
            notifyBodyReadStarted();
            signal.addEventListener(
              'abort',
              () => {
                const error = new Error('The response body read was aborted');
                error.name = 'AbortError';
                reject(error);
              },
              { once: true },
            );
          }),
      );
      return Promise.resolve(response);
    });

    const request = cfPost('/cancelled-body', undefined, parseSuccessResponse, {
      noRetry: true,
      signal: controller.signal,
      skipAuthIntercept: true,
    });
    await bodyReadStarted;
    controller.abort();

    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('cancels network retry backoff without starting another fetch', async () => {
    const controller = new AbortController();
    const failFirstFetch = new AbortController();
    mockFetch.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          failFirstFetch.signal.addEventListener(
            'abort',
            () => reject(new TypeError('Failed to fetch')),
            { once: true },
          );
        }),
    );

    const request = cfPost('/cancelled-retry', undefined, parseSuccessResponse, {
      signal: controller.signal,
      skipAuthIntercept: true,
    });
    failFirstFetch.abort();
    await Promise.resolve();

    controller.abort();

    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('stops waiting for shared token refresh without cancelling the refresh', async () => {
    const controller = new AbortController();
    const startRefresh = new AbortController();
    const completeRefresh = new AbortController();
    const refreshStarted = new Promise<void>((resolve) => {
      startRefresh.signal.addEventListener('abort', () => resolve(), { once: true });
    });
    const refreshCompleted = new Promise<'refreshed'>((resolve) => {
      completeRefresh.signal.addEventListener('abort', () => resolve('refreshed'), {
        once: true,
      });
    });
    setRefreshHandler(() => {
      startRefresh.abort();
      return refreshCompleted;
    });
    mockFetch.mockResolvedValueOnce(jsonResponse({ success: false, reason: 'TOKEN_REVOKED' }, 401));

    const request = cfPost('/cancelled-refresh', undefined, parseSuccessResponse, {
      noRetry: true,
      signal: controller.signal,
    });
    await refreshStarted;
    controller.abort();

    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    completeRefresh.abort();
    await refreshCompleted;
    await Promise.resolve();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
