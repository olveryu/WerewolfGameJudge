/**
 * Drawing renderer contracts: canonical coordinates, PNG bytes and native resource cleanup.
 * @jest-environment node
 */

import {
  ImageFormat,
  PaintStyle,
  Skia,
  type SkPaint,
  type SkPath,
  type SkSurface,
} from '@shopify/react-native-skia';

import type { DrawingElement } from '../../model/drawing';
import { createDrawingRenderer } from '../createDrawingRenderer';

jest.mock('@shopify/react-native-skia', () => ({
  AlphaType: { Unpremul: 0 },
  ColorType: { RGBA_8888: 0 },
  ImageFormat: { PNG: 0 },
  PaintStyle: { Fill: 0, Stroke: 1 },
  StrokeCap: { Round: 0 },
  StrokeJoin: { Round: 0 },
  Skia: {
    Path: { Make: jest.fn() },
    Paint: jest.fn(),
    Surface: { MakeOffscreen: jest.fn() },
    Color: jest.fn(),
    XYWHRect: jest.fn(),
  },
}));

const mockPath = { moveTo: jest.fn(), lineTo: jest.fn(), addRect: jest.fn(), addOval: jest.fn() };
const mockPaint = {
  setAntiAlias: jest.fn(),
  setStyle: jest.fn(),
  setColor: jest.fn(),
  setStrokeCap: jest.fn(),
  setStrokeJoin: jest.fn(),
  setStrokeWidth: jest.fn(),
};
const mockImage = { readPixels: jest.fn(), encodeToBytes: jest.fn(), dispose: jest.fn() };
const mockCanvas = { drawColor: jest.fn(), drawPath: jest.fn() };
const mockSurface = {
  getCanvas: () => mockCanvas,
  flush: jest.fn(),
  makeImageSnapshot: () => mockImage,
  dispose: jest.fn(),
};
const config = {
  width: 4,
  height: 3,
  maxBytes: 8,
  backgroundColor: '#ffffff',
  emptyDrawingMessage: 'empty drawing',
};
const renderer = createDrawingRenderer(config);
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

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(Skia.Path.Make).mockReturnValue(mockPath as unknown as SkPath);
  jest.mocked(Skia.Paint).mockReturnValue(mockPaint as unknown as SkPaint);
  jest.mocked(Skia.Surface.MakeOffscreen).mockReturnValue(mockSurface as unknown as SkSurface);
  mockImage.encodeToBytes.mockReturnValue(new Uint8Array([1, 2, 3]));
  mockImage.readPixels.mockReturnValue(new Uint8Array(config.width * config.height * 4).fill(255));
});

describe('createDrawingRenderer', () => {
  it('scales normalized strokes and canonical fill rectangles to the display size', () => {
    renderer.createElementPath(brush, 40, 30);
    expect(mockPath.lineTo).toHaveBeenCalledWith(40, 30);
    renderer.createElementPath(
      {
        id: 'fill',
        kind: 'fill',
        color: '#ff0000',
        width: 5,
        rectangles: [{ x: 1, y: 1, width: 2, height: 1 }],
      },
      40,
      60,
    );
    expect(Skia.XYWHRect).toHaveBeenCalledWith(10, 20, 20, 20);
  });

  it.each(['rectangle', 'ellipse'] as const)('normalizes reversed %s bounds', (kind) => {
    renderer.createElementPath(
      {
        id: kind,
        kind,
        color: '#ff0000',
        width: 5,
        start: { x: 1, y: 1 },
        end: { x: 0.25, y: 0.5 },
      },
      40,
      30,
    );
    expect(Skia.XYWHRect).toHaveBeenCalledWith(10, 15, 30, 15);
    expect(kind === 'rectangle' ? mockPath.addRect : mockPath.addOval).toHaveBeenCalledTimes(1);
  });

  it('exports exact PNG bytes at canonical dimensions and releases snapshot and surface', async () => {
    const png = renderer.renderDrawing([brush]);
    expect(Skia.Surface.MakeOffscreen).toHaveBeenCalledWith(4, 3);
    expect(mockPaint.setStrokeWidth).toHaveBeenCalledWith(5);
    expect(mockImage.encodeToBytes).toHaveBeenCalledWith(ImageFormat.PNG, 100);
    expect(png.type).toBe('image/png');
    expect(new Uint8Array(await png.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    expect(mockImage.dispose).toHaveBeenCalledTimes(1);
    expect(mockSurface.dispose).toHaveBeenCalledTimes(1);
  });

  it('renders erasers with the background and fills without antialiasing or strokes', () => {
    renderer.renderDrawing([{ ...brush, kind: 'eraser' }]);
    expect(Skia.Color).toHaveBeenLastCalledWith('#ffffff');
    renderer.renderDrawing([
      {
        id: 'fill',
        kind: 'fill',
        color: '#ff0000',
        width: 5,
        rectangles: [],
      },
    ]);
    expect(mockPaint.setAntiAlias).toHaveBeenLastCalledWith(false);
    expect(mockPaint.setStyle).toHaveBeenLastCalledWith(PaintStyle.Fill);
    expect(mockPaint.setStrokeWidth).toHaveBeenCalledTimes(1);
  });

  it('preserves four-connected fill bounds at the bottom-right edge and skips identical colors', () => {
    expect(renderer.createFillElement([], { x: 1, y: 1 }, '#ffffff')).toBeNull();
    const fill = renderer.createFillElement([], { x: 1, y: 1 }, '#ff0000');
    expect(fill).toMatchObject({
      kind: 'fill',
      color: '#ff0000',
      width: 5,
      rectangles: [{ x: 0, y: 0, width: 4, height: 3 }],
    });
    expect(mockImage.dispose).toHaveBeenCalledTimes(2);
    expect(mockSurface.dispose).toHaveBeenCalledTimes(2);
  });

  it('rejects an empty drawing before allocating a surface', () => {
    expect(() => renderer.renderDrawing([])).toThrow('empty drawing');
    expect(Skia.Surface.MakeOffscreen).not.toHaveBeenCalled();
  });

  it('rejects oversized PNGs and releases their native resources', () => {
    mockImage.encodeToBytes.mockReturnValue(new Uint8Array(config.maxBytes + 1));
    expect(() => renderer.renderDrawing([brush])).toThrow('画作超过');
    expect(mockImage.dispose).toHaveBeenCalledTimes(1);
    expect(mockSurface.dispose).toHaveBeenCalledTimes(1);
  });

  it('releases resources when fill pixel reading fails', () => {
    mockImage.readPixels.mockReturnValue(null);
    expect(() => renderer.createFillElement([], { x: 0, y: 0 }, '#ff0000')).toThrow(
      '无法读取填充计算像素',
    );
    expect(mockImage.dispose).toHaveBeenCalledTimes(1);
    expect(mockSurface.dispose).toHaveBeenCalledTimes(1);
  });
});
