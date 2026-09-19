/** Pictionary drawing draft storage version and element-union contracts. */

import {
  isPictionaryDrawingColor,
  type PictionaryDrawingDraft,
} from '../../model/pictionaryDrawing';
import { pictionaryDrawingDraftStore } from '../PictionaryDrawingDraftStore';
import type { PictionaryTaskDraftScope } from '../pictionaryTaskDraftScope';

const mockStoredValues = new Map<string, string>();

jest.mock('@/services/infra/localStorage', () => ({
  storage: {
    getString: (key: string): string | undefined => mockStoredValues.get(key),
    set: (key: string, value: string): void => {
      mockStoredValues.set(key, value);
    },
    remove: (key: string): void => {
      mockStoredValues.delete(key);
    },
  },
}));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseStoredRecord(rawValue: string): Record<string, unknown> {
  const parsedValue: unknown = JSON.parse(rawValue);
  if (!isRecord(parsedValue)) {
    throw new Error('Expected the stored Pictionary draft to be an object');
  }
  return parsedValue;
}

const SCOPE: PictionaryTaskDraftScope = {
  roomCode: '2468',
  roundId: 'round-1',
  taskId: 'chain-1:1',
  userId: 'user-1',
};

const DRAFT: PictionaryDrawingDraft = {
  elements: [
    {
      id: 'ellipse-1',
      kind: 'ellipse',
      color: '#3478F6',
      width: 14,
      start: { x: 0.1, y: 0.2 },
      end: { x: 0.7, y: 0.8 },
    },
    {
      id: 'fill-1',
      kind: 'fill',
      color: '#F5C542',
      rectangles: [{ x: 10, y: 20, width: 30, height: 40 }],
    },
  ],
  redoElements: [],
};

describe('PictionaryDrawingDraftStore', () => {
  beforeEach(() => mockStoredValues.clear());

  it('round-trips shape and fill elements in storage version 2', () => {
    pictionaryDrawingDraftStore.write(SCOPE, DRAFT);

    expect(pictionaryDrawingDraftStore.read(SCOPE)).toEqual(DRAFT);
    expect(parseStoredRecord([...mockStoredValues.values()][0]!).version).toBe(2);
  });

  it('keeps independent drafts for multiple tasks controlled by one user', () => {
    const secondScope: PictionaryTaskDraftScope = {
      ...SCOPE,
      taskId: 'chain-2:1',
    };
    const secondDraft: PictionaryDrawingDraft = {
      elements: [DRAFT.elements[0]!],
      redoElements: [],
    };

    pictionaryDrawingDraftStore.write(SCOPE, DRAFT);
    pictionaryDrawingDraftStore.write(secondScope, secondDraft);

    expect(pictionaryDrawingDraftStore.read(SCOPE)).toEqual(DRAFT);
    expect(pictionaryDrawingDraftStore.read(secondScope)).toEqual(secondDraft);
  });

  it('round-trips custom colors in drawing and redo history', () => {
    const customDraft: PictionaryDrawingDraft = {
      elements: DRAFT.elements.map((element) => ({ ...element, color: '#a13b8c' })),
      redoElements: [{ ...DRAFT.elements[0]!, color: '#123456' }],
    };

    pictionaryDrawingDraftStore.write(SCOPE, customDraft);

    expect(pictionaryDrawingDraftStore.read(SCOPE)).toEqual(customDraft);
  });

  it.each(['#fff', '#12345678', '#zzzzzz', 'red', null])('rejects invalid color %s', (color) => {
    expect(isPictionaryDrawingColor(color)).toBe(false);
  });

  it('removes an incompatible version-1 stroke draft', () => {
    pictionaryDrawingDraftStore.write(SCOPE, DRAFT);
    const [storageKey, rawValue] = [...mockStoredValues.entries()][0]!;
    const storedValue = parseStoredRecord(rawValue);
    mockStoredValues.set(storageKey, JSON.stringify({ ...storedValue, version: 1 }));

    expect(pictionaryDrawingDraftStore.read(SCOPE)).toBeNull();
    expect(mockStoredValues.has(storageKey)).toBe(false);
  });
});
