import {
  cfGet,
  cfPost,
  CloudflareHttpError,
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
});
