/** Owns report capture and sharing for one room, user and report; never changes game state. */

import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';
import { canonicalJson } from '@game-judge/game-engine/platform/protocol/canonicalJson';
import type { RefObject } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { View } from 'react-native';

import type {
  CaptureProgress,
  CaptureProgressCallback,
} from '@/features/room/services/captureViewSegmentedPngBase64';
import { uploadShareImage } from '@/features/room/services/uploadShareImage';
import { colors } from '@/theme';
import { showErrorAlert } from '@/utils/alertPresets';
import { handleError } from '@/utils/errorPipeline';
import { roomScreenLog } from '@/utils/logger';
import { isMiniProgram, wxPreviewImage } from '@/utils/miniProgram';

import { buildNightReviewData } from '../NightReview.helpers';
import {
  captureNightReviewCard,
  captureNightReviewCardSegmented,
  renderNightReviewToCanvas,
  SEGMENTED_CAPTURE_TRIAL_ENABLED,
  shareNightReviewReportImage,
} from '../shareNightReview';

interface ReportCaptureScope {
  readonly key: string;
  isActive: boolean;
  base64: string | null;
  inFlight: Promise<string | null> | null;
}

/** Band progress of the current report's capture; null while no capture runs. */
export type ReportCaptureProgress = CaptureProgress;

/** Phase of one direct share run, from tap to platform handoff. */
export type ReportShareRunPhase = 'capturing' | 'uploading';

/**
 * Visible lifecycle of one direct share run; null while no share runs.
 * The capturing phase carries the live band progress (null until the
 * segmented capture reports its first band; whole-view captures never
 * report bands). The uploading phase covers the mini program's image
 * upload, up to the WeChat preview taking over.
 */
export type ReportShareRun =
  | { readonly phase: 'capturing'; readonly progress: ReportCaptureProgress | null }
  | { readonly phase: 'uploading' };

/** Cancellation marker for one share run; the token's identity is the run. */
interface ShareRunToken {
  cancelled: boolean;
}

