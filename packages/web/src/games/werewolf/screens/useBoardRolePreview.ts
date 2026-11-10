/** Shared board role preview state and AI intent; does not change board selection or game state. */
import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';
import { useState } from 'react';

import { askAIAboutRole, useAIChatAvailable } from '@/games/werewolf/services/aiChatBridge';

/** Provides board role selection and the complete props for RoleCardSimple. */
export function useBoardRolePreview() {
  const [previewRoleId, setPreviewRoleId] = useState<RoleId | null>(null);
  const isAIChatAvailable = useAIChatAvailable();
  const handlePreviewClose = () => setPreviewRoleId(null);

  return {
    handleRolePress: setPreviewRoleId,
    roleCardProps: {
      visible: previewRoleId !== null,
      roleId: previewRoleId,
      onClose: handlePreviewClose,
      showRealIdentity: true,
      onAskAI: isAIChatAvailable
        ? (roleId: RoleId) => askAIAboutRole(roleId, handlePreviewClose)
        : undefined,
    },
  };
}
