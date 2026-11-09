/**
 * shareOrCopyRoomLink: touch devices use the share sheet; elsewhere the clipboard comes first
 * and the share sheet is the fallback; a dismissed sheet is 'cancelled'.
 */
import { shareOrCopyRoomLink } from '../roomShare';

function stubNavigator(value: {
  readonly maxTouchPoints: number;
  readonly share?: (data: ShareData) => Promise<void>;
  readonly clipboard?: { readonly writeText: (text: string) => Promise<void> };
}) {
  vi.stubGlobal('navigator', value);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const ROOM_URL = `${window.location.origin}/room/9999`;

describe('shareOrCopyRoomLink', () => {
  it('shares through the sheet on a touch device', async () => {
    const share = vi.fn(async () => undefined);
    stubNavigator({ maxTouchPoints: 1, share });
    await expect(shareOrCopyRoomLink('9999', '狼人杀')).resolves.toBe('shared');
    expect(share).toHaveBeenCalledWith({ title: '加入狼人杀房间 9999', url: ROOM_URL });
  });

  it('reports a dismissed sheet as cancelled and other failures as failed', async () => {
    stubNavigator({
      maxTouchPoints: 1,
      share: async () => Promise.reject(new DOMException('dismissed', 'AbortError')),
    });
    await expect(shareOrCopyRoomLink('9999', '狼人杀')).resolves.toBe('cancelled');
    stubNavigator({ maxTouchPoints: 1, share: async () => Promise.reject(new Error('x')) });
    await expect(shareOrCopyRoomLink('9999', '狼人杀')).resolves.toBe('failed');
  });

  it('copies the link on a desktop', async () => {
    const writeText = vi.fn(async () => undefined);
    const share = vi.fn(async () => undefined);
    stubNavigator({ maxTouchPoints: 0, share, clipboard: { writeText } });
    await expect(shareOrCopyRoomLink('9999', '狼人杀')).resolves.toBe('copied');
    expect(writeText).toHaveBeenCalledWith(ROOM_URL);
    expect(share).not.toHaveBeenCalled();
  });

  it('falls back to the share sheet on a desktop when the clipboard fails', async () => {
    const share = vi.fn(async () => undefined);
    stubNavigator({
      maxTouchPoints: 0,
      share,
      clipboard: { writeText: async () => Promise.reject(new Error('denied')) },
    });
    await expect(shareOrCopyRoomLink('9999', '狼人杀')).resolves.toBe('shared');
  });

  it('fails when neither the clipboard nor a share sheet is available', async () => {
    stubNavigator({ maxTouchPoints: 0 });
    await expect(shareOrCopyRoomLink('9999', '狼人杀')).resolves.toBe('failed');
  });
});
