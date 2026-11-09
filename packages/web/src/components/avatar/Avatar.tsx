import './Avatar.css';

import { type CSSProperties } from 'react';

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

/** A user's avatar: uploaded image, builtin portrait, generated SVG or tinted wolf paw. */
export function Avatar({ userId, avatarUrl, size }: AvatarProps) {
  const source = resolveAvatarSource(userId, avatarUrl);
  const isFill = size === 'fill';
  const style: CSSProperties = isFill ? {} : { width: size, height: size, borderRadius: size / 4 };
  const svgSize = isFill ? '100%' : size;

  if (source.kind === 'image') {
    return (
      <img
        className="avatar"
        data-fill={isFill}
        style={style}
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
      <span className="avatar" data-fill={isFill} style={style} role="img" aria-label="头像">
        <GeneratedAvatar seed={source.seed} size={svgSize} />
      </span>
    );
  }
  return (
    <span
      className="avatar avatar-fallback"
      data-fill={isFill}
      style={style}
      role="img"
      aria-label="头像"
    >
      <span
        className="avatar-fallback-mark"
        style={{
          backgroundColor: source.tint,
          maskImage: `url(${source.maskUrl})`,
          WebkitMaskImage: `url(${source.maskUrl})`,
        }}
      />
    </span>
  );
}
