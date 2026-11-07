/**
 * useRoomReviewExport — the one review export flow every game shares:
 * readiness → capture → hand-off → outcome, implemented once.
 *
 * - Cache: one PNG per page, scoped by room, viewer, page width, share
 *   title and the serialized document — everything a page's pixels
 *   follow from. Any change starts a new, empty scope.
 * - Concurrency: one capture job per scope at a time; callers join it and
 *   capture whatever is still missing afterwards.
 * - Capture: the mini program captures each page band by band (its
 *   web-view overflows on a whole tall element); every other platform
 *   captures the whole page. This is the only platform branch of capture.
 * - Pre-capture: the dialog captures while the reader looks, so a tap
 *   hands the images to the share sheet within the tap's activation.
 * - Run: preparing → capturing n/N → (mini program) uploading. Cancel
 *   detaches the waiting UI only: a capture keeps running and still fills
 *   the cache; an upload already sent completes, but its preview no
 *   longer opens.
 */

import { canonicalJson } from '@game-judge/game-engine/platform/protocol/canonicalJson';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { toast } from 'sonner-native';

import { resolveRoomDialogWidth } from '@/features/room/components/RoomSurface.styles';
import { captureViewPngBase64 } from '@/features/room/services/captureViewPngBase64';
import {
  type CaptureProgress,
  captureViewSegmentedPngBase64,
  planCaptureBands,
  SEGMENTED_CAPTURE_BAND_HEIGHT_PX,
} from '@/features/room/services/captureViewSegmentedPngBase64';
import {
  previewUploadedImages,
  type ShareImage,
  shareImagesBase64,
  uploadShareImages,
} from '@/features/room/services/shareImage';
import { handleError } from '@/utils/errorPipeline';
import { isAbortError } from '@/utils/errorUtils';
import { roomScreenLog } from '@/utils/logger';
import { isMiniProgram } from '@/utils/miniProgram';

import {
  ReviewImageFailedError,
  type ReviewStagePageHandle,
  type ReviewStageRequest,
} from './components/RoomReviewExportStage';
import { REVIEW_PAGE_MAX_HEIGHT } from './reportTheme';
import { serializeReviewDocument } from './serializeReviewDocument';
import type { RoomReviewDocument, RoomReviewPage } from './types';

/** The visible lifecycle of one share run. */
export type RoomReviewShareRun =
  | { readonly phase: 'preparing' }
  | { readonly phase: 'capturing'; readonly done: number; readonly total: number }
  | { readonly phase: 'uploading' };

/** Whether a set of pages can be handed off right away. */
export type RoomReviewExportReadiness =
  | { readonly kind: 'ready' }
  | { readonly kind: 'capturing'; readonly progress: CaptureProgress | null }
  /** Not captured and no capture running: a background capture may start. */
  | { readonly kind: 'idle' }
  /** The background capture failed (not on a drawing): only a share run retries, with feedback. */
  | { readonly kind: 'failed' };

export interface RoomReviewExport {
  /** The hidden stage's request while a capture runs. */
  readonly stageRequest: ReviewStageRequest | null;
  /** Logical page width, equal to the dialog's printed page. */
  readonly pageWidth: number;
  /** The visible run; null while none runs or once the platform share sheet took over. */
  readonly run: RoomReviewShareRun | null;
  /** A share run is active, the platform share sheet included. */
  readonly isSharing: boolean;
  readonly readiness: (pageIndexes: readonly number[]) => RoomReviewExportReadiness;
  /** Starts a background capture of the pages; no feedback, no hand-off. */
  readonly prepare: (pageIndexes: readonly number[]) => void;
  /** Captures what is missing, then hands the pages to the platform. */
  readonly share: (pageIndexes: readonly number[]) => Promise<void>;
  readonly cancel: () => void;
}

/**
 * The imperative cache of one scope. Render never reads it: what the UI
 * shows (cached pages, a running capture) is mirrored into React state.
 */
