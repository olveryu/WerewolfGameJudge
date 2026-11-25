import { wxReLaunchWithNonce } from '../miniProgram';

describe('wxReLaunchWithNonce', () => {
  afterEach(() => {
    delete window.wx;
    window.history.replaceState(null, '', '/');
  });

  it.each(['/', '/room/1234?source=share%26invite#seat'])('preserves %s through login', (path) => {
    window.history.replaceState(null, '', path);
    const sharedUrl = window.location.href;
    const reLaunch = vi.fn<(options: { url: string }) => void>();
    window.wx = { miniProgram: { reLaunch } };

    wxReLaunchWithNonce('claim-nonce');

    expect(reLaunch).toHaveBeenCalledOnce();
    const call = reLaunch.mock.calls[0];
    if (!call) throw new Error('Mini-program was not relaunched');
    const launchUrl = new URL(call[0].url, window.location.origin);
    expect(launchUrl.pathname).toBe('/pages/index/index');
    expect(launchUrl.searchParams.get('nonce')).toBe('claim-nonce');
    expect(launchUrl.searchParams.get('url')).toBe(sharedUrl);
  });
});
