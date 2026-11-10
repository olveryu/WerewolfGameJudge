/** DrawingCanvas: pointer capture, normalized stroke capture and a device-pixel backing store. */

import { act, fireEvent, render, screen } from '@testing-library/react';

import type { DrawingElement } from '../../model/drawing';
import type { DrawingPainter } from '../../services/createDrawingRenderer';
import { DrawingCanvas, type DrawingCanvasProps } from '../DrawingCanvas';

const TEST_ID = 'drawing-canvas';
const CANVAS_BOUNDS = { left: 10, top: 20, width: 200, height: 150 };

let resizeCallback: ResizeObserverCallback | null;
let setPointerCapture: ReturnType<typeof vi.fn>;
let context: { setTransform: ReturnType<typeof vi.fn>; clearRect: ReturnType<typeof vi.fn> };

function createPainter(): DrawingPainter {
  return { width: 400, height: 300, paintDrawing: vi.fn(), paintElement: vi.fn() };
}

function renderCanvas(overrides: Partial<DrawingCanvasProps> = {}) {
  const props: DrawingCanvasProps = {
    elements: [],
    tool: 'brush',
    color: '#ff0000',
    strokeWidth: 14,
    isEnabled: true,
    onElementChange: vi.fn(),
    onElementComplete: vi.fn(),
    onFill: vi.fn(),
    painter: createPainter(),
    testId: TEST_ID,
    ariaLabel: '画布',
    ...overrides,
  };
  const { rerender } = render(<DrawingCanvas {...props} />);
  return { props, rerender, input: screen.getByTestId(TEST_ID) };
}

function resize(entry: Partial<ResizeObserverEntry>) {
  if (resizeCallback === null) throw new Error('ResizeObserver was not created');
  const callback = resizeCallback;
  act(() => callback([entry as ResizeObserverEntry], {} as ResizeObserver));
}

beforeEach(() => {
  resizeCallback = null;
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
  setPointerCapture = vi.fn();
  Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
    configurable: true,
    value: setPointerCapture,
  });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
    CANVAS_BOUNDS as DOMRect,
  );
  context = { setTransform: vi.fn(), clearRect: vi.fn() };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as never);
});

afterEach(() => {
  Reflect.deleteProperty(HTMLElement.prototype, 'setPointerCapture');
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('DrawingCanvas', () => {
  it('captures the pointer and reports a normalized stroke until the pointer lifts', () => {
    const { props, input } = renderCanvas();
    fireEvent.pointerDown(input, { pointerId: 7, pointerType: 'touch', clientX: 60, clientY: 95 });
    fireEvent.pointerMove(input, { pointerId: 7, clientX: 410, clientY: 0 });
    fireEvent.pointerMove(input, { pointerId: 8, clientX: 110, clientY: 95 });
    fireEvent.pointerUp(input, { pointerId: 7 });

    expect(setPointerCapture).toHaveBeenCalledWith(7);
    const completed = vi.mocked(props.onElementComplete).mock.calls[0]?.[0];
    expect(completed).toMatchObject({
      kind: 'brush',
      color: '#ff0000',
      width: 14,
      points: [
        { x: 0.25, y: 0.5 },
        { x: 1, y: 0 },
      ],
    });
    expect(props.onElementChange).toHaveBeenCalledTimes(2);
  });

  it('drags shape tools from the start point to the latest point', () => {
    const { props, input } = renderCanvas({ tool: 'rectangle' });
    fireEvent.pointerDown(input, { pointerId: 1, pointerType: 'pen', clientX: 10, clientY: 20 });
    fireEvent.pointerMove(input, { pointerId: 1, clientX: 110, clientY: 95 });
    fireEvent.pointerCancel(input, { pointerId: 1 });

    expect(vi.mocked(props.onElementComplete).mock.calls[0]?.[0]).toMatchObject({
      kind: 'rectangle',
      start: { x: 0, y: 0 },
      end: { x: 0.5, y: 0.5 },
    });
  });

  it('reports a fill point without capturing the pointer', () => {
    const { props, input } = renderCanvas({ tool: 'fill' });
    fireEvent.pointerDown(input, { pointerId: 1, pointerType: 'mouse', clientX: 110, clientY: 20 });

    expect(props.onFill).toHaveBeenCalledWith({ x: 0.5, y: 0 });
    expect(setPointerCapture).not.toHaveBeenCalled();
    expect(props.onElementChange).not.toHaveBeenCalled();
  });

  it('ignores input while disabled', () => {
    const disabled = renderCanvas({ isEnabled: false });
    fireEvent.pointerDown(disabled.input, { pointerId: 1, pointerType: 'touch' });
    expect(disabled.input).toHaveAttribute('aria-disabled', 'true');
    expect(disabled.props.onElementChange).not.toHaveBeenCalled();
  });

  it('ignores secondary mouse buttons', () => {
    const { props, input } = renderCanvas();
    fireEvent.pointerDown(input, { pointerId: 1, pointerType: 'mouse', button: 2 });
    expect(props.onElementChange).not.toHaveBeenCalled();
  });

  it('drops an in-progress stroke when the canvas becomes disabled', () => {
    const { props, rerender, input } = renderCanvas();
    fireEvent.pointerDown(input, { pointerId: 1, pointerType: 'touch', clientX: 10, clientY: 20 });
    rerender(<DrawingCanvas {...props} isEnabled={false} />);
    fireEvent.pointerMove(input, { pointerId: 1, clientX: 110, clientY: 95 });
    fireEvent.pointerUp(input, { pointerId: 1 });

    expect(props.onElementChange).toHaveBeenCalledTimes(1);
    expect(props.onElementComplete).not.toHaveBeenCalled();
  });

  it('sizes the backing store in device pixels and maps the canonical size onto it', () => {
    const painter = createPainter();
    const elements: DrawingElement[] = [];
    renderCanvas({ painter, elements });
    resize({ devicePixelContentBoxSize: [{ inlineSize: 800, blockSize: 600 }] });

    const [base, overlay] = document.querySelectorAll('canvas');
    expect(base).toMatchObject({ width: 800, height: 600 });
    expect(overlay).toMatchObject({ width: 800, height: 600 });
    expect(context.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0);
    expect(painter.paintDrawing).toHaveBeenCalledWith(context, elements);
  });

  it('falls back to the CSS box times devicePixelRatio without device-pixel boxes', () => {
    vi.stubGlobal('devicePixelRatio', 3);
    renderCanvas();
    resize({ contentRect: { width: 200, height: 150 } as DOMRectReadOnly });

    expect(document.querySelector('canvas')).toMatchObject({ width: 600, height: 450 });
  });
});
