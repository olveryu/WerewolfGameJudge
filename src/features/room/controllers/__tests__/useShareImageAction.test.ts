/**
 * useShareImageAction: single-flight share returning the platform result;
 * a failure goes through the error pipeline and resolves 'failed'.
 */
import { act, renderHook } from '@testing-library/react-native';

import { handleError } from '@/utils/errorPipeline';

import { shareImagesBase64 } from '../../services/shareImage';
import { useShareImageAction } from '../useShareImageAction';

jest.mock('../../services/shareImage', () => ({ shareImagesBase64: jest.fn() }));
jest.mock('@/utils/errorPipeline', () => ({ handleError: jest.fn() }));

const images = [{ filename: 'a.png', getBase64: async () => 'base64' }];
const options = { label: '分享图片', alertMessage: '图片分享失败，请稍后重试。' };

beforeEach(() => jest.clearAllMocks());

describe('useShareImageAction', () => {
  it('returns the platform result and tracks isSharing', async () => {
    let finish!: (value: 'shared' | 'cancelled') => void;
    jest.mocked(shareImagesBase64).mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const { result } = renderHook(() => useShareImageAction(options));
    let outcome: Promise<string> | undefined;
    act(() => {
      outcome = result.current.share(images, '标题');
    });
    expect(result.current.isSharing).toBe(true);
    await act(async () => finish('cancelled'));
    expect(await outcome).toBe('cancelled');
    expect(result.current.isSharing).toBe(false);
    expect(shareImagesBase64).toHaveBeenCalledWith(images, '标题');
  });

  it('routes a failure through the error pipeline and resolves failed', async () => {
    jest.mocked(shareImagesBase64).mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useShareImageAction(options));
    let outcome = '';
    await act(async () => {
      outcome = await result.current.share(images, '标题');
    });
    expect(outcome).toBe('failed');
    expect(handleError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ label: '分享图片', alertMessage: '图片分享失败，请稍后重试。' }),
    );
  });

  it('fails fast on a re-entrant share', async () => {
    jest.mocked(shareImagesBase64).mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useShareImageAction(options));
    act(() => void result.current.share(images, '标题'));
    await expect(result.current.share(images, '标题')).rejects.toThrow(
      '[FAIL-FAST] 分享图片 is already in progress',
    );
  });
});
