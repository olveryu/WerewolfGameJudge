import React from 'react';
import { Image, StyleSheet, ImageSourcePropType } from 'react-native';
import { getAvatarImage, getUniqueAvatarBySeat } from '../utils/avatar';

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
 */
export const Avatar: React.FC<AvatarProps> = ({ value, size, avatarUrl, seatNumber, roomId }) => {
  // Use custom avatar URL if provided, otherwise use local image
  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={[styles.avatar, { width: size, height: size, borderRadius: size / 4 }]}
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
      style={[styles.avatar, { width: size, height: size, borderRadius: size / 4 }]}
    />
  );
};

const styles = StyleSheet.create({
  avatar: {
    backgroundColor: '#e0e0e0',
  },
});

export default Avatar;
