import blank from '../../../../../../assets/avatars/web/blank.webp';

const SECRETHITLER_ROLE_IMAGE_MAP: Readonly<Record<string, string>> = {
  liberal: blank,
  fascist: blank,
  hitler: blank,
};

const SECRETHITLER_BOARD_ROLE_PORTRAITS = [blank] as const;

/** Resolve a Secret Hitler identity to its temporary shared placeholder portrait. */
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
