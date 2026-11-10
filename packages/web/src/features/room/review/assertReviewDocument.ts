/**
 * Structural rules of a review document that types cannot express. A
 * violation is a game's construction error: it throws where the document
 * is resolved, never rendering a half-formed page.
 */

import type { RoomReviewDocument } from './types';

export function assertReviewDocument(document: RoomReviewDocument): void {
  const { pages } = document;
  if (pages.length === 0) {
    throw new Error(`[FAIL-FAST] Review ${document.fileStem} has no pages`);
  }
  const keys = new Set<string>();
  for (const page of pages) {
    if (keys.has(page.key)) {
      throw new Error(`[FAIL-FAST] Review ${document.fileStem} repeats page key ${page.key}`);
    }
    keys.add(page.key);
    if (page.blocks.length === 0) {
      throw new Error(`[FAIL-FAST] Review ${document.fileStem} page ${page.key} has no blocks`);
    }
    if (pages.length > 1 !== (page.label !== null)) {
      throw new Error(
        `[FAIL-FAST] Review ${document.fileStem} page ${page.key} must carry a label exactly when the document has several pages`,
      );
    }
  }
}
