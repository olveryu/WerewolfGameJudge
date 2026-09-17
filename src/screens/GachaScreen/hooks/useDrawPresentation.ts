/** Presentation only: confirmed rewards never depend on an animation callback or issue a draw. */
import { useEffect, useState } from 'react';

import type { DrawResultItem } from '@/features/gacha/services/gachaApi';

type DrawPresentation =
  | { phase: 'idle' | 'requesting'; results: readonly DrawResultItem[] }
  | { phase: 'animating' | 'results' | 'dismissed'; results: readonly DrawResultItem[] };

/** Keeps result access separate from the authoritative transaction and optional animation. */
export function useDrawPresentation(shouldAnimate: boolean, cancelAnimation: () => void) {
  const [presentation, setPresentation] = useState<DrawPresentation>({
    phase: 'idle',
    results: [],
  });

  useEffect(() => {
    if (!shouldAnimate) {
      cancelAnimation();
      setPresentation((current) =>
        current.phase === 'animating' ? { ...current, phase: 'results' } : current,
      );
    }
  }, [shouldAnimate, cancelAnimation, presentation.phase]);

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
