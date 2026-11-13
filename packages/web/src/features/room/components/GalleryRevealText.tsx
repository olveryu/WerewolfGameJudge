/** Reveal whole graphemes while retaining full layout and an uninterrupted accessible text node. */

import './GalleryRevealText.css';

import { useMemo } from 'react';

import { type RevealTiming, useRevealProgress } from '@/features/room/hooks/useRevealProgress';
import type { ServerClock } from '@/services/serverClock';

/** Only the newest authorized entry receives timing; all previous entries remain complete. */
export function GalleryRevealText({
  text,
  timing,
  clock,
}: {
  readonly text: string;
  readonly timing: RevealTiming | null;
  readonly clock: ServerClock | null;
}) {
  const progress = useRevealProgress(timing, clock);
  const graphemes = useMemo(
    () =>
      typeof Intl.Segmenter === 'function'
        ? Array.from(
            new Intl.Segmenter('zh', { granularity: 'grapheme' }).segment(text),
            (segment) => segment.segment,
          )
        : null,
    [text],
  );
  if (graphemes === null) return <span>{text}</span>;
  const visibleCount = Math.floor(graphemes.length * progress);
  return (
    <span data-reveal-progress={progress === 1 ? 'complete' : 'revealing'}>
      {graphemes.slice(0, visibleCount).join('')}
      <span className="gallery-reveal-pending">{graphemes.slice(visibleCount).join('')}</span>
    </span>
  );
}
