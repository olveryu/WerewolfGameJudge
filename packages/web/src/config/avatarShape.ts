/**
 * The one avatar shape: a rounded square whose corner radius is this fraction of its side.
 * `Avatar` applies it at every size, the scene draws avatar frames along the same corner, and
 * boxes around an avatar derive their corners from it (`AVATAR_CONCENTRIC_CLASS`), so no other
 * code sets an avatar's corners.
 */
export const AVATAR_CORNER_RATIO = 0.25;

/** The CSS custom property that carries {@link AVATAR_CORNER_RATIO} to stylesheets. */
export const AVATAR_CORNER_RATIO_PROPERTY = '--avatar-corner-ratio';

/** Publishes {@link AVATAR_CORNER_RATIO} as {@link AVATAR_CORNER_RATIO_PROPERTY} on the root. */
export function applyAvatarShapeTokens(root: HTMLElement): void {
  // eslint-disable-next-line no-restricted-syntax -- the ratio's one publisher; the name is a custom property.
  root.style.setProperty(AVATAR_CORNER_RATIO_PROPERTY, String(AVATAR_CORNER_RATIO));
}
