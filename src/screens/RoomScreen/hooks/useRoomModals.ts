/**
 * useRoomModals — RoomScreen 的全局弹窗/模态框状态管理
 *
 * 从 useRoomScreenState 提取，集中管理所有弹窗的 visible 状态和 open/close handler。
 * 包含：角色卡片、技能预览、夜晚详情、分享详情、昨夜信息。
 * 不包含座位弹窗（由 useRoomSeatDialogs 管理）和 action 弹窗（由 useRoomActionDialogs 管理）。
 */

import type { RoleId } from '@werewolf/game-engine/models/roles';
import { useCallback, useState } from 'react';

import { CANCEL_BUTTON, DISMISS_BUTTON, showAlert } from '@/utils/alert';

/** useRoomModals 依赖 */
interface UseRoomModalsDeps {
  /** 当前用户是否是 Host（决定 "详细信息" 弹窗的选项） */
  isHost: boolean;
  /** 当前用户是否可以分享战报截图（Host 或已被 Host share 的玩家） */
  canShareReport: boolean;
  /** 获取昨夜信息文本 */
  getLastNightInfo: () => string; /** 获取乌鸦诅咒信息，无乌鸦返回 null */
  getCurseInfo: () => string | null; /** 分享夜晚详情给指定座位（HTTP API） */
  shareNightReview: (allowedSeats: number[]) => Promise<void>;
  /** 直接分享战报（系统分享/复制） */
  shareNightReviewReport: () => Promise<void>;
}

/** useRoomModals 返回值 */
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

  const confirmOpenNightReview = useCallback(() => {
    showAlert('提示', '请确保你是裁判或观战玩家，再查看详细信息', [
      { text: '取消', style: 'cancel' },
      {
        text: '确定查看',
        onPress: () => setNightReviewVisible(true),
      },
    ]);
  }, []);

  const openNightReview = useCallback(() => {
    if (isHost) {
      // Host: choose between viewing or sharing
      showAlert('详细信息', '选择操作', [
        {
          text: '自己查看',
          onPress: () => confirmOpenNightReview(),
        },
        {
          text: '分享给玩家',
          onPress: () => setShareReviewVisible(true),
        },
        {
          text: '分享战报',
          onPress: () => {
            void shareNightReviewReport();
          },
        },
        { text: '取消', style: 'cancel' },
      ]);
    } else if (canShareReport) {
      // Non-host allowed player: view or share
      showAlert('详细信息', '选择操作', [
        {
          text: '查看',
          onPress: () => confirmOpenNightReview(),
        },
        {
          text: '分享战报',
          onPress: () => {
            void shareNightReviewReport();
          },
        },
        { text: '取消', style: 'cancel' },
      ]);
    } else {
      // Non-host without share permission: confirm before viewing (anti-cheat reminder)
      confirmOpenNightReview();
    }
  }, [confirmOpenNightReview, isHost, canShareReport, shareNightReviewReport]);

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
    showAlert('提示', '请在警长竞选结束后再查看，请勿作弊', [
      CANCEL_BUTTON,
      {
        text: '确定查看',
        onPress: () => {
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
                showAlert('乌鸦诅咒', curseInfo, [DISMISS_BUTTON]);
              },
            });
          }
          showAlert('昨夜信息', info, buttons);
        },
      },
    ]);
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
