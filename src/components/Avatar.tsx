/**
 * Avatar - 用户头像组件
 *
 * 自定义头像优先（远程 URL / builtin://）。无自定义时使用狼爪图标作为默认头像，
 * 基于 uid hash 确定性分配颜色 tint。
 * Memoized 以避免不必要的重渲染。不 import service，不含业务逻辑。
 */
import { Image as ExpoImage } from 'expo-image';
import React, { memo, useMemo } from 'react';
import { Image, ImageSourcePropType, StyleSheet, View } from 'react-native';

import { colors } from '@/theme';
import { getBuiltinAvatarImage, isBuiltinAvatarUrl } from '@/utils/avatar';
import { getAvatarIcon } from '@/utils/defaultAvatarIcons';

interface AvatarProps {
  value: string;
  size: number;
  /** Custom avatar URL. If provided, will be used instead of generated avatar */
  avatarUrl?: string | null;
  /** Room ID for room-specific default avatar (stable per uid+roomId) */
  roomId?: string;
  /** Pre-computed unique avatar index from getUniqueAvatarMap. Takes priority over roomId hash. */
  avatarIndex?: number;
  /** Override border radius. Defaults to size / 4. */
  borderRadius?: number;
}

/**
 * Avatar component that displays either a custom uploaded avatar
 * or a deterministic lucide icon based on uid.
 *
 * Default avatar selection priority:
 * 1. avatarUrl (custom uploaded / remote)
 * 2. avatarUrl (builtin:// → local asset)
 * 3. Wolf paw icon with tint color based on uid hash (fallback)
 *
 * Memoized to prevent unnecessary re-renders when parent components update
 */
const AvatarComponent: React.FC<AvatarProps> = ({
  value,
  size,
  avatarUrl,
  borderRadius: borderRadiusProp,
}) => {
  const radius = borderRadiusProp ?? size / 4;

  // Memoize style object for image-based avatars
  const imageStyle = useMemo(
    () => [
      styles.avatar,
      {
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: colors.border,
        overflow: 'hidden' as const,
      },
    ],
    [size, radius],
  );

  // Memoize URI source object to prevent new object creation
  const uriSource = useMemo(
    () => (avatarUrl && !isBuiltinAvatarUrl(avatarUrl) ? { uri: avatarUrl } : null),
    [avatarUrl],
  );

  // Memoize builtin image source
  const builtinSource = useMemo(
    () => (avatarUrl && isBuiltinAvatarUrl(avatarUrl) ? getBuiltinAvatarImage(avatarUrl) : null),
    [avatarUrl],
  );

  // Deterministic icon + color based on uid
  const iconInfo = useMemo(() => getAvatarIcon(value), [value]);

  // Memoize icon container style
  const iconContainerStyle = useMemo(
    () => [styles.iconContainer, { width: size, height: size, borderRadius: radius }],
    [size, radius],
  );

  // 1. Remote custom avatar (expo-image for caching)
  if (uriSource) {
    return (
      <ExpoImage
        source={uriSource}
        style={imageStyle}
        contentFit="cover"
        transition={200}
        cachePolicy="disk"
        accessibilityLabel="头像"
      />
    );
  }

  // 2. Builtin avatar (local asset)
  if (builtinSource) {
    return (
      <Image
        source={builtinSource as ImageSourcePropType}
        style={imageStyle}
        resizeMode="cover"
        accessibilityLabel="头像"
      />
    );
  }

  // 3. Default: Wolf paw icon with tint color
  const { image, color } = iconInfo;
  const iconSize = Math.round(size * 0.7);
  return (
    <View style={iconContainerStyle} accessibilityLabel="头像">
      <Image
        source={image}
        style={{ width: iconSize, height: iconSize }}
        tintColor={color}
        resizeMode="contain"
      />
    </View>
  );
};

// Memoize to prevent re-renders when props haven't changed
export const Avatar = memo(AvatarComponent);

const styles = StyleSheet.create({
  avatar: {},
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
