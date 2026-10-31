/**
 * LoopDashFlow — a dashed stroke whose dashes slide along their path (animated `strokeDashoffset`).
 *
 * Boundary: presentation only. A sliding dash pattern is periodic in `dashPeriod` units, so the
 * motion is rendered as `variantCount` static copies at successive offsets cross-faded by
 * `LoopMorph`, cycling `round(travel / dashPeriod)` times per loop. The rounding keeps the loop
 * seamless; it changes the travelled distance by less than one period. `renderDashes` must draw
 * the stroke with `strokeDashoffset={dashOffset}` and is called once per variant.
 * `sample` (optional) is an opacity envelope; it must be a module-level pure function.
 */
import { memo, type ReactNode, useCallback } from 'react';

import { LoopMorph, type MorphSampler } from './LoopMorph';

export interface LoopDashFlowProps {
  /** Tile pixel size: box edge and the value forwarded to `sample` / `renderDashes`. */
  size: number;
  /** Loop length in ms. */
  durationMs: number;
  /** Cycle offset in `[0, 1)`; defaults to 0. */
  phase?: number;
  /** `dash + gap` of the `strokeDasharray`, in path units. */
  dashPeriod: number;
  /** Distance the dashes travel per loop, in path units (the original `strokeDashoffset` sweep). */
  travel: number;
  /** Static copies per period; defaults to 12. Smaller steps blend more smoothly. */
  variantCount?: number;
  /** Opacity envelope over the loop; defaults to fully opaque. */
  sample?: MorphSampler;
  /** Draws the dashed stroke(s) at the given `strokeDashoffset` inside a `size × size` box. */
  renderDashes: (dashOffset: number, size: number) => ReactNode;
}

const DEFAULT_VARIANTS = 12;

const opaqueSampler: MorphSampler = () => ({ opacity: 1 });

export const LoopDashFlow = memo<LoopDashFlowProps>(
  ({
    size,
    durationMs,
    phase = 0,
    dashPeriod,
    travel,
    variantCount = DEFAULT_VARIANTS,
    sample = opaqueSampler,
    renderDashes,
  }) => {
    if (!(dashPeriod > 0) || !(travel > 0)) {
      throw new Error(
        `LoopDashFlow requires positive dashPeriod and travel, received ${dashPeriod} / ${travel}`,
      );
    }
    const renderVariant = useCallback(
      (k: number, s: number) => renderDashes(-(k / variantCount) * dashPeriod, s),
      [renderDashes, variantCount, dashPeriod],
    );
    return (
      <LoopMorph
        sample={sample}
        size={size}
        durationMs={durationMs}
        phase={phase}
        variantCount={variantCount}
        mode="crossfade"
        cyclesPerLoop={Math.max(1, Math.round(travel / dashPeriod))}
        renderVariant={renderVariant}
      />
    );
  },
);
LoopDashFlow.displayName = 'LoopDashFlow';
