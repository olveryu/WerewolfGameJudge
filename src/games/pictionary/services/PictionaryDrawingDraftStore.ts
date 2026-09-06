/** Strict MMKV persistence for the current user's unsubmitted Pictionary drawing. */

import { storage } from '@/services/infra/localStorage';

import {
  PICTIONARY_DRAWING_PALETTE,
  PICTIONARY_DRAWING_WIDTHS,
  type PictionaryDrawingColor,
  type PictionaryDrawingDraft,
  type PictionaryDrawingPoint,
  type PictionaryDrawingStroke,
  type PictionaryDrawingTool,
  type PictionaryDrawingWidth,
} from '../model/pictionaryDrawing';

const STORAGE_KEY_PREFIX = '@pictionary:drawing-draft:';
const STORAGE_VERSION = 1;
const MAX_STROKE_COUNT = 2_000;
const MAX_POINTS_PER_STROKE = 20_000;
const MAX_IDENTIFIER_LENGTH = 256;

interface DrawingDraftStorage {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export interface PictionaryDrawingDraftScope {
  readonly roomCode: string;
  readonly roundId: string;
  readonly taskId: string;
  readonly userId: string;
}

interface StoredPictionaryDrawingDraft {
  readonly version: 1;
  readonly scope: PictionaryDrawingDraftScope;
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

function parseScope(value: unknown): PictionaryDrawingDraftScope {
  const scope = requireRecord(value, 'Stored Pictionary draft scope');
  assertExactKeys(
    scope,
    ['roomCode', 'roundId', 'taskId', 'userId'],
    'Stored Pictionary draft scope',
  );
  return {
    roomCode: requireIdentifier(scope.roomCode, 'Pictionary draft room code'),
    roundId: requireIdentifier(scope.roundId, 'Pictionary draft round ID'),
    taskId: requireIdentifier(scope.taskId, 'Pictionary draft task ID'),
    userId: requireIdentifier(scope.userId, 'Pictionary draft user ID'),
  };
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
  if (value !== 'brush' && value !== 'eraser') {
    throw new Error('Stored Pictionary drawing tool is invalid');
  }
  return value;
}

function parseColor(value: unknown): PictionaryDrawingColor {
  const color = PICTIONARY_DRAWING_PALETTE.find((candidate) => candidate.value === value);
  if (color === undefined) throw new Error('Stored Pictionary drawing color is invalid');
  return color.value;
}

function parseWidth(value: unknown): PictionaryDrawingWidth {
  const width = PICTIONARY_DRAWING_WIDTHS.find((candidate) => candidate === value);
  if (width === undefined) throw new Error('Stored Pictionary drawing width is invalid');
  return width;
}

function parseStroke(value: unknown): PictionaryDrawingStroke {
  const stroke = requireRecord(value, 'Stored Pictionary drawing stroke');
  assertExactKeys(
    stroke,
    ['id', 'tool', 'color', 'width', 'points'],
    'Stored Pictionary drawing stroke',
  );
  if (
    !Array.isArray(stroke.points) ||
    stroke.points.length === 0 ||
    stroke.points.length > MAX_POINTS_PER_STROKE
  ) {
    throw new Error('Stored Pictionary drawing stroke points are invalid');
  }
  return {
    id: requireIdentifier(stroke.id, 'Pictionary drawing stroke ID'),
    tool: parseTool(stroke.tool),
    color: parseColor(stroke.color),
    width: parseWidth(stroke.width),
    points: stroke.points.map(parsePoint),
  };
}

function parseStrokeList(value: unknown, label: string): readonly PictionaryDrawingStroke[] {
  if (!Array.isArray(value) || value.length > MAX_STROKE_COUNT) {
    throw new Error(`${label} is invalid`);
  }
  const strokes = value.map(parseStroke);
  if (new Set(strokes.map((stroke) => stroke.id)).size !== strokes.length) {
    throw new Error(`${label} contains duplicate stroke IDs`);
  }
  return strokes;
}

function parseDraft(value: unknown): PictionaryDrawingDraft {
  const draft = requireRecord(value, 'Stored Pictionary drawing draft');
  assertExactKeys(draft, ['redoStrokes', 'strokes'], 'Stored Pictionary drawing draft');
  return {
    strokes: parseStrokeList(draft.strokes, 'Stored Pictionary strokes'),
    redoStrokes: parseStrokeList(draft.redoStrokes, 'Stored Pictionary redo strokes'),
  };
}

function hasSameScope(
  first: PictionaryDrawingDraftScope,
  second: PictionaryDrawingDraftScope,
): boolean {
  return (
    first.roomCode === second.roomCode &&
    first.roundId === second.roundId &&
    first.taskId === second.taskId &&
    first.userId === second.userId
  );
}

function getStorageKey(scope: PictionaryDrawingDraftScope): string {
  return `${STORAGE_KEY_PREFIX}${encodeURIComponent(scope.userId)}:${encodeURIComponent(scope.roomCode)}`;
}

/** Persists at most one active drawing per room and user. */
class PictionaryDrawingDraftStore {
  readonly #storage: DrawingDraftStorage;

  constructor(drawingDraftStorage: DrawingDraftStorage = storage) {
    this.#storage = drawingDraftStorage;
  }

  /** Read only a draft whose room, round, task, and user identity still match. */
  read(scope: PictionaryDrawingDraftScope): PictionaryDrawingDraft | null {
    const canonicalScope = parseScope(scope);
    const raw = this.#storage.getString(getStorageKey(canonicalScope));
    if (raw === undefined) return null;
    const storedValue: unknown = JSON.parse(raw);
    const stored = requireRecord(storedValue, 'Stored Pictionary draft envelope');
    assertExactKeys(stored, ['draft', 'scope', 'version'], 'Stored Pictionary draft envelope');
    if (stored.version !== STORAGE_VERSION) {
      throw new Error('Stored Pictionary draft has an unsupported version');
    }
    const storedScope = parseScope(stored.scope);
    if (!hasSameScope(storedScope, canonicalScope)) {
      this.#storage.remove(getStorageKey(canonicalScope));
      return null;
    }
    return parseDraft(stored.draft);
  }

  /** Replace the current drawing draft, removing storage for an empty draft. */
  write(scope: PictionaryDrawingDraftScope, draft: PictionaryDrawingDraft): void {
    const canonicalScope = parseScope(scope);
    const canonicalDraft = parseDraft(draft);
    if (canonicalDraft.strokes.length === 0 && canonicalDraft.redoStrokes.length === 0) {
      this.clear(canonicalScope);
      return;
    }
    const stored: StoredPictionaryDrawingDraft = {
      version: STORAGE_VERSION,
      scope: canonicalScope,
      draft: canonicalDraft,
    };
    this.#storage.set(getStorageKey(canonicalScope), JSON.stringify(stored));
  }

  /** Remove the active drawing draft for this room and user. */
  clear(scope: PictionaryDrawingDraftScope): void {
    this.#storage.remove(getStorageKey(parseScope(scope)));
  }
}

export const pictionaryDrawingDraftStore = new PictionaryDrawingDraftStore();
