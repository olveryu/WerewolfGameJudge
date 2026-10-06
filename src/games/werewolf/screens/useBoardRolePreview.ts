/** Shared board role preview state and AI intent; does not change board selection or game state. */
import { isValidRoleId, type RoleId } from '@game-judge/game-engine/games/werewolf/public';
import { useCallback, useState } from 'react';

import {
  type AIAboutRoleRequest,
  buildAIAboutRoleRequest,
  requestAIChatMessage,
} from '@/games/werewolf/services/aiChatBridge';
import { isAIChatReady } from '@/games/werewolf/services/AIChatService';

/** Provides board role selection and the complete props for RoleCardSimple. */
export function useBoardRolePreview() {
  const [previewRoleId, setPreviewRoleId] = useState<RoleId | null>(null);
  const [aiConfirm, setAiConfirm] = useState<AIAboutRoleRequest | null>(null);

  const handleRolePress = useCallback((roleId: string) => {
    if (!isValidRoleId(roleId)) {
      throw new Error(`[useBoardRolePreview] Invalid role ID: ${roleId}`);
    }
    setPreviewRoleId(roleId);
  }, []);

  const handlePreviewClose = useCallback(() => {
    setPreviewRoleId(null);
  }, []);

  const handleAskAI = useCallback((roleId: RoleId) => {
    const req = buildAIAboutRoleRequest(roleId);
    if (req) setAiConfirm(req);
  }, []);

  const confirmAskAI = useCallback(() => {
    if (aiConfirm) {
      handlePreviewClose();
      requestAIChatMessage(aiConfirm.payload);
    }
    setAiConfirm(null);
  }, [aiConfirm, handlePreviewClose]);

  const clearAiConfirm = useCallback(() => setAiConfirm(null), []);

  return {
    handleRolePress,
    roleCardProps: {
      visible: previewRoleId !== null,
      roleId: previewRoleId,
      onClose: handlePreviewClose,
      showRealIdentity: true,
      onAskAI: isAIChatReady() ? handleAskAI : undefined,
    },
    aiConfirm,
    confirmAskAI,
    clearAiConfirm,
  };
}
