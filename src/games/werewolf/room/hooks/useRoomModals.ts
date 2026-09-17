/**
 * useRoomModals — Global modal/dialog state management for WerewolfRoomScreen
 *
 * Extracted from useWerewolfRoomScreenState; centralizes visible state and open/close handlers for all modals.
 * Includes: role card, skill preview, night details, share details, last-night info.
 * Excludes shared room modals and Werewolf action dialogs.
 */

import { isValidRoleId, type RoleId } from '@game-judge/game-engine/games/werewolf/public';
import { useCallback, useEffect, useRef, useState } from 'react';

import { isSuccessfulRoomCommand } from '@/features/room/session/roomCommandResult';
import type { WerewolfCommandDispatchOutcome } from '@/games/werewolf/runtime/WerewolfGameClient';
import { DISMISS_BUTTON, dismissAlert, getAlertGeneration, showAlert } from '@/utils/alert';
import { showConfirmAlert, showDismissAlert } from '@/utils/alertPresets';
import { isMiniProgram } from '@/utils/miniProgram';

/** useRoomModals deps */
interface UseRoomModalsDeps {
  reportScopeKey: string;
  /** Whether current user is Host (determines "本局复盘" modal options) */
  isHost: boolean;
  /** Whether current user can share the night-report screenshot (Host or a player shared by Host) */
  canShareReport: boolean;
  /** Get last-night info text */
  getLastNightInfo: () => string; /** Get crow curse info; null if no crow */
  getCurseInfo: () => string | null; /** Share night details to specified seats (HTTP API) */
  shareNightReview: (allowedSeats: number[]) => Promise<WerewolfCommandDispatchOutcome>;
  /** Begin background capture of report; returns base64 (success) or null (failure) */
  beginReportCapture: () => Promise<string | null>;
  /** Directly share the report (system share/copy). Return value is optional and unused by caller. */
  shareNightReviewReport: () => Promise<unknown>;
}

/** useRoomModals return value */
interface RoomModalsState {
  // ── Role card modal ──
  roleCardVisible: boolean;
  shouldPlayRevealAnimation: boolean;
  isLoadingRole: boolean;
  setRoleCardVisible: (v: boolean) => void;
  setShouldPlayRevealAnimation: (v: boolean) => void;
  setIsLoadingRole: (v: boolean) => void;
  handleRoleCardClose: () => void;

  // ── Skill preview modal ──
  skillPreviewRoleId: RoleId | null;
  handleSkillPreviewOpen: (roleId: string) => void;
  handleSkillPreviewClose: () => void;

  // ── Night review modal ──
  nightReviewVisible: boolean;
  openNightReview: () => void;
  closeNightReview: () => void;

  // ── Share review modal ──
  shareReviewVisible: boolean;
  closeShareReview: () => void;
  handleShareNightReview: (allowedSeats: number[]) => Promise<void>;

  // ── Last night info ──
  showLastNightInfo: () => void;
}

