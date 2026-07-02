/**
 * useRoomModals — Global modal/dialog state management for RoomScreen
 *
 * Extracted from useRoomScreenState; centralizes visible state and open/close handlers for all modals.
 * Includes: role card, skill preview, night details, share details, last-night info.
 * Excludes seat operations (managed by shared useRoomSeatOperations) and action dialogs
 * (managed by useRoomActionDialogs).
 */

import type { RoleId } from '@werewolf/game-engine/werewolf/models/roles';
import { useCallback, useRef, useState } from 'react';

import { DISMISS_BUTTON, showAlert } from '@/utils/alert';
import { showConfirmAlert, showDismissAlert } from '@/utils/alertPresets';

/** useRoomModals deps */
interface UseRoomModalsDeps {
  /** Whether current user is Host (determines "详细信息" modal options) */
  isHost: boolean;
  /** Whether current user can share the night-report screenshot (Host or a player shared by Host) */
  canShareReport: boolean;
  /** Get last-night info text */
  getLastNightInfo: () => string; /** Get crow curse info; null if no crow */
  getCurseInfo: () => string | null; /** Share night details to specified seats (HTTP API) */
  shareNightReview: (allowedSeats: number[]) => Promise<void>;
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
    setSkillPreviewRoleId(roleId as RoleId);
  }, []);

  const handleSkillPreviewClose = useCallback(() => {
    setSkillPreviewRoleId(null);
  }, []);

  // ── Share review modal (declared before night review because openNightReview references setShareReviewVisible) ──
  const [shareReviewVisible, setShareReviewVisible] = useState(false);

  // ── Night review modal ──
  const [nightReviewVisible, setNightReviewVisible] = useState(false);

  /** Tracks whether the "详细信息" alert is still open (prevents re-showing after dismiss). */
  const detailAlertOpenRef = useRef(false);

  const confirmOpenNightReview = useCallback(() => {
    showConfirmAlert(
      '提示',
      '请确保你是裁判或观战玩家，再查看详细信息',
      () => setNightReviewVisible(true),
      { confirmText: '确定查看' },
    );
  }, []);

  /**
   * Show the "详细信息" alert with optional loading state on "分享战报" button.
   * Can be called twice: first with `reportLoading: true`, then with `false`
   * once capture completes — `showAlert` seamlessly updates the existing modal.
   */
  const showDetailAlert = useCallback(
    (reportLoading: boolean) => {
      const dismiss = () => {
        detailAlertOpenRef.current = false;
      };

      if (isHost) {
        showAlert('详细信息', '选择操作', [
          {
            text: '自己查看',
            onPress: () => {
              dismiss();
              confirmOpenNightReview();
            },
          },
          {
            text: '分享给玩家',
            onPress: () => {
              dismiss();
              setShareReviewVisible(true);
            },
          },
          {
            text: '分享战报',
            loading: reportLoading,
            onPress: () => {
              dismiss();
              void shareNightReviewReport();
            },
          },
          {
            text: '取消',
            style: 'cancel',
            onPress: dismiss,
          },
        ]);
      } else if (canShareReport) {
        showAlert('详细信息', '选择操作', [
          {
            text: '查看',
            onPress: () => {
              dismiss();
              confirmOpenNightReview();
            },
          },
          {
            text: '分享战报',
            loading: reportLoading,
            onPress: () => {
              dismiss();
              void shareNightReviewReport();
            },
          },
          {
            text: '取消',
            style: 'cancel',
            onPress: dismiss,
          },
        ]);
      }
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

    // Start capture in background; update alert to enable "分享战报" on completion
    void beginReportCapture().then(() => {
      if (detailAlertOpenRef.current) {
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
      await shareNightReview(allowedSeats);
      setShareReviewVisible(false);
    },
    [shareNightReview],
  );

  // ── Last night info ──
  const showLastNightInfo = useCallback(() => {
    showConfirmAlert(
      '提示',
      '请在警长竞选结束后再查看，请勿作弊',
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
