/** Strict MMKV persistence for the current user's unsubmitted Pictionary drawing. */

import {
  PICTIONARY_DRAWING_HEIGHT,
  PICTIONARY_DRAWING_WIDTH,
} from '@game-judge/game-engine/games/pictionary/public';

import { storage } from '@/services/infra/localStorage';

import {
  isPictionaryDrawingColor,
  PICTIONARY_DRAWING_WIDTHS,
  type PictionaryDrawingColor,
  type PictionaryDrawingDraft,
  type PictionaryDrawingElement,
  type PictionaryDrawingFillRectangle,
  type PictionaryDrawingPoint,
  type PictionaryDrawingTool,
  type PictionaryDrawingWidth,
} from '../model/pictionaryDrawing';
import {
  createPictionaryTaskDraftStorageKey,
  hasSamePictionaryTaskDraftScope,
  parsePictionaryTaskDraftScope,
  type PictionaryTaskDraftScope,
} from './pictionaryTaskDraftScope';

const STORAGE_KEY_PREFIX = '@pictionary:drawing-draft:';
const STORAGE_VERSION = 2;
const MAX_ELEMENT_COUNT = 2_000;
const MAX_POINTS_PER_STROKE = 20_000;
const MAX_FILL_RECTANGLE_COUNT = PICTIONARY_DRAWING_WIDTH * PICTIONARY_DRAWING_HEIGHT;
const MAX_IDENTIFIER_LENGTH = 256;

interface DrawingDraftStorage {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  remove(key: string): void;
}

interface StoredPictionaryDrawingDraft {
  readonly version: 2;
  readonly scope: PictionaryTaskDraftScope;
  readonly draft: PictionaryDrawingDraft;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
}

function assertExactKeys(
  value: Readonly<Record<string, unknown>>,
  expectedKeys: readonly string[],
  label: string,
): void {
  const actualKeys = Object.keys(value).sort();
  const canonicalKeys = [...expectedKeys].sort();
  if (
    actualKeys.length !== canonicalKeys.length ||
    actualKeys.some((key, index) => key !== canonicalKeys[index])
  ) {
    throw new Error(`${label} has unsupported fields`);
  }
}

function requireIdentifier(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_IDENTIFIER_LENGTH) {
    throw new Error(`${label} is invalid`);
  }
  return value;
}

function parsePoint(value: unknown): PictionaryDrawingPoint {
  const point = requireRecord(value, 'Stored Pictionary drawing point');
  assertExactKeys(point, ['x', 'y'], 'Stored Pictionary drawing point');
  if (
    typeof point.x !== 'number' ||
    !Number.isFinite(point.x) ||
    point.x < 0 ||
    point.x > 1 ||
    typeof point.y !== 'number' ||
    !Number.isFinite(point.y) ||
    point.y < 0 ||
    point.y > 1
  ) {
    throw new Error('Stored Pictionary drawing point is outside the normalized canvas');
  }
  return { x: point.x, y: point.y };
}

function parseTool(value: unknown): PictionaryDrawingTool {
  switch (value) {
    case 'brush':
    case 'eraser':
    case 'line':
    case 'rectangle':
    case 'ellipse':
    case 'fill':
      return value;
    default:
      throw new Error('Stored Pictionary drawing tool is invalid');
  }
}

function parseColor(value: unknown): PictionaryDrawingColor {
  if (!isPictionaryDrawingColor(value))
    throw new Error('Stored Pictionary drawing color is invalid');
  return value;
}

function parseWidth(value: unknown): PictionaryDrawingWidth {
  const width = PICTIONARY_DRAWING_WIDTHS.find((candidate) => candidate === value);
  if (width === undefined) throw new Error('Stored Pictionary drawing width is invalid');
  return width;
}

function parseFillRectangle(value: unknown): PictionaryDrawingFillRectangle {
  const rectangle = requireRecord(value, 'Stored Pictionary fill rectangle');
  assertExactKeys(rectangle, ['height', 'width', 'x', 'y'], 'Stored Pictionary fill rectangle');
  const { x, y, width, height } = rectangle;
  if (
    typeof x !== 'number' ||
    typeof y !== 'number' ||
    typeof width !== 'number' ||
    typeof height !== 'number' ||
    !Number.isSafeInteger(x) ||
    !Number.isSafeInteger(y) ||
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    x < 0 ||
    y < 0 ||
    width <= 0 ||
    height <= 0 ||
    x + width > PICTIONARY_DRAWING_WIDTH ||
    y + height > PICTIONARY_DRAWING_HEIGHT
  ) {
    throw new Error('Stored Pictionary fill rectangle is outside the canonical canvas');
  }
  return { x, y, width, height };
}