/** Keeps cached images and late completions inside their report's lifetime. */
export function useNightReviewShare(
  roomId: string,
  roomCode: string,
  userId: string | null,
  gameState: Parameters<typeof buildNightReviewData>[0] | null,
) {
  const nightReviewData = useMemo(() => {
    if (!gameState?.currentNightResults) return null;
    if (gameState.status !== GameStatus.Day && gameState.status !== GameStatus.Ended) return null;
    return buildNightReviewData(gameState);
  }, [gameState]);
  const reportScopeKey = canonicalJson({
    roomId,
    userId,
    round: gameState?.roleRevealRandomNonce ?? null,
    nightReviewData,
  });
  const nightReviewShareCardRef = useRef<View>(null);
  const scopeRef = useRef<ReportCaptureScope | null>(null);
  const shareRunRef = useRef<ShareRunToken | null>(null);
  const [capturingScopeKey, setCapturingScopeKey] = useState<string | null>(null);
  const [captureProgressState, setCaptureProgressState] = useState<
    (ReportCaptureProgress & { readonly key: string }) | null
  >(null);
  const [shareRunState, setShareRunState] = useState<{
    readonly key: string;
    readonly phase: ReportShareRunPhase;
  } | null>(null);

  useEffect(() => {
    const scope: ReportCaptureScope = {
      key: reportScopeKey,
      isActive: true,
      base64: null,
      inFlight: null,
    };
    scopeRef.current = scope;
    setCapturingScopeKey(null);
    setCaptureProgressState(null);
    setShareRunState(null);
    return () => {
      scope.isActive = false;
      scopeRef.current = null;
      shareRunRef.current = null;
    };
  }, [reportScopeKey]);

  /**
   * The single platform capture selection: the mini program captures the
   * card band by band (whole-view capture overflows its web-view), every
   * other platform captures the mounted card in one shot. Band progress is
   * only produced by the segmented capture.
   */
  const captureReportCard = useCallback(
    (ref: RefObject<View | null>, onProgress: CaptureProgressCallback): Promise<string> => {
      if (isMiniProgram()) return captureNightReviewCardSegmented(ref, onProgress);
      return captureNightReviewCard(ref);
    },
    [],
  );

  /**
   * Mounts the share card for one capture and unmounts it afterwards; the
   * card only exists in the tree while a capture runs. Every capture of the
   * card must go through here — reading the ref without mounting first finds
   * nothing. Concurrent callers join the in-flight capture.
   */
  const captureMountedShareCard = useCallback(
    (
      capture: (
        ref: RefObject<View | null>,
        onProgress: CaptureProgressCallback,
      ) => Promise<string>,
    ): Promise<string | null> => {
      const scope = scopeRef.current;
      if (scope === null || scope.key !== reportScopeKey || nightReviewData === null) {
        return Promise.resolve(null);
      }
      if (scope.inFlight !== null) return scope.inFlight;
      setCapturingScopeKey(reportScopeKey);
      scope.inFlight = (async () => {
        try {
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          );
          if (!scope.isActive) return null;
          const reportProgress: CaptureProgressCallback = (done, total) => {
            if (scope.isActive) setCaptureProgressState({ key: reportScopeKey, done, total });
          };
          const base64 = await capture(nightReviewShareCardRef, reportProgress);
          if (!scope.isActive) return null;
          return base64;
        } catch (error) {
          if (scope.isActive) {
            handleError(error, {
              label: '生成战报',
              logger: roomScreenLog,
              feedback: 'toast',
              alertMessage: '无法生成战报截图，请重试',
            });
          }
          return null;
        } finally {
          scope.inFlight = null;
          if (scope.isActive) {
            setCapturingScopeKey(null);
            setCaptureProgressState(null);
          }
        }
      })();
      return scope.inFlight;
    },
    [nightReviewData, reportScopeKey],
  );

  const beginReportCapture = useCallback((): Promise<string | null> => {
    const scope = scopeRef.current;
    if (scope === null || scope.key !== reportScopeKey || nightReviewData === null) {
      return Promise.resolve(null);
    }
    if (scope.inFlight !== null) return scope.inFlight;
    if (scope.base64 !== null) return Promise.resolve(scope.base64);
    // With the trial switch off, the mini program shares a Canvas-drawn
    // image instead of a card capture, so no card image exists to prepare.
    if (isMiniProgram() && !SEGMENTED_CAPTURE_TRIAL_ENABLED) return Promise.resolve(null);
    return (async () => {
      const base64 = await captureMountedShareCard(captureReportCard);
      if (base64 !== null && scope.isActive) scope.base64 = base64;
      return base64;
    })();
  }, [captureMountedShareCard, captureReportCard, nightReviewData, reportScopeKey]);

  /**
   * Detaches the waiting UI from the current share run: the run's later
   * stages must no longer hand off to the preview. The capture itself is
   * not touched — an in-flight capture keeps running and still lands in
   * the scope cache, and an upload already sent simply completes with
   * nobody taking over its result.
   */
  const cancelReportShare = useCallback(() => {
    const run = shareRunRef.current;
    if (run !== null) {
      run.cancelled = true;
      shareRunRef.current = null;
    }
    setShareRunState(null);
  }, []);

  const shareNightReviewReportDirectly = useCallback(async (): Promise<boolean> => {
    const scope = scopeRef.current;
    if (scope === null || scope.key !== reportScopeKey || nightReviewData === null) return false;
    // One token per run: starting a new run supersedes the previous one,
    // and cancelling marks the token so its continuation never hands off.
    const run: ShareRunToken = { cancelled: false };
    shareRunRef.current = run;
    const isRunCurrent = () => shareRunRef.current === run && !run.cancelled && scope.isActive;
    const enterPhase = (phase: ReportShareRunPhase) => {
      if (shareRunRef.current === run && scope.isActive) {
        setShareRunState({ key: reportScopeKey, phase });
      }
    };
    try {
      if (isMiniProgram()) {
        let base64: string;
        if (SEGMENTED_CAPTURE_TRIAL_ENABLED) {
          // A cached image skips the generating phase entirely; only a
          // capture that still has to run (or finish) is presented.
          if (scope.base64 === null) enterPhase('capturing');
          const captured = await beginReportCapture();
          if (captured === null) return false;
          base64 = captured;
        } else {
          base64 = renderNightReviewToCanvas(nightReviewData, roomCode, colors);
        }
        if (!isRunCurrent()) return false;
        enterPhase('uploading');
        const url = await uploadShareImage(base64);
        if (!isRunCurrent()) return false;
        await wxPreviewImage(url);
        return scope.isActive;
      }
      if (scope.base64 === null) enterPhase('capturing');
      const base64 = scope.base64 ?? (await beginReportCapture());
      if (!isRunCurrent() || base64 === null) return false;
      // The platform share sheet owns every visible surface from the
      // handoff on, so the run ends here instead of being held behind it.
      if (shareRunRef.current === run) setShareRunState(null);
      const result = await shareNightReviewReportImage(() => Promise.resolve(base64), roomCode);
      if (!scope.isActive) return false;
      if (result === 'failed') showErrorAlert('分享失败', '无法分享战报，请稍后重试');
      return result === 'shared';
    } catch (error) {
      if (scope.isActive) {
        handleError(error, {
          label: '分享战报',
          logger: roomScreenLog,
          alertMessage: '无法分享战报，请稍后重试',
        });
      }
      return false;
    } finally {
      if (shareRunRef.current === run) {
        shareRunRef.current = null;
        if (scope.isActive) setShareRunState(null);
      }
    }
  }, [beginReportCapture, nightReviewData, reportScopeKey, roomCode]);

  const reportCaptureProgress: ReportCaptureProgress | null =
    captureProgressState !== null && captureProgressState.key === reportScopeKey
      ? { done: captureProgressState.done, total: captureProgressState.total }
      : null;
  const shareRunPhase =
    shareRunState !== null && shareRunState.key === reportScopeKey ? shareRunState.phase : null;
  const shareRun: ReportShareRun | null =
    shareRunPhase === null
      ? null
      : shareRunPhase === 'uploading'
        ? { phase: 'uploading' }
        : { phase: 'capturing', progress: reportCaptureProgress };

  return {
    nightReviewData,
    reportScopeKey,
    nightReviewShareCardRef,
    isCapturingShareCard: capturingScopeKey === reportScopeKey,
    reportCaptureProgress,
    shareRun,
    cancelReportShare,
    beginReportCapture,
    shareNightReviewReportDirectly,
  };
}
