import './Avatar.css';

import { type CSSProperties } from 'react';

import { resolveAvatarSource } from './avatarSources';
import { GeneratedAvatar } from './GeneratedAvatar';

interface AvatarProps {
  /** User id; seeds the fallback tint. */
  userId: string;
  /** Uploaded URL or `builtin://<id>`; null shows the fallback. */
  avatarUrl: string | null;
  size: number;
}

/** A user's avatar: uploaded image, builtin portrait, generated SVG or tinted wolf paw. */
export function Avatar({ userId, avatarUrl, size }: AvatarProps) {
  const source = resolveAvatarSource(userId, avatarUrl);
  const style: CSSProperties = { width: size, height: size, borderRadius: size / 4 };

  if (source.kind === 'image') {
    return (
      <img
        className="avatar"
        style={style}
        src={source.url}
        alt="头像"
        width={size}
        height={size}
        decoding="async"
      />
    );
  }
  if (source.kind === 'generated') {
    return (
      <span className="avatar" style={style} role="img" aria-label="头像">
        <GeneratedAvatar seed={source.seed} size={size} />
      </span>
    );
  }
  return (
    <span className="avatar avatar-fallback" style={style} role="img" aria-label="头像">
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
