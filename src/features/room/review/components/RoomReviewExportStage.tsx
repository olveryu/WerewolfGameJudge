/**
 * The hidden export stage. While a capture runs it mounts the requested
 * pages offscreen in export mode — each in its own non-collapsable view
 * with a ref — measures them, waits until every drawing is decoded (or
 * honestly unavailable) and two frames have painted, then hands the
 * capture handles back once. A drawing that fails rejects the request:
 * the export waits for the reader's retry instead of capturing a hole.
 */

import { type RefObject, useEffect, useMemo, useRef, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native';

import { TESTIDS } from '@/testids';

import { type ReviewExportGate, ReviewExportGateContext } from '../reviewAssetStore';
import type { RoomReviewDocument, RoomReviewPage } from '../types';
import { ReviewDocumentView } from './ReviewDocumentView';

export interface ReviewStagePageHandle {
  readonly ref: RefObject<View | null>;
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
  const nodesRef = useRef(new Map<string, View>());
  const settledRef = useRef(false);
  const [heights, setHeights] = useState<ReadonlyMap<string, number>>(new Map());
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
    const pageKeys = stagedPages.map(({ page }) => page.key);
    const isMeasured = pageKeys.every((key) => (heights.get(key) ?? 0) > 0);
    const isDecoded = expectedImages.every((blockId) => imageStates.get(blockId) === 'ready');
    if (!isMeasured || !isDecoded) return;
    let isCancelled = false;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (isCancelled || settledRef.current) return;
        settledRef.current = true;
        const handles = new Map<string, ReviewStagePageHandle>();
        for (const key of pageKeys) {
          const node = nodesRef.current.get(key);
          const height = heights.get(key);
          if (node === undefined || height === undefined) {
            request.reject(new Error(`[FAIL-FAST] Review stage page ${key} is not mounted`));
            return;
          }
          handles.set(key, { ref: { current: node }, height });
        }
        request.resolve(handles);
      }),
    );
    return () => {
      isCancelled = true;
    };
  }, [expectedImages, heights, imageStates, request, stagedPages]);

  return (
    <View style={styles.stage} pointerEvents="none" aria-hidden>
      <ReviewExportGateContext.Provider value={gate}>
        {stagedPages.map(({ page, pageIndex }) => {
          const { key } = page;
          return (
            <View
              key={key}
              ref={(node) => {
                if (node === null) nodesRef.current.delete(key);
                else nodesRef.current.set(key, node);
              }}
              collapsable={false}
              style={{ width }}
              testID={TESTIDS.roomReviewStagePage(key)}
              onLayout={(event: LayoutChangeEvent) => {
                const { height } = event.nativeEvent.layout;
                setHeights((current) =>
                  current.get(key) === height ? current : new Map(current).set(key, height),
                );
              }}
            >
              <ReviewDocumentView
                document={document}
                pageIndex={pageIndex}
                mode="export"
                shareTitle={shareTitle}
              />
            </View>
          );
        })}
      </ReviewExportGateContext.Provider>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    position: 'absolute',
    top: -9999,
    left: -9999,
  },
});
