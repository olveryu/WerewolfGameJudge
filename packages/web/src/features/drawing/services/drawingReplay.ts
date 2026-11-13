/** Build a length-weighted replay timeline once; seek by elapsed progress, not by frame count. */

import type { DrawingElement } from '../model/drawing';

interface ReplayStep {
  readonly element: DrawingElement;
  readonly pathLength: number;
  readonly startsAt: number;
  readonly endsAt: number;
}

function pathLength(element: DrawingElement, width: number, height: number): number {
  switch (element.kind) {
    case 'brush':
    case 'eraser':
      return element.points.reduce((length, point, index, points) => {
        const previous = points[index - 1];
        return (
          length +
          (previous === undefined
            ? 0
            : Math.hypot((point.x - previous.x) * width, (point.y - previous.y) * height))
        );
      }, 0);
    case 'line':
      return Math.hypot(
        (element.end.x - element.start.x) * width,
        (element.end.y - element.start.y) * height,
      );
    case 'rectangle':
      return (
        2 *
        (Math.abs(element.end.x - element.start.x) * width +
          Math.abs(element.end.y - element.start.y) * height)
      );
    case 'ellipse': {
      const horizontalRadius = (Math.abs(element.end.x - element.start.x) * width) / 2;
      const verticalRadius = (Math.abs(element.end.y - element.start.y) * height) / 2;
      if (horizontalRadius + verticalRadius === 0) return 0;
      const ratio =
        ((horizontalRadius - verticalRadius) / (horizontalRadius + verticalRadius)) ** 2;
      return (
        Math.PI *
        (horizontalRadius + verticalRadius) *
        (1 + (3 * ratio) / (10 + Math.sqrt(4 - 3 * ratio)))
      );
    }
    case 'fill':
      return 0;
  }
}

/** Small taps and fills receive a bounded share of the timeline rather than disappearing. */
export function createDrawingReplayTimeline(
  elements: readonly DrawingElement[],
  width: number,
  height: number,
): readonly ReplayStep[] {
  const lengths = elements.map((element) => pathLength(element, width, height));
  const weights = lengths.map((length) => Math.max(24, length));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let elapsed = 0;
  return elements.map((element, index) => {
    const startsAt = elapsed;
    elapsed += weights[index]! / total;
    return {
      element,
      pathLength: lengths[index]!,
      startsAt,
      endsAt: index === elements.length - 1 ? 1 : elapsed,
    };
  });
}

/** Return the static prefix and at most one partially drawn element, including after a late join. */
export function getDrawingReplayFrame(timeline: readonly ReplayStep[], progress: number) {
  const bounded = Math.max(0, Math.min(1, progress));
  const completedCount = timeline.filter((step) => step.endsAt <= bounded).length;
  const current = timeline[completedCount];
  return {
    completedCount,
    current: current ?? null,
    elementProgress:
      current === undefined
        ? 1
        : (bounded - current.startsAt) / (current.endsAt - current.startsAt),
  };
}
