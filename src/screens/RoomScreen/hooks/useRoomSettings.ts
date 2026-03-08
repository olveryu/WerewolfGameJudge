/**
 * useRoomSettings — Settings sheet state and handlers for RoomScreen.
 *
 * Owns settingsSheetVisible, bgmEnabled, and the four callbacks that
 * open/close the sheet and change animation/BGM settings. Pure UI state
 * management — does not contain game logic.
 */

import type { RoleRevealAnimation } from '@werewolf/game-engine/types/RoleRevealAnimation';
import { useCallback, useState } from 'react';

import type { SettingsService } from '@/services/feature/SettingsService';
import { fireAndForget } from '@/utils/errorUtils';
import { roomScreenLog } from '@/utils/logger';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface UseRoomSettingsInput {
  settingsService: SettingsService;
  setRoleRevealAnimation: (animation: RoleRevealAnimation) => Promise<void>;
}

interface UseRoomSettingsResult {
  settingsSheetVisible: boolean;
  bgmEnabled: boolean;
  handleOpenSettings: () => void;
  handleCloseSettings: () => void;
  handleAnimationChange: (v: string) => void;
  handleBgmChange: (v: string) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useRoomSettings(input: UseRoomSettingsInput): UseRoomSettingsResult {
  const { settingsService, setRoleRevealAnimation } = input;

  const [settingsSheetVisible, setSettingsSheetVisible] = useState(false);
  const [bgmEnabled, setBgmEnabled] = useState(() => settingsService.isBgmEnabled());

  const handleOpenSettings = useCallback(() => {
    setSettingsSheetVisible(true);
  }, []);

  const handleCloseSettings = useCallback(() => {
    setSettingsSheetVisible(false);
  }, []);

  const handleAnimationChange = useCallback(
    (v: string) => {
      const anim = v as RoleRevealAnimation;
      fireAndForget(
        setRoleRevealAnimation(anim).then(() => settingsService.setRoleRevealAnimation(anim)),
        '[handleAnimationChange] failed',
        roomScreenLog,
      );
    },
    [setRoleRevealAnimation, settingsService],
  );

  const handleBgmChange = useCallback(
    (v: string) => {
      const enabled = v === 'on';
      setBgmEnabled(enabled);
      fireAndForget(
        settingsService.setBgmEnabled(enabled),
        '[handleBgmChange] failed',
        roomScreenLog,
      );
    },
    [settingsService],
  );

  return {
    settingsSheetVisible,
    bgmEnabled,
    handleOpenSettings,
    handleCloseSettings,
    handleAnimationChange,
    handleBgmChange,
  };
}
