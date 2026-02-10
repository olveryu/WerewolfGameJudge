/**
 * Avatar - 用户头像组件
 *
 * 支持自定义头像 URL、uid 随机生成、roomId 稳定分配。
 * Memoized 以避免不必要的重渲染。
 *
 * ✅ 允许：渲染头像图片、通过 props 配置
 * ❌ 禁止：import service / 业务逻辑
 */
import React, { memo, useMemo } from 'react';
import { Image, ImageSourcePropType,StyleSheet } from 'react-native';

import { useColors } from '@/theme';
import { getAvatarByUid, getAvatarImage, getAvatarImageByIndex } from '@/utils/avatar';

interface AvatarProps {
  value: string;
  size: number;
  /** Custom avatar URL. If provided, will be used instead of generated avatar */
  avatarUrl?: string | null;
  /** Room ID for room-specific default avatar (stable per uid+roomId) */
  roomId?: string;
  /** Pre-computed unique avatar index from getUniqueAvatarMap. Takes priority over roomId hash. */
  avatarIndex?: number;
}

/**
 * Avatar component that displays either a custom uploaded avatar
 * or uses a local avatar image from assets/avatars
 *
 * Default avatar selection priority:
 * 1. avatarUrl (custom uploaded)
 * 2. avatarIndex (pre-computed unique index from room-level dedup)
 * 3. roomId + uid hash (fallback)
 * 4. uid-only hash (no room context)
 *
 * Memoized to prevent unnecessary re-renders when parent components update
 */
const AvatarComponent: React.FC<AvatarProps> = ({
  value,
  size,
  avatarUrl,
  roomId,
  avatarIndex,
}) => {
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
  const uriSource = useMemo(() => (avatarUrl ? { uri: avatarUrl } : null), [avatarUrl]);

  // Memoize local image source based on avatarIndex, uid and roomId
  const localImageSource = useMemo(() => {
    if (avatarUrl) return null; // Not needed when custom avatar is provided
    if (avatarIndex !== undefined) return getAvatarImageByIndex(avatarIndex);
    return roomId ? getAvatarByUid(roomId, value) : getAvatarImage(value);
  }, [avatarUrl, avatarIndex, roomId, value]);

  // Use custom avatar URL if provided, otherwise use local image
  if (uriSource) {
    return <Image source={uriSource} style={imageStyle} resizeMode="cover" />;
  }

  return (
    <Image source={localImageSource as ImageSourcePropType} style={imageStyle} resizeMode="cover" />
  );
};

// Memoize to prevent re-renders when props haven't changed
export const Avatar = memo(AvatarComponent);

const styles = StyleSheet.create({
  avatar: {},
});

