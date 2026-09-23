/** Shared board role preview state and AI intent; does not change board selection or game state. */
import { isValidRoleId, type RoleId } from '@game-judge/game-engine/games/werewolf/public';
import { useCallback, useState } from 'react';

import { askAIAboutRole } from '@/games/werewolf/services/aiChatBridge';
import { isAIChatReady } from '@/games/werewolf/services/AIChatService';

/** Provides board role selection and the complete props for RoleCardSimple. */
export function useBoardRolePreview() {
  const [previewRoleId, setPreviewRoleId] = useState<RoleId | null>(null);

  const handleRolePress = useCallback((roleId: string) => {
    if (!isValidRoleId(roleId)) {
      throw new Error(`[useBoardRolePreview] Invalid role ID: ${roleId}`);
    }
    setPreviewRoleId(roleId);
  }, []);

  const handlePreviewClose = useCallback(() => {
    setPreviewRoleId(null);
  }, []);

  const handleAskAI = useCallback(
    (roleId: RoleId) => askAIAboutRole(roleId, handlePreviewClose),
    [handlePreviewClose],
  );

  return {
    handleRolePress,
    roleCardProps: {
      visible: previewRoleId !== null,
      roleId: previewRoleId,
      onClose: handlePreviewClose,
      showRealIdentity: true,
      onAskAI: isAIChatReady() ? handleAskAI : undefined,
    },
  };
}
