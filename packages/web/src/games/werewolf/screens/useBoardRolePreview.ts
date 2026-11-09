/** Shared board role preview state; does not change board selection or game state. */
import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';
import { useState } from 'react';

/** Provides board role selection and the complete props for RoleCardSimple. */
export function useBoardRolePreview() {
  const [previewRoleId, setPreviewRoleId] = useState<RoleId | null>(null);

  return {
    handleRolePress: setPreviewRoleId,
    roleCardProps: {
      visible: previewRoleId !== null,
      roleId: previewRoleId,
      onClose: () => setPreviewRoleId(null),
      showRealIdentity: true,
    },
  };
}
