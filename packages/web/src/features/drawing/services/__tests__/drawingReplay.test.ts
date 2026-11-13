/** Replay preserves author order and allocates more animation time to longer paths. */

import type { DrawingElement } from '../../model/drawing';
import { createDrawingReplayTimeline, getDrawingReplayFrame } from '../drawingReplay';

const short: DrawingElement = {
  id: 'short',
  kind: 'brush',
  color: '#171717',
  width: 5,
  points: [
    { x: 0, y: 0 },
    { x: 0.1, y: 0 },
  ],
};
const long: DrawingElement = {
  ...short,
  id: 'long',
  kind: 'eraser',
  points: [
    { x: 0, y: 0 },
    { x: 0.9, y: 0 },
  ],
};
const fill: DrawingElement = {
  id: 'fill',
  kind: 'fill',
  color: '#171717',
  width: 5,
  rectangles: [{ x: 0, y: 0, width: 10, height: 10 }],
};

it('seeks directly into the correct stroke using geometric length, not point count', () => {
  const timeline = createDrawingReplayTimeline([short, long], 1000, 750);
  const frame = getDrawingReplayFrame(timeline, 0.55);
  expect(frame.completedCount).toBe(1);
  expect(frame.current?.element.id).toBe('long');
  expect(frame.elementProgress).toBeCloseTo(0.5);
  expect(getDrawingReplayFrame(timeline, 1).completedCount).toBe(2);
  expect(getDrawingReplayFrame(timeline, 1).current).toBeNull();
});

it('retains the order of fills and single taps, including exact boundaries', () => {
  const tap: DrawingElement = { ...short, points: [{ x: 0, y: 0 }] };
  const timeline = createDrawingReplayTimeline([tap, fill, long], 100, 75);
  const boundary = timeline[0]!.endsAt;
  expect(getDrawingReplayFrame(timeline, boundary).current?.element).toBe(fill);
  expect(getDrawingReplayFrame(timeline, boundary).elementProgress).toBe(0);
  expect(getDrawingReplayFrame(timeline, 0).completedCount).toBe(0);
  expect(getDrawingReplayFrame(timeline, 1).completedCount).toBe(3);
  expect(getDrawingReplayFrame([], 1).current).toBeNull();
});
