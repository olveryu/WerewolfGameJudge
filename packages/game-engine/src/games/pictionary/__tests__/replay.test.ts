import { describe, expect, it } from 'vitest';

import { getPictionaryReplayDuration, PICTIONARY_DRAWING_REPLAY_SCHEMA } from '../state/replay';

describe('Pictionary replay validation', () => {
  const brush = { id: '1', kind: 'brush', color: '#aabbcc', width: 5, points: [{ x: 0, y: 1 }] };
  const brushes = (count: number, points = brush.points) =>
    Array.from({ length: count }, (_, index) => ({ ...brush, id: `b${index}`, points }));
  const accepts = (elements: unknown) =>
    PICTIONARY_DRAWING_REPLAY_SCHEMA.safeParse({ version: 1, elements }).success;

  it('accepts normalized elements and derives duration', () => {
    const replay = PICTIONARY_DRAWING_REPLAY_SCHEMA.parse({ version: 1, elements: [brush] });
    expect(getPictionaryReplayDuration(replay)).toBe(2000);
    expect(
      getPictionaryReplayDuration(
        PICTIONARY_DRAWING_REPLAY_SCHEMA.parse({ version: 1, elements: brushes(6) }),
      ),
    ).toBe(2400);
    expect(
      getPictionaryReplayDuration(
        PICTIONARY_DRAWING_REPLAY_SCHEMA.parse({ version: 1, elements: brushes(30) }),
      ),
    ).toBe(8000);
  });

  it('rejects invalid coordinates, colors, extra keys, and overflowing fills', () => {
    for (const element of [
      { ...brush, points: [{ x: 2, y: 0 }] },
      { ...brush, color: '#fff' },
      { ...brush, extra: true },
      {
        id: '2',
        kind: 'fill',
        color: '#ffffff',
        width: 5,
        rectangles: [{ x: 1023, y: 0, width: 2, height: 1 }],
      },
    ]) {
      expect(accepts([element])).toBe(false);
    }
  });

  it('rejects empty and unrenderable content', () => {
    expect(accepts([])).toBe(false);
    expect(accepts([{ ...brush, points: [] }])).toBe(false);
    expect(accepts([{ id: '2', kind: 'fill', color: '#ffffff', width: 5, rectangles: [] }])).toBe(
      false,
    );
  });

  it('rejects duplicate element ids', () => {
    expect(accepts([brush, { ...brush }])).toBe(false);
  });

  it('enforces element, per-stroke, and aggregate point limits', () => {
    expect(accepts(brushes(2000))).toBe(true);
    expect(accepts(brushes(2001))).toBe(false);
    const stroke = Array.from({ length: 4096 }, () => ({ x: 0.5, y: 0.5 }));
    expect(accepts(brushes(1, stroke))).toBe(true);
    expect(accepts(brushes(1, [...stroke, { x: 0, y: 0 }]))).toBe(false);
    expect(accepts(brushes(12, stroke))).toBe(true);
    expect(accepts(brushes(13, stroke))).toBe(false);
  });
});
