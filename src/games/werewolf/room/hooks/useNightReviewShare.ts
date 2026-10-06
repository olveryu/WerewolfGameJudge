/** Owns report capture and sharing for one room, user and report; never changes game state. */

import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';
import { canonicalJson } from '@game-judge/game-engine/platform/protocol/canonicalJson';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { View } from 'react-native';
import { toast } from 'sonner-native';

import { uploadShareImage } from '@/features/room/services/uploadShareImage';
import { colors } from '@/theme';
import { handleError } from '@/utils/errorPipeline';
import { roomScreenLog } from '@/utils/logger';
import { isMiniProgram, wxPreviewImage } from '@/utils/miniProgram';

import type { HookAlertState } from '../hookAlert';
import { buildNightReviewData } from '../NightReview.helpers';
import {
  captureNightReviewCard,
  renderNightReviewToCanvas,
  shareNightReviewReportImage,
} from '../shareNightReview';

interface ReportCaptureScope {
  readonly key: string;
  isActive: boolean;
  base64: string | null;
  inFlight: Promise<string | null> | null;
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
  const [capturingScopeKey, setCapturingScopeKey] = useState<string | null>(null);

  /** Alert state rendered by the screen via <AlertModal> (hooks cannot render JSX). */
  const [alert, setAlert] = useState<HookAlertState | null>(null);
  const clearAlert = useCallback(() => setAlert(null), []);

  useEffect(() => {
    const scope: ReportCaptureScope = {
      key: reportScopeKey,
      isActive: true,
      base64: null,
      inFlight: null,
    };
    scopeRef.current = scope;
    setCapturingScopeKey(null);
    return () => {
      scope.isActive = false;
      scopeRef.current = null;
    };
  }, [reportScopeKey]);

  const beginReportCapture = useCallback((): Promise<string | null> => {
    const scope = scopeRef.current;
    if (scope === null || scope.key !== reportScopeKey || nightReviewData === null) {
      return Promise.resolve(null);
    }
    if (scope.inFlight !== null) return scope.inFlight;
    if (scope.base64 !== null) return Promise.resolve(scope.base64);
    setCapturingScopeKey(reportScopeKey);
    scope.inFlight = (async () => {
      try {
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );
        if (!scope.isActive) return null;
        const base64 = await captureNightReviewCard(nightReviewShareCardRef);
        if (!scope.isActive) return null;
        scope.base64 = base64;
        return base64;
      } catch (error) {
        if (scope.isActive) {
          const result = handleError(error, {
            label: '生成战报',
            logger: roomScreenLog,
            alertMessage: '无法生成战报截图，请重试',
          });
          if (!result.aborted) {
            toast.error(result.message);
          }
        }
        return null;
      } finally {
        scope.inFlight = null;
        if (scope.isActive) setCapturingScopeKey(null);
      }
    })();
    return scope.inFlight;
  }, [nightReviewData, reportScopeKey]);

  const shareNightReviewReportDirectly = useCallback(async (): Promise<boolean> => {
    const scope = scopeRef.current;
    if (scope === null || scope.key !== reportScopeKey || nightReviewData === null) return false;
    try {
      if (isMiniProgram()) {
        const base64 = renderNightReviewToCanvas(nightReviewData, roomCode, colors);
        const url = await uploadShareImage(base64);
        if (!scope.isActive) return false;
        await wxPreviewImage(url);
        return scope.isActive;
      }
      const base64 = scope.base64 ?? (await beginReportCapture());
      if (!scope.isActive || base64 === null) return false;
      const result = await shareNightReviewReportImage(() => Promise.resolve(base64), roomCode);
      if (!scope.isActive) return false;
      if (result === 'failed')
        setAlert({
          title: '分享失败',
          message: '无法分享战报，请稍后重试',
          buttons: [{ text: '确定', style: 'default', onPress: () => setAlert(null) }],
        });
      return result === 'shared';
    } catch (error) {
      if (scope.isActive) {
        const result = handleError(error, {
          label: '分享战报',
          logger: roomScreenLog,
          alertMessage: '无法分享战报，请稍后重试',
        });
        if (!result.aborted) {
          setAlert({
            title: '分享战报失败',
            message: result.message,
            buttons: [{ text: '确定', style: 'default', onPress: () => setAlert(null) }],
          });
        }
      }
      return false;
    }
  }, [beginReportCapture, nightReviewData, reportScopeKey, roomCode]);

  return {
    nightReviewData,
    reportScopeKey,
    nightReviewShareCardRef,
    isCapturingShareCard: capturingScopeKey === reportScopeKey,
    beginReportCapture,
    shareNightReviewReportDirectly,
    alert,
    clearAlert,
  };
}
