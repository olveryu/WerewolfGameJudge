/**
 * Shared pieces for the SVG layers that replace Skia art drawn beneath DOM content.
 */
import type { CSSProperties } from 'react';

/** A full-viewport, click-through layer. */
export const FULL_SCREEN: CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  pointerEvents: 'none',
};

/**
 * Gaussian blur filters keyed by standard deviation (Skia's `<Blur blur>`), referenced as
 * `url(#${id}-blur-${sigma})`; the filter region is widened so blurred edges are not clipped.
 */
export function BlurFilters({
  id,
  sigmas,
}: {
  readonly id: string;
  readonly sigmas: readonly number[];
}) {
  return (
    <>
      {sigmas.map((sigma) => (
        <filter
          key={sigma}
          id={`${id}-blur-${sigma}`}
          x="-100%"
          y="-100%"
          width="300%"
          height="300%"
        >
          <feGaussianBlur stdDeviation={sigma} />
        </filter>
      ))}
    </>
  );
}
