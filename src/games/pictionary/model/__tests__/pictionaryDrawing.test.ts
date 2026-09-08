/** Pictionary drawing element history contracts. */

import {
  EMPTY_PICTIONARY_DRAWING_DRAFT,
  type PictionaryDrawingElement,
  reducePictionaryDrawingDraft,
} from '../pictionaryDrawing';

const LINE_ELEMENT: PictionaryDrawingElement = {
  id: 'line-1',
  kind: 'line',
  color: '#171717',
  width: 14,
  start: { x: 0.1, y: 0.2 },
  end: { x: 0.8, y: 0.7 },
};

const FILL_ELEMENT: PictionaryDrawingElement = {
  id: 'fill-1',
  kind: 'fill',
  color: '#E5484D',
  rectangles: [{ x: 1, y: 2, width: 10, height: 20 }],
};

describe('reducePictionaryDrawingDraft', () => {
  it('undoes and redoes complete drawing elements', () => {
    const withLine = reducePictionaryDrawingDraft(EMPTY_PICTIONARY_DRAWING_DRAFT, {
      type: 'element.add',
      element: LINE_ELEMENT,
    });
    const withFill = reducePictionaryDrawingDraft(withLine, {
      type: 'element.add',
      element: FILL_ELEMENT,
    });
    const undone = reducePictionaryDrawingDraft(withFill, { type: 'element.undo' });

    expect(undone.elements).toEqual([LINE_ELEMENT]);
    expect(undone.redoElements).toEqual([FILL_ELEMENT]);
    expect(reducePictionaryDrawingDraft(undone, { type: 'element.redo' })).toEqual(withFill);
  });

  it('clears redo history when a new element is added', () => {
    const withLine = reducePictionaryDrawingDraft(EMPTY_PICTIONARY_DRAWING_DRAFT, {
      type: 'element.add',
      element: LINE_ELEMENT,
    });
    const undone = reducePictionaryDrawingDraft(withLine, { type: 'element.undo' });
    const replaced = reducePictionaryDrawingDraft(undone, {
      type: 'element.add',
      element: FILL_ELEMENT,
    });

    expect(replaced.elements).toEqual([FILL_ELEMENT]);
    expect(replaced.redoElements).toEqual([]);
  });
});
