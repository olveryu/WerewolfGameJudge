/**
 * The hidden export stage. While a capture runs it mounts the requested
 * pages offscreen in export mode — each in its own element with a ref —
 * measures them, waits until every drawing is decoded (or honestly
 * unavailable) and two frames have painted, then hands the capture handles
 * back once. A drawing that fails rejects the request: the export waits for
 * the reader's retry instead of capturing a hole.
 */
import { useEffect, useMemo, useRef, useState } from 'react';

import { TESTIDS } from '@/testids';

import { type ReviewExportGate, ReviewExportGateContext } from '../reviewAssetStore';
import type { RoomReviewDocument, RoomReviewPage } from '../types';
import { ReviewDocumentView } from './ReviewDocumentView';

export interface ReviewStagePageHandle {
  readonly element: HTMLElement;
  readonly height: number;
}

export interface ReviewStageRequest {
  readonly id: number;
  readonly document: RoomReviewDocument;
  readonly shareTitle: string;
  readonly pageIndexes: readonly number[];
  readonly resolve: (handles: ReadonlyMap<string, ReviewStagePageHandle>) => void;
  readonly reject: (error: Error) => void;
}

/** A drawing on a requested page failed; the export waits for the reader's retry. */
export class ReviewImageFailedError extends Error {
  constructor(blockId: string) {
    super(`Review image ${blockId} failed to load; export waits for a retry`);
    this.name = 'ReviewImageFailedError';
  }
}

interface StagedPage {
  readonly page: RoomReviewPage;
  readonly pageIndex: number;
}

function resolveStagedPages(
  document: RoomReviewDocument,
  pageIndexes: readonly number[],
): readonly StagedPage[] {
  return pageIndexes.map((pageIndex) => {
    const page = document.pages[pageIndex];
    if (page === undefined) {
      throw new Error(`[FAIL-FAST] Review ${document.fileStem} stage has no page ${pageIndex}`);
    }
    return { page, pageIndex };
  });
}

function imageBlockIds(stagedPages: readonly StagedPage[]): string[] {
  return stagedPages.flatMap(({ page }) =>
    page.blocks.flatMap((block, index) => (block.kind === 'image' ? [`${page.key}/${index}`] : [])),
  );
}

export function RoomReviewExportStage({
  request,
  width,
}: {
  readonly request: ReviewStageRequest;
  readonly width: number;
}) {
  const { document, shareTitle, pageIndexes } = request;
  const nodesRef = useRef(new Map<string, HTMLElement>());
  const settledRef = useRef(false);
  const [imageStates, setImageStates] = useState<ReadonlyMap<string, 'ready' | 'failed'>>(
    new Map(),
  );
  const stagedPages = useMemo(
    () => resolveStagedPages(document, pageIndexes),
    [document, pageIndexes],
  );
  const expectedImages = useMemo(() => imageBlockIds(stagedPages), [stagedPages]);
  const gate = useMemo<ReviewExportGate>(
    () => ({
      report: (blockId, status) =>
        setImageStates((current) =>
          current.get(blockId) === status ? current : new Map(current).set(blockId, status),
        ),
    }),
    [],
  );

  useEffect(() => {
    if (settledRef.current) return;
    const failed = expectedImages.find((blockId) => imageStates.get(blockId) === 'failed');
    if (failed !== undefined) {
      settledRef.current = true;
      request.reject(new ReviewImageFailedError(failed));
      return;
    }
    if (!expectedImages.every((blockId) => imageStates.get(blockId) === 'ready')) return;
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        if (settledRef.current) return;
        settledRef.current = true;
        const handles = new Map<string, ReviewStagePageHandle>();
        for (const { page } of stagedPages) {
          const element = nodesRef.current.get(page.key);
          if (element === undefined) {
            request.reject(new Error(`[FAIL-FAST] Review stage page ${page.key} is not mounted`));
            return;
          }
          handles.set(page.key, { element, height: element.getBoundingClientRect().height });
        }
        request.resolve(handles);
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [expectedImages, imageStates, request, stagedPages]);

  return (
    <div className="review-export-stage" aria-hidden inert>
      <ReviewExportGateContext value={gate}>
        {stagedPages.map(({ page, pageIndex }) => {
          const { key } = page;
          return (
            <div
              key={key}
              ref={(node) => {
                if (node === null) nodesRef.current.delete(key);
                else nodesRef.current.set(key, node);
              }}
              style={{ width }}
              data-testid={TESTIDS.roomReviewStagePage(key)}
            >
              <ReviewDocumentView
                document={document}
                pageIndex={pageIndex}
                mode="export"
                shareTitle={shareTitle}
              />
            </div>
          );
        })}
      </ReviewExportGateContext>
    </div>
  );
}