interface CaptureScope {
  readonly key: string;
  readonly shareTitle: string;
  readonly pages: Map<string, string>;
  job: Promise<void> | null;
  /** A background capture failed for a reason other than a drawing: only a tap retries. */
  hasPrepareFailed: boolean;
}

type RunPhase = 'preparing' | 'uploading' | 'handingOff';

function pageAt(document: RoomReviewDocument, pageIndex: number): RoomReviewPage {
  const page = document.pages[pageIndex];
  if (page === undefined) {
    throw new Error(`[FAIL-FAST] Review ${document.fileStem} has no page ${pageIndex}`);
  }
  return page;
}

/** `${fileStem}.png` for a single page; `${fileStem}-p<n>.png` per page of a longer document. */
export function reviewImageFilename(document: RoomReviewDocument, pageIndex: number): string {
  return document.pages.length === 1
    ? `${document.fileStem}.png`
    : `${document.fileStem}-p${pageIndex + 1}.png`;
}

function createAbortError(): Error {
  const error = new Error('Review export stage closed before capture');
  error.name = 'AbortError';
  return error;
}

function reportCaptureFailure(error: unknown): void {
  const isImageFailure = error instanceof ReviewImageFailedError;
  handleError(error, {
    label: '生成战报截图',
    logger: roomScreenLog,
    feedback: 'toast',
    alertMessage: isImageFailure
      ? '有图片加载失败，请在复盘中点击图片重试'
      : '无法生成战报截图，请重试',
    isExpected: () => isImageFailure,
  });
}