function parseElement(value: unknown): PictionaryDrawingElement {
  const element = requireRecord(value, 'Stored Pictionary drawing element');
  const kind = parseTool(element.kind);
  switch (kind) {
    case 'brush':
    case 'eraser':
      assertExactKeys(
        element,
        ['color', 'id', 'kind', 'points', 'width'],
        'Stored Pictionary freehand element',
      );
      if (
        !Array.isArray(element.points) ||
        element.points.length === 0 ||
        element.points.length > MAX_POINTS_PER_STROKE
      ) {
        throw new Error('Stored Pictionary drawing points are invalid');
      }
      return {
        id: requireIdentifier(element.id, 'Pictionary drawing element ID'),
        kind,
        color: parseColor(element.color),
        width: parseWidth(element.width),
        points: element.points.map(parsePoint),
      };
    case 'line':
    case 'rectangle':
    case 'ellipse':
      assertExactKeys(
        element,
        ['color', 'end', 'id', 'kind', 'start', 'width'],
        'Stored Pictionary shape element',
      );
      return {
        id: requireIdentifier(element.id, 'Pictionary drawing element ID'),
        kind,
        color: parseColor(element.color),
        width: parseWidth(element.width),
        start: parsePoint(element.start),
        end: parsePoint(element.end),
      };
    case 'fill':
      assertExactKeys(
        element,
        ['color', 'id', 'kind', 'rectangles'],
        'Stored Pictionary fill element',
      );
      if (
        !Array.isArray(element.rectangles) ||
        element.rectangles.length === 0 ||
        element.rectangles.length > MAX_FILL_RECTANGLE_COUNT
      ) {
        throw new Error('Stored Pictionary fill rectangles are invalid');
      }
      return {
        id: requireIdentifier(element.id, 'Pictionary drawing element ID'),
        kind,
        color: parseColor(element.color),
        rectangles: element.rectangles.map(parseFillRectangle),
      };
  }
}

function parseElementList(value: unknown, label: string): readonly PictionaryDrawingElement[] {
  if (!Array.isArray(value) || value.length > MAX_ELEMENT_COUNT) {
    throw new Error(`${label} is invalid`);
  }
  const elements = value.map(parseElement);
  if (new Set(elements.map((element) => element.id)).size !== elements.length) {
    throw new Error(`${label} contains duplicate element IDs`);
  }
  return elements;
}

function parseDraft(value: unknown): PictionaryDrawingDraft {
  const draft = requireRecord(value, 'Stored Pictionary drawing draft');
  assertExactKeys(draft, ['elements', 'redoElements'], 'Stored Pictionary drawing draft');
  return {
    elements: parseElementList(draft.elements, 'Stored Pictionary elements'),
    redoElements: parseElementList(draft.redoElements, 'Stored Pictionary redo elements'),
  };
}

/** Persists independent active drawings for each user-owned relay task. */
class PictionaryDrawingDraftStore {
  readonly #storage: DrawingDraftStorage;

  constructor(drawingDraftStorage: DrawingDraftStorage = storage) {
    this.#storage = drawingDraftStorage;
  }

  /** Read only a draft whose room, round, task, and user identity still match. */
  read(scope: PictionaryTaskDraftScope): PictionaryDrawingDraft | null {
    const canonicalScope = parsePictionaryTaskDraftScope(scope);
    const storageKey = createPictionaryTaskDraftStorageKey(STORAGE_KEY_PREFIX, canonicalScope);
    const raw = this.#storage.getString(storageKey);
    if (raw === undefined) return null;
    const storedValue: unknown = JSON.parse(raw);
    const stored = requireRecord(storedValue, 'Stored Pictionary draft envelope');
    assertExactKeys(stored, ['draft', 'scope', 'version'], 'Stored Pictionary draft envelope');
    if (stored.version === 1) {
      this.#storage.remove(storageKey);
      return null;
    }
    if (stored.version !== STORAGE_VERSION) {
      throw new Error('Stored Pictionary draft has an unsupported version');
    }
    const storedScope = parsePictionaryTaskDraftScope(stored.scope);
    if (!hasSamePictionaryTaskDraftScope(storedScope, canonicalScope)) {
      throw new Error('Stored Pictionary drawing draft scope does not match its key');
    }
    return parseDraft(stored.draft);
  }

  /** Replace the current drawing draft, removing storage for an empty draft. */
  write(scope: PictionaryTaskDraftScope, draft: PictionaryDrawingDraft): void {
    const canonicalScope = parsePictionaryTaskDraftScope(scope);
    const canonicalDraft = parseDraft(draft);
    if (canonicalDraft.elements.length === 0 && canonicalDraft.redoElements.length === 0) {
      this.clear(canonicalScope);
      return;
    }
    const stored: StoredPictionaryDrawingDraft = {
      version: STORAGE_VERSION,
      scope: canonicalScope,
      draft: canonicalDraft,
    };
    this.#storage.set(
      createPictionaryTaskDraftStorageKey(STORAGE_KEY_PREFIX, canonicalScope),
      JSON.stringify(stored),
    );
  }

  /** Remove the active drawing draft for this room and user. */
  clear(scope: PictionaryTaskDraftScope): void {
    this.#storage.remove(
      createPictionaryTaskDraftStorageKey(STORAGE_KEY_PREFIX, parsePictionaryTaskDraftScope(scope)),
    );
  }
}

export const pictionaryDrawingDraftStore = new PictionaryDrawingDraftStore();