export function useRoomModals({
  reportScopeKey,
  isHost,
  canShareReport,
  getLastNightInfo,
  getCurseInfo,
  shareNightReview,
  beginReportCapture,
  shareNightReviewReport,
}: UseRoomModalsDeps): RoomModalsState {
  // ── Role card modal ──
  const [roleCardVisible, setRoleCardVisible] = useState(false);
  const [shouldPlayRevealAnimation, setShouldPlayRevealAnimation] = useState(false);
  const [isLoadingRole, setIsLoadingRole] = useState(false);

  const handleRoleCardClose = useCallback(() => {
    setRoleCardVisible(false);
    setShouldPlayRevealAnimation(false);
    setIsLoadingRole(false);
  }, []);

  // ── Skill preview modal ──
  const [skillPreviewRoleId, setSkillPreviewRoleId] = useState<RoleId | null>(null);

  const handleSkillPreviewOpen = useCallback((roleId: string) => {
    if (!isValidRoleId(roleId)) {
      throw new Error(`[useRoomModals] Invalid role ID: ${roleId}`);
    }
    setSkillPreviewRoleId(roleId);
  }, []);

  const handleSkillPreviewClose = useCallback(() => {
    setSkillPreviewRoleId(null);
  }, []);

  // ── Share review modal (declared before night review because openNightReview references setShareReviewVisible) ──
  const [shareReviewVisible, setShareReviewVisible] = useState(false);

  // ── Night review modal ──
  const [nightReviewVisible, setNightReviewVisible] = useState(false);

  /** Tracks whether the "本局复盘" alert is still open (prevents re-showing after dismiss). */
  const detailAlertOpenRef = useRef(false);
  const detailAlertRequestRef = useRef(0);
  const detailAlertGenerationRef = useRef<number | null>(null);

  useEffect(() => {
    detailAlertOpenRef.current = false;
    detailAlertRequestRef.current += 1;
    setNightReviewVisible(false);
    setShareReviewVisible(false);
    setRoleCardVisible(false);
    setShouldPlayRevealAnimation(false);
    setIsLoadingRole(false);
    setSkillPreviewRoleId(null);
    return () => {
      detailAlertOpenRef.current = false;
      detailAlertRequestRef.current += 1;
      if (detailAlertGenerationRef.current !== null) {
        dismissAlert(detailAlertGenerationRef.current);
        detailAlertGenerationRef.current = null;
      }
    };
  }, [reportScopeKey]);

  const confirmOpenNightReview = useCallback(() => {
    const requestId = detailAlertRequestRef.current;
    const isShown = showConfirmAlert(
      '查看本局复盘？',
      '本局复盘包含全员身份和行动记录，查看后可能影响警长竞选，请确认继续。',
      () => {
        if (detailAlertRequestRef.current === requestId) setNightReviewVisible(true);
      },
      { confirmText: '确定查看' },
    );
    detailAlertGenerationRef.current = isShown ? getAlertGeneration() : null;
  }, []);

  /**
   * Show the "本局复盘" alert with optional loading state on "分享战报" button.
   * Can be called twice: first with `reportLoading: true`, then with `false`
   * once capture completes — `showAlert` seamlessly updates the existing modal.
   */
  const showDetailAlert = useCallback(
    (reportLoading: boolean) => {
      const requestId = detailAlertRequestRef.current;
      const dismiss = () => {
        if (detailAlertRequestRef.current !== requestId) return false;
        detailAlertOpenRef.current = false;
        detailAlertGenerationRef.current = null;
        return true;
      };

      let isShown = false;
      if (isHost) {
        isShown = showAlert('本局复盘', '选择操作', [
          {
            text: '自己查看',
            onPress: () => {
              if (dismiss()) confirmOpenNightReview();
            },
          },
          {
            text: '授权玩家查看',
            onPress: () => {
              if (dismiss()) setShareReviewVisible(true);
            },
          },
          {
            text: '分享战报',
            loading: reportLoading,
            onPress: () => {
              if (dismiss()) void shareNightReviewReport();
            },
          },
          {
            text: '取消',
            style: 'cancel',
            onPress: () => {
              dismiss();
            },
          },
        ]);
      } else if (canShareReport) {
        isShown = showAlert('本局复盘', '选择操作', [
          {
            text: '查看',
            onPress: () => {
              if (dismiss()) confirmOpenNightReview();
            },
          },
          {
            text: '分享战报',
            loading: reportLoading,
            onPress: () => {
              if (dismiss()) void shareNightReviewReport();
            },
          },
          {
            text: '取消',
            style: 'cancel',
            onPress: () => {
              dismiss();
            },
          },
        ]);
      }
      detailAlertGenerationRef.current = isShown ? getAlertGeneration() : null;
    },
    [confirmOpenNightReview, isHost, canShareReport, shareNightReviewReport],
  );

  const openNightReview = useCallback(() => {
    if (!isHost && !canShareReport) {
      // Non-host without share permission: confirm before viewing (anti-cheat reminder)
      confirmOpenNightReview();
      return;
    }

    detailAlertOpenRef.current = true;
    const requestId = ++detailAlertRequestRef.current;

    if (isMiniProgram()) {
      showDetailAlert(false);
      return;
    }

    // Start capture in background; update alert to enable "分享战报" on completion
    void beginReportCapture().then(() => {
      if (
        detailAlertOpenRef.current &&
        detailAlertRequestRef.current === requestId &&
        detailAlertGenerationRef.current === getAlertGeneration()
      ) {
        showDetailAlert(false);
      }
    });

    // Show alert immediately with loading "分享战报"
    showDetailAlert(true);
  }, [confirmOpenNightReview, isHost, canShareReport, beginReportCapture, showDetailAlert]);

  const closeNightReview = useCallback(() => setNightReviewVisible(false), []);

  const closeShareReview = useCallback(() => setShareReviewVisible(false), []);

  const handleShareNightReview = useCallback(
    async (allowedSeats: number[]) => {
      const requestId = detailAlertRequestRef.current;
      const result = await shareNightReview(allowedSeats);
      if (detailAlertRequestRef.current === requestId && isSuccessfulRoomCommand(result)) {
        setShareReviewVisible(false);
      }
    },
    [shareNightReview],
  );

  // ── Last night info ──
  const showLastNightInfo = useCallback(() => {
    showConfirmAlert(
      '提示',
      '昨夜信息可能影响警长竞选，请确认现在查看。',
      () => {
        const info = getLastNightInfo();
        const curseInfo = getCurseInfo();
        const buttons: {
          text: string;
          onPress?: () => void;
          style?: 'default' | 'cancel' | 'destructive';
        }[] = [DISMISS_BUTTON];
        if (curseInfo != null) {
          buttons.unshift({
            text: '查看诅咒',
            onPress: () => {
              showDismissAlert('乌鸦诅咒', curseInfo);
            },
          });
        }
        showAlert('昨夜信息', info, buttons);
      },
      { confirmText: '确定查看' },
    );
  }, [getLastNightInfo, getCurseInfo]);

  return {
    roleCardVisible,
    shouldPlayRevealAnimation,
    isLoadingRole,
    setRoleCardVisible,
    setShouldPlayRevealAnimation,
    setIsLoadingRole,
    handleRoleCardClose,
    skillPreviewRoleId,
    handleSkillPreviewOpen,
    handleSkillPreviewClose,
    nightReviewVisible,
    openNightReview,
    closeNightReview,
    shareReviewVisible,
    closeShareReview,
    handleShareNightReview,
    showLastNightInfo,
  };
}
