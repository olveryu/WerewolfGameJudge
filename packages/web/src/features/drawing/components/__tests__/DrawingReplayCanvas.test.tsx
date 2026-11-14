/** Canvas replay paints the completed prefix only once and reveals a partial path with dashes. */

import { render, screen } from '@testing-library/react';

import type { DrawingElement } from '../../model/drawing';
import type { DrawingPainter } from '../../services/createDrawingRenderer';
import { DrawingReplayCanvas } from '../DrawingReplayCanvas';

const elements: readonly DrawingElement[] = [
  {
    id: 'first',
    kind: 'line',
    color: '#171717',
    width: 5,
    start: { x: 0, y: 0 },
    end: { x: 1, y: 0 },
  },
  {
    id: 'second',
    kind: 'eraser',
    color: '#171717',
    width: 5,
    points: [
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ],
  },
];

afterEach(() => vi.restoreAllMocks());

it('draws partial strokes and reuses the already completed prefix after a late seek', () => {
  const context = {
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    setLineDash: vi.fn(),
    lineDashOffset: 0,
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as never);
  const painter: DrawingPainter = {
    width: 100,
    height: 75,
    paintDrawing: vi.fn(),
    paintElement: vi.fn(),
  };
  const onUnavailable = vi.fn();
  const { rerender, unmount } = render(
    <DrawingReplayCanvas
      elements={elements}
      painter={painter}
      progress={0.25}
      label="逐笔揭晓"
      onUnavailable={onUnavailable}
    />,
  );
  expect(screen.getByRole('img', { name: '逐笔揭晓' })).toBeVisible();
  expect(context.setLineDash).toHaveBeenLastCalledWith([100, 100]);
  expect(context.lineDashOffset).toBe(50);
  vi.mocked(painter.paintElement).mockClear();
  rerender(
    <DrawingReplayCanvas
      elements={elements}
      painter={painter}
      progress={0.75}
      label="逐笔揭晓"
      onUnavailable={onUnavailable}
    />,
  );
  expect(painter.paintElement).toHaveBeenCalledTimes(2);
  expect(painter.paintElement).toHaveBeenNthCalledWith(1, context, elements[0]);
  expect(painter.paintElement).toHaveBeenNthCalledWith(2, context, elements[1]);
  vi.mocked(painter.paintElement).mockClear();
  rerender(
    <DrawingReplayCanvas
      elements={elements}
      painter={painter}
      progress={0.9}
      label="逐笔揭晓"
      onUnavailable={onUnavailable}
    />,
  );
  expect(painter.paintElement).toHaveBeenCalledExactlyOnceWith(context, elements[1]);
  expect(painter.paintDrawing).toHaveBeenCalledTimes(1);
  expect(onUnavailable).not.toHaveBeenCalled();
  unmount();
});

it('reports unavailable canvas rendering so the caller can display the PNG', () => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  const onUnavailable = vi.fn();
  render(
    <DrawingReplayCanvas
      elements={elements}
      painter={{ width: 100, height: 75, paintDrawing: vi.fn(), paintElement: vi.fn() }}
      progress={0}
      label="画作"
      onUnavailable={onUnavailable}
    />,
  );
  expect(onUnavailable).toHaveBeenCalledOnce();
  expect(onUnavailable).toHaveBeenCalledWith(
    expect.objectContaining({ message: 'Canvas 2D is unavailable for drawing replay' }),
  );
});
