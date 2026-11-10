/** Legendary frame highlight: one slow sweep around the rounded perimeter. */
import type { LineNode } from '@/scene/decoration';

import { perimeterSweepNodes } from './perimeterSweep';

/** One full lap per loop. */
export const legendaryShimmerNodes: readonly LineNode[] = perimeterSweepNodes({
  durationMs: 7000,
  sample: (t, perimeter) => ({ arcLength: t * perimeter, opacity: 0.45 }),
  dashLength: 12,
  color: '#FFFDE8',
  strokeWidth: 1.2,
});
