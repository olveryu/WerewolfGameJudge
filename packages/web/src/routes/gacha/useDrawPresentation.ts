/** Presentation only: confirmed rewards never depend on an animation callback or issue a draw. */
import { useEffect, useState } from 'react';

import type { DrawResultItem } from '@/features/gacha/services/gachaApi';

interface DrawPresentation {
  readonly phase: 'idle' | 'requesting' | 'animating' | 'results' | 'dismissed';
  readonly results: readonly DrawResultItem[];
}

/**
 * Keeps result access separate from the authoritative transaction and the optional animation.
 * When animation stops being allowed (backgrounded, reduced motion) an animating draw shows its
 * results at once, including a draw accepted by a callback captured before the change.
 */
export function useDrawPresentation(shouldAnimate: boolean, cancelAnimation: () => void) {
  const [presentation, setPresentation] = useState<DrawPresentation>({
    phase: 'idle',
    results: [],
  });
  if (!shouldAnimate && presentation.phase === 'animating') {
    setPresentation({ ...presentation, phase: 'results' });
  }

  useEffect(() => {
    if (!shouldAnimate) cancelAnimation();
  }, [shouldAnimate, cancelAnimation]);

  function begin() {
    setPresentation({ phase: 'requesting', results: [] });
  }
  function accept(results: readonly DrawResultItem[]) {
    if (results.length === 0) throw new Error('Confirmed draw must contain rewards');
    setPresentation({ phase: shouldAnimate ? 'animating' : 'results', results });
  }
  function showResults() {
    cancelAnimation();
    setPresentation((current) =>
      current.results.length > 0 ? { ...current, phase: 'results' } : current,
    );
  }
  function dismiss() {
    setPresentation((current) => ({ ...current, phase: 'dismissed' }));
  }
  function fail() {
    cancelAnimation();
    setPresentation({ phase: 'idle', results: [] });
  }

  return { presentation, begin, accept, showResults, dismiss, fail };
}
