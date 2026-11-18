/**
 * useRoomAudioResume: the resume gate is due for the host in a
 * narration recovery signal supplied by the shared core; continuing
 * unblocks alerts, hides the gate, restarts BGM and replays.
 */
import { act, renderHook } from '@testing-library/react';

import { setAlertBlocked } from '@/utils/alert';

import { useRoomAudioResume } from '../useRoomAudioResume';

vi.mock('@/utils/alert', () => ({ setAlertBlocked: vi.fn() }));

interface Props {
  isResumeRequired: boolean;
}

function renderResume(initial: Props) {
  const resume = vi.fn(async () => undefined);
  const onResumed = vi.fn();
  const hook = renderHook(
    (props: Props) => {
      return useRoomAudioResume({
        isResumeRequired: props.isResumeRequired,
        resume,
        onResumed,
      });
    },
    { initialProps: initial },
  );
  return { ...hook, resume, onResumed };
}

const due: Props = {
  isResumeRequired: true,
};

beforeEach(() => vi.clearAllMocks());

describe('useRoomAudioResume', () => {
  it('becomes due for the host mid-narration and blocks lower alerts', () => {
    const { result } = renderResume(due);
    expect(result.current.isDue).toBe(true);
    expect(setAlertBlocked).toHaveBeenCalledWith(true);
  });

  it('does not block alerts without a recovery signal', () => {
    const { result } = renderResume({ isResumeRequired: false });
    expect(result.current.isDue).toBe(false);
    expect(setAlertBlocked).not.toHaveBeenCalled();
  });

  it('reopens after playback failure without a room revision or phase dependency', () => {
    const { result, rerender } = renderResume({ isResumeRequired: false });
    expect(result.current.isDue).toBe(false);
    rerender(due);
    expect(result.current.isDue).toBe(true);
    rerender({ isResumeRequired: false });
    expect(result.current.isDue).toBe(false);
    expect(setAlertBlocked).toHaveBeenLastCalledWith(false);
    rerender(due);
    expect(result.current.isDue).toBe(true);
  });

  it('continue unblocks, hides, restarts BGM and replays', () => {
    const { result, resume, onResumed, rerender } = renderResume(due);
    act(() => result.current.continueGame());
    rerender({ isResumeRequired: false });
    expect(result.current.isDue).toBe(false);
    expect(setAlertBlocked).toHaveBeenLastCalledWith(false);
    expect(onResumed).toHaveBeenCalledTimes(1);
    expect(resume).toHaveBeenCalledTimes(1);
  });

  it('releases the alert block when the room unmounts while the gate is due', () => {
    const { unmount } = renderResume(due);
    unmount();
    expect(setAlertBlocked).toHaveBeenLastCalledWith(false);
  });
});