export function useRoomReviewExport({
  roomId,
  userId,
  shareTitle,
  document,
}: {
  readonly roomId: string;
  readonly userId: string;
  /** `formatReviewShareTitle` of the room: the image masthead and the share sheet title. */
  readonly shareTitle: string;
  /** The document this viewer may export; null when there is none or sharing is not allowed. */
  readonly document: RoomReviewDocument | null;
}): RoomReviewExport {
  const { width: windowWidth } = useWindowDimensions();
  const pageWidth = resolveRoomDialogWidth(windowWidth);
  const scopeKey =
    document === null
      ? null
      : canonicalJson({
          roomId,
          userId,
          pageWidth,
          shareTitle,
          document: serializeReviewDocument(document),
        });
  const scope = useMemo<CaptureScope | null>(
    () =>
      scopeKey === null
        ? null
        : { key: scopeKey, shareTitle, pages: new Map(), job: null, hasPrepareFailed: false },
    [scopeKey, shareTitle],
  );
  const [stageRequest, setStageRequest] = useState<ReviewStageRequest | null>(null);
  const [progress, setProgress] = useState<
    (CaptureProgress & { readonly scopeKey: string }) | null
  >(null);
  const [runState, setRunState] = useState<{
    readonly scopeKey: string;
    readonly phase: RunPhase;
  } | null>(null);
  const [failedPrepareScope, setFailedPrepareScope] = useState<string | null>(null);
  const [cachedPages, setCachedPages] = useState<{
    readonly scopeKey: string;
    readonly keys: ReadonlySet<string>;
  } | null>(null);
  const stageIdRef = useRef(0);
  const pendingStageRef = useRef<ReviewStageRequest | null>(null);
  const runTokenRef = useRef<object | null>(null);

  // A new scope (or unmount) abandons the old scope's stage and detaches its run.
  useEffect(
    () => () => {
      const pending = pendingStageRef.current;
      pendingStageRef.current = null;
      runTokenRef.current = null;
      pending?.reject(createAbortError());
    },
    [scopeKey],
  );

  const mountStage = useCallback(
    (target: CaptureScope, stagedDocument: RoomReviewDocument, pageIndexes: readonly number[]) =>
      new Promise<ReadonlyMap<string, ReviewStagePageHandle>>((resolve, reject) => {
        stageIdRef.current += 1;
        const request: ReviewStageRequest = {
          id: stageIdRef.current,
          document: stagedDocument,
          shareTitle: target.shareTitle,
          pageIndexes,
          resolve: (handles) => {
            if (pendingStageRef.current !== request) return;
            pendingStageRef.current = null;
            resolve(handles);
          },
          reject: (error) => {
            if (pendingStageRef.current !== request) return;
            pendingStageRef.current = null;
            reject(error);
          },
        };
        pendingStageRef.current = request;
        setStageRequest(request);
      }),
    [],
  );

  const runCaptureJob = useCallback(
    async (
      target: CaptureScope,
      capturedDocument: RoomReviewDocument,
      pageIndexes: readonly number[],
    ) => {
      try {
        const handles = await mountStage(target, capturedDocument, pageIndexes);
        const isSegmented = isMiniProgram();
        const plan = pageIndexes.map((pageIndex) => {
          const page = pageAt(capturedDocument, pageIndex);
          const handle = handles.get(page.key);
          if (handle === undefined) {
            throw new Error(`[FAIL-FAST] Review stage returned no handle for page ${page.key}`);
          }
          if (handle.height > REVIEW_PAGE_MAX_HEIGHT) {
            throw new Error(
              `[FAIL-FAST] Review page ${page.key} is ${Math.round(handle.height)}px tall; pages are capped at ${REVIEW_PAGE_MAX_HEIGHT}px`,
            );
          }
          const units = isSegmented
            ? planCaptureBands(handle.height, SEGMENTED_CAPTURE_BAND_HEIGHT_PX).length
            : 1;
          return { page, handle, units };
        });
        let total = plan.reduce((sum, step) => sum + step.units, 0);
        let done = 0;
        const report = (value: number) => setProgress({ scopeKey: target.key, done: value, total });
        report(0);
        for (const step of plan) {
          const base64 = isSegmented
            ? await captureViewSegmentedPngBase64(step.handle.ref, {
                // The capture plans its own bands from the element; adopt its count.
                onProgress: (bandsDone, bands) => {
                  total += bands - step.units;
                  step.units = bands;
                  report(done + bandsDone);
                },
              })
            : await captureViewPngBase64(step.handle.ref);
          done += step.units;
          report(done);
          target.pages.set(step.page.key, base64);
          const pageKey = step.page.key;
          setCachedPages((current) => ({
            scopeKey: target.key,
            keys: new Set([...(current?.scopeKey === target.key ? current.keys : []), pageKey]),
          }));
        }
      } finally {
        setStageRequest(null);
        setProgress(null);
      }
    },
    [mountStage],
  );

  const capture = useCallback(
    async (
      target: CaptureScope,
      capturedDocument: RoomReviewDocument,
      pageIndexes: readonly number[],
    ) => {
      for (;;) {
        const missing = pageIndexes.filter(
          (pageIndex) => !target.pages.has(pageAt(capturedDocument, pageIndex).key),
        );
        if (missing.length === 0) return;
        if (target.job === null) {
          const job: Promise<void> = runCaptureJob(target, capturedDocument, missing).finally(
            () => {
              if (target.job === job) target.job = null;
            },
          );
          target.job = job;
        }
        await target.job;
      }
    },
    [runCaptureJob],
  );

  const requireScope = useCallback((): {
    readonly target: CaptureScope;
    readonly sharedDocument: RoomReviewDocument;
  } => {
    if (scope === null || document === null) {
      throw new Error('[FAIL-FAST] Review export used without a document this viewer may share');
    }
    return { target: scope, sharedDocument: document };
  }, [document, scope]);

  const isCached = useCallback(
    (target: CaptureScope, cachedDocument: RoomReviewDocument, pageIndexes: readonly number[]) =>
      pageIndexes.every((pageIndex) => target.pages.has(pageAt(cachedDocument, pageIndex).key)),
    [],
  );

  const readiness = useCallback(
    (pageIndexes: readonly number[]): RoomReviewExportReadiness => {
      const { target, sharedDocument } = requireScope();
      const keys =
        cachedPages !== null && cachedPages.scopeKey === target.key ? cachedPages.keys : null;
      if (pageIndexes.every((pageIndex) => keys?.has(pageAt(sharedDocument, pageIndex).key))) {
        return { kind: 'ready' };
      }
      if (stageRequest === null) {
        return failedPrepareScope === target.key ? { kind: 'failed' } : { kind: 'idle' };
      }
      return {
        kind: 'capturing',
        progress:
          progress !== null && progress.scopeKey === target.key
            ? { done: progress.done, total: progress.total }
            : null,
      };
    },
    [cachedPages, failedPrepareScope, progress, requireScope, stageRequest],
  );

  const prepare = useCallback(
    (pageIndexes: readonly number[]) => {
      const { target, sharedDocument } = requireScope();
      if (target.job !== null || target.hasPrepareFailed) return;
      if (isCached(target, sharedDocument, pageIndexes)) return;
      capture(target, sharedDocument, pageIndexes).catch((error: unknown) => {
        // A failed drawing shows its own retry; a closed scope has no reader left.
        if (error instanceof ReviewImageFailedError || isAbortError(error)) return;
        target.hasPrepareFailed = true;
        setFailedPrepareScope(target.key);
        handleError(error, { label: '预生成战报截图', logger: roomScreenLog, feedback: false });
      });
    },
    [capture, isCached, requireScope],
  );

  const share = useCallback(
    async (pageIndexes: readonly number[]) => {
      const { target, sharedDocument } = requireScope();
      if (runTokenRef.current !== null) {
        throw new Error('[FAIL-FAST] A review share is already running');
      }
      const token = {};
      runTokenRef.current = token;
      const isCurrent = () => runTokenRef.current === token;
      const enter = (phase: RunPhase) => {
        if (isCurrent()) setRunState({ scopeKey: target.key, phase });
      };
      try {
        if (!isCached(target, sharedDocument, pageIndexes)) {
          enter('preparing');
          try {
            await capture(target, sharedDocument, pageIndexes);
          } catch (error) {
            if (isCurrent()) reportCaptureFailure(error);
            return;
          }
          if (!isCurrent()) return;
        }
        const images: ShareImage[] = pageIndexes.map((pageIndex) => {
          const base64 = target.pages.get(pageAt(sharedDocument, pageIndex).key);
          if (base64 === undefined) {
            throw new Error(`[FAIL-FAST] Review page ${pageIndex} was not captured`);
          }
          return { base64, filename: reviewImageFilename(sharedDocument, pageIndex) };
        });
        const inMiniProgram = isMiniProgram();
        try {
          if (inMiniProgram) {
            enter('uploading');
            const urls = await uploadShareImages(images);
            if (!isCurrent()) return;
            await previewUploadedImages(urls);
            return;
          }
          enter('handingOff');
          const outcome = await shareImagesBase64(images, target.shareTitle);
          if (outcome === 'downloaded' && isCurrent()) toast.success('图片已保存');
        } catch (error) {
          if (!isCurrent()) return;
          handleError(error, {
            label: '分享',
            logger: roomScreenLog,
            alertMessage: inMiniProgram ? '无法上传图片，请稍后重试' : '无法分享图片，请稍后重试',
            expectedCodes: [401],
          });
        }
      } finally {
        if (isCurrent()) {
          runTokenRef.current = null;
          setRunState(null);
        }
      }
    },
    [capture, isCached, requireScope],
  );

  const cancel = useCallback(() => {
    runTokenRef.current = null;
    setRunState(null);
  }, []);

  const activeRun = runState !== null && runState.scopeKey === scopeKey ? runState : null;
  let run: RoomReviewShareRun | null = null;
  if (activeRun?.phase === 'uploading') {
    run = { phase: 'uploading' };
  } else if (activeRun?.phase === 'preparing') {
    run =
      progress !== null && progress.scopeKey === scopeKey
        ? { phase: 'capturing', done: progress.done, total: progress.total }
        : { phase: 'preparing' };
  }

  return {
    stageRequest,
    pageWidth,
    run,
    isSharing: activeRun !== null,
    readiness,
    prepare,
    share,
    cancel,
  };
}
