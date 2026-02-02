import React, { memo, useMemo } from 'react';
import { Image, StyleSheet, ImageSourcePropType } from 'react-native';
import { getAvatarImage, getUniqueAvatarBySeat } from '../utils/avatar';
import { useColors } from '../theme';

interface AvatarProps {
  value: string;
  size: number;
  /** Custom avatar URL. If provided, will be used instead of generated avatar */
  avatarUrl?: string | null;
  /** Seat number for unique avatar assignment in a room (1-based) */
  seatNumber?: number;
  /** Room ID for room-specific avatar offset */
  roomId?: string;
}

/**
 * Avatar component that displays either a custom uploaded avatar
 * or uses a local avatar image from assets/avatars
 *
 * If seatNumber is provided, uses seat-based unique avatar assignment
 * Otherwise falls back to hash-based avatar selection using value
 *
 * Memoized to prevent unnecessary re-renders when parent components update
 */
const AvatarComponent: React.FC<AvatarProps> = ({ value, size, avatarUrl, seatNumber, roomId }) => {
  const colors = useColors();

  // Memoize style object to prevent new object creation on each render
  const imageStyle = useMemo(
    () => [
      styles.avatar,
      { width: size, height: size, borderRadius: size / 4, backgroundColor: colors.border },
    ],
    [size, colors.border],
  );

  // Memoize URI source object to prevent new object creation
  const uriSource = useMemo(
    () => (avatarUrl ? { uri: avatarUrl } : null),
    [avatarUrl],
  );

  // Use custom avatar URL if provided, otherwise use local image
  if (uriSource) {
    return (
      <Image
        source={uriSource}
        style={imageStyle}
        resizeMode="cover"
      />
    );
  }

  // Use seat-based unique avatar if seat number is provided
  // Otherwise fall back to hash-based avatar
  const imageSource = seatNumber
    ? getUniqueAvatarBySeat(seatNumber, roomId)
    : getAvatarImage(value);

  return (
    <Image
      source={imageSource as ImageSourcePropType}
      style={imageStyle}
      resizeMode="cover"
    />
  );
};

// Memoize to prevent re-renders when props haven't changed
export const Avatar = memo(AvatarComponent);

const styles = StyleSheet.create({
  avatar: {},
});

export default Avatar;
