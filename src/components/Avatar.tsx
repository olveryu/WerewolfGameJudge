import React, { memo, useMemo } from 'react';
import { Image, ImageSourcePropType, ImageStyle } from 'react-native';
import { getAvatarImage, getAvatarByUid } from '../utils/avatar';
import { useColors } from '../theme';

interface AvatarProps {
  /** User ID for avatar generation (used when no avatarUrl) */
  value: string;
  size: number;
  /** Custom avatar URL. If provided, will be used instead of generated avatar */
  avatarUrl?: string | null;
  /** Room ID for room-specific default avatar (stable per uid+roomId) */
  roomId?: string;
}

/**
 * Avatar component that displays either a custom uploaded avatar
 * or uses a local avatar image from assets/avatars
 *
 * Default avatar selection:
 * - If roomId is provided: uses uid + roomId hash for stable, seat-independent avatar
 * - Otherwise: falls back to hash-based avatar selection using value (uid)
 *
 * Memoized to prevent unnecessary re-renders when parent components update
 */
const AvatarComponent: React.FC<AvatarProps> = ({ value, size, avatarUrl, roomId }) => {
  const colors = useColors();

  // Memoize style object as a single object (not array) to prevent re-renders
  const imageStyle = useMemo<ImageStyle>(
    () => ({
      width: size,
      height: size,
      borderRadius: size / 4,
      backgroundColor: colors.border,
    }),
    [size, colors.border],
  );

  // Memoize local image source based on uid and roomId
  // This ensures same (uid, roomId) always gets same avatar, regardless of seat
  const localImageSource = useMemo(() => {
    if (avatarUrl) return null; // Not needed when custom avatar is provided
    return roomId ? getAvatarByUid(roomId, value) : getAvatarImage(value);
  }, [avatarUrl, roomId, value]);

  // Use custom avatar URL if provided, otherwise use local image
  if (avatarUrl) {
    return <Image source={{ uri: avatarUrl }} style={imageStyle} resizeMode="cover" />;
  }

  return (
    <Image source={localImageSource as ImageSourcePropType} style={imageStyle} resizeMode="cover" />
  );
};

// Memoize to prevent re-renders when props haven't changed
export const Avatar = memo(AvatarComponent);

export default Avatar;
