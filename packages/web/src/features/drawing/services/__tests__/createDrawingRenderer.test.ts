/** Drawing renderer contracts: canonical coordinates, PNG export and backing-store release. */

import type { DrawingElement } from '../../model/drawing';
import { createDrawingRenderer } from '../createDrawingRenderer';

type PathCall = readonly [string, ...number[]];

class FakePath2D {
  static created: FakePath2D[] = [];
  readonly calls: PathCall[] = [];
  constructor() {
    FakePath2D.created.push(this);
  }
  moveTo(x: number, y: number) {
    this.calls.push(['moveTo', x, y]);
  }
  lineTo(x: number, y: number) {
    this.calls.push(['lineTo', x, y]);
  }
  rect(x: number, y: number, width: number, height: number) {
    this.calls.push(['rect', x, y, width, height]);
  }
  ellipse(...args: number[]) {
    this.calls.push(['ellipse', ...args]);
  }
}

const config = {
  width: 4,
  height: 3,
  maxBytes: 8,
  backgroundColor: '#ffffff',
  emptyDrawingMessage: 'empty drawing',
};
const brush: DrawingElement = {
  id: 'brush',
  kind: 'brush',
  color: '#ff0000',
  width: 5,
  points: [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
  ],
};

function createFakeContext() {
  return {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    lineCap: '',
    lineJoin: '',
    fillRect: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    getImageData: vi.fn(() => ({
      data: new Uint8ClampedArray(config.width * config.height * 4).fill(255),
    })),
  };
}

type FakeContext = ReturnType<typeof createFakeContext>;

let contexts: FakeContext[];
let canvases: HTMLCanvasElement[];
let contextAvailable: boolean;
let exportedPng: Blob | null;

function lastPath(): FakePath2D {
  const path = FakePath2D.created.at(-1);
  if (path === undefined) throw new Error('no path created');
  return path;
}

beforeEach(() => {
  FakePath2D.created = [];
  contexts = [];
  canvases = [];
  contextAvailable = true;
  exportedPng = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
  vi.stubGlobal('Path2D', FakePath2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
    this: HTMLCanvasElement,
  ) {
    canvases.push(this);
    if (!contextAvailable) return null;
    const context = createFakeContext();
    contexts.push(context);
    return context as never;
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
    callback(exportedPng);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('createDrawingRenderer', () => {
  const renderer = createDrawingRenderer(config);

  function paint(element: DrawingElement): FakeContext {
    const context = createFakeContext();
    renderer.painter.paintElement(context as never, element);
    return context;
  }

  it('scales normalized strokes to canonical pixels and keeps fill rectangles canonical', () => {
    paint(brush);
    expect(lastPath().calls).toEqual([
      ['moveTo', 0, 0],
      ['lineTo', 4, 3],
    ]);
    paint({
      id: 'fill',
      kind: 'fill',
      color: '#ff0000',
      width: 5,
      rectangles: [{ x: 1, y: 1, width: 2, height: 1 }],
    });
    expect(lastPath().calls).toEqual([['rect', 1, 1, 2, 1]]);
  });

  it.each(['rectangle', 'ellipse'] as const)('normalizes reversed %s bounds', (kind) => {
    paint({
      id: kind,
      kind,
      color: '#ff0000',
      width: 5,
      start: { x: 1, y: 1 },
      end: { x: 0.25, y: 0.5 },
    });
    expect(lastPath().calls).toEqual(
      kind === 'rectangle'
        ? [['rect', 1, 1.5, 3, 1.5]]
        : [['ellipse', 2.5, 2.25, 1.5, 0.75, 0, 0, 2 * Math.PI]],
    );
  });

  it('strokes erasers with the background and fills fill regions without stroking', () => {
    const eraser = paint({ ...brush, kind: 'eraser' });
    expect(eraser.strokeStyle).toBe('#ffffff');
    expect(eraser.lineWidth).toBe(5);
    expect(eraser.stroke).toHaveBeenCalledTimes(1);
    const fill = paint({ id: 'fill', kind: 'fill', color: '#00ff00', width: 5, rectangles: [] });
    expect(fill.fillStyle).toBe('#00ff00');
    expect(fill.fill).toHaveBeenCalledTimes(1);
    expect(fill.stroke).not.toHaveBeenCalled();
  });

  it('exports the PNG at canonical dimensions and releases the backing store', async () => {
    await expect(renderer.renderDrawing([brush])).resolves.toBe(exportedPng);
    expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenCalledWith(
      expect.any(Function),
      'image/png',
    );
    expect(contexts[0]?.fillRect).toHaveBeenCalledWith(0, 0, 4, 3);
    expect(canvases[0]).toMatchObject({ width: 0, height: 0 });
  });

  it('rejects an empty drawing before allocating a canvas', async () => {
    await expect(renderer.renderDrawing([])).rejects.toThrow('empty drawing');
    expect(canvases).toHaveLength(0);
  });

  it('rejects oversized PNGs after releasing the backing store', async () => {
    exportedPng = new Blob([new Uint8Array(config.maxBytes + 1)], { type: 'image/png' });
    await expect(renderer.renderDrawing([brush])).rejects.toThrow('画作超过');
    expect(canvases[0]).toMatchObject({ width: 0, height: 0 });
  });

  it('rejects when the canvas cannot encode a PNG', async () => {
    exportedPng = null;
    await expect(renderer.renderDrawing([brush])).rejects.toThrow('无法导出画作');
    expect(canvases[0]).toMatchObject({ width: 0, height: 0 });
  });

  it('preserves four-connected fill bounds at the bottom-right edge and skips identical colors', () => {
    expect(renderer.createFillElement([], { x: 1, y: 1 }, '#ffffff')).toBeNull();
    expect(renderer.createFillElement([], { x: 1, y: 1 }, '#ff0000')).toMatchObject({
      kind: 'fill',
      color: '#ff0000',
      width: 5,
      rectangles: [{ x: 0, y: 0, width: 4, height: 3 }],
    });
    expect(canvases).toHaveLength(2);
    for (const canvas of canvases) expect(canvas).toMatchObject({ width: 0, height: 0 });
  });

  it('fails fast when no fill canvas context is available', () => {
    contextAvailable = false;
    expect(() => renderer.createFillElement([], { x: 0, y: 0 }, '#ff0000')).toThrow(
      '无法创建填充计算画布',
    );
  });
});
