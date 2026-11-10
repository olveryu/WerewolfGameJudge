/**
 * useRoomAudioResume: the resume gate is due for the host in a
 * narrated phase while the core marks an interruption; continuing
 * unblocks alerts, hides the gate, restarts BGM and replays.
 */
import { act, renderHook } from '@testing-library/react';

import { setAlertBlocked } from '@/utils/alert';

import { useRoomAudioResume } from '../useRoomAudioResume';

vi.mock('@/utils/alert', () => ({ setAlertBlocked: vi.fn() }));

interface Props {
  isHost: boolean;
  isNarratedPhase: boolean;
  revision: number;
  interrupted: boolean;
}

/** A fake audio core: the interruption mark clears synchronously when resume starts, as the real core does. */
function renderResume(initial: Props) {
  const core = { interrupted: initial.interrupted };
  const resume = vi.fn(async () => {
    core.interrupted = false;
  });
  const onResumed = vi.fn();
  const hook = renderHook(
    (props: Props) => {
      core.interrupted = props.interrupted && core.interrupted;
      return useRoomAudioResume({
        isHost: props.isHost,
        isNarratedPhase: props.isNarratedPhase,
        revision: props.revision,
        readWasAudioInterrupted: () => core.interrupted,
        resume,
        onResumed,
      });
    },
    { initialProps: initial },
  );
  return { ...hook, resume, onResumed, core };
}

const due: Props = {
  isHost: true,
  isNarratedPhase: true,
  revision: 1,
  interrupted: true,
};

beforeEach(() => vi.clearAllMocks());

describe('useRoomAudioResume', () => {
  it('becomes due for the host mid-narration and blocks lower alerts', () => {
    const { result } = renderResume(due);
    expect(result.current.isDue).toBe(true);
    expect(setAlertBlocked).toHaveBeenCalledWith(true);
  });

  it.each([
    ['non-host', { ...due, isHost: false }],
    ['outside narration', { ...due, isNarratedPhase: false }],
    ['no interruption', { ...due, interrupted: false }],
  ])('is not due for %s', (_label, props) => {
    const { result } = renderResume(props);
    expect(result.current.isDue).toBe(false);
    expect(setAlertBlocked).not.toHaveBeenCalled();
  });

  it('re-reads the mark on a new revision', () => {
    const { result, rerender, core } = renderResume({ ...due, interrupted: false });
    expect(result.current.isDue).toBe(false);
    core.interrupted = true;
    rerender({ ...due, revision: 2 });
    expect(result.current.isDue).toBe(true);
  });

  it('continue unblocks, hides, restarts BGM and replays', () => {
    const { result, resume, onResumed } = renderResume(due);
    act(() => result.current.continueGame());
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
