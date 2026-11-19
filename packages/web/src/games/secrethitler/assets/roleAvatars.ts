import fascist from '../../../../../../assets/avatars/web/fascist.webp';
import hitler from '../../../../../../assets/avatars/web/hitler.webp';
import liberal from '../../../../../../assets/avatars/web/liberal.webp';

const SECRETHITLER_ROLE_IMAGE_MAP: Readonly<Record<string, string>> = {
  liberal,
  fascist,
  hitler,
};

const SECRETHITLER_BOARD_ROLE_PORTRAITS = [liberal, fascist, hitler] as const;

/** Resolve a Secret Hitler identity to its role portrait. */
export function getRoleAvatar(roleId: string): string {
  const image = SECRETHITLER_ROLE_IMAGE_MAP[roleId];
  if (image === undefined)
    throw new Error(`[FAIL-FAST] Missing Secret Hitler portrait for ${roleId}`);
  return image;
}

/** The public board can display any of the game's role portraits. */
export function getBoardRolePortraits(): readonly string[] {
  return SECRETHITLER_BOARD_ROLE_PORTRAITS;
}
