import './avatarConcentric.css';

/**
 * Class of a square box around an avatar (a seat, a tile, a mat, an avatar-sized placeholder):
 * its corners derive from `AVATAR_CORNER_RATIO` and its own `--avatar-inset` (border plus padding
 * up to the avatar), so they stay concentric with the avatar at every size. Such a box sets no
 * `border-radius` of its own.
 */
export const AVATAR_CONCENTRIC_CLASS = 'avatar-concentric';
