import { type RefObject, useLayoutEffect, useState } from 'react';

/** A rectangle in viewport CSS pixels, the coordinates the reveal's Pixi layers draw in. */
export interface ViewRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

function sameRect(a: ViewRect | null, b: ViewRect): boolean {
  return a !== null && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

/**
 * The viewport rect of `anchor`, re-measured when it or the window resizes. Anchors are
 * untransformed placeholders, so a card's own entrance transforms do not move the canvas art.
 */
export function useAnchorRect(anchor: RefObject<HTMLElement | null>): ViewRect | null {
  const [rect, setRect] = useState<ViewRect | null>(null);
  useLayoutEffect(() => {
    const element = anchor.current;
    if (!element) {
      throw new Error('useAnchorRect needs its anchor element mounted');
    }
    const measure = () => {
      const bounds = element.getBoundingClientRect();
      const next = { x: bounds.left, y: bounds.top, width: bounds.width, height: bounds.height };
      setRect((previous) => (sameRect(previous, next) ? previous : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [anchor]);
  return rect;
}
