import './Avatar.css';

import { resolveAvatarSource } from './avatarSources';
import { GeneratedAvatar } from './GeneratedAvatar';

interface AvatarProps {
  /** User id; seeds the fallback tint. */
  userId: string;
  /** Uploaded URL or `builtin://<id>`; null shows the fallback. */
  avatarUrl: string | null;
  /** Pixel size, or `fill` to fill the parent box (which sets the size). */
  size: number | 'fill';
}

/**
 * A user's avatar: uploaded image, builtin portrait, generated SVG or tinted wolf paw. It owns its
 * shape: Avatar.css gives it `AVATAR_CORNER_RATIO` corners (config/avatarShape.ts) at every size.
 * The size, tint and mask are runtime values and reach the stylesheet as custom properties.
 */
export function Avatar({ userId, avatarUrl, size }: AvatarProps) {
  const source = resolveAvatarSource(userId, avatarUrl);
  const isFill = size === 'fill';
  const avatarSize = isFill ? undefined : `${size}px`;
  const svgSize = isFill ? '100%' : size;

  if (source.kind === 'image') {
    return (
      <img
        className="avatar"
        data-fill={isFill}
        style={{ '--avatar-size': avatarSize }}
        src={source.url}
        alt="头像"
        width={isFill ? undefined : size}
        height={isFill ? undefined : size}
        decoding="async"
      />
    );
  }
  if (source.kind === 'generated') {
    return (
      <span
        className="avatar"
        data-fill={isFill}
        style={{ '--avatar-size': avatarSize }}
        role="img"
        aria-label="头像"
      >
        <GeneratedAvatar seed={source.seed} size={svgSize} />
      </span>
    );
  }
  return (
    <span
      className="avatar avatar-fallback"
      data-fill={isFill}
      style={{ '--avatar-size': avatarSize }}
      role="img"
      aria-label="头像"
    >
      <span
        className="avatar-fallback-mark"
        style={{ '--avatar-tint': source.tint, '--avatar-mask': `url(${source.maskUrl})` }}
      />
    </span>
  );
}
