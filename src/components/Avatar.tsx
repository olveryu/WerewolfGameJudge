/**
 * Avatar - 用户头像组件
 *
 * 自定义头像优先（远程 URL / builtin://）。无自定义时使用狼爪图标作为默认头像，
 * 基于 userId hash 确定性分配颜色 tint。
 * Memoized 以避免不必要的重渲染。不 import service，不含业务逻辑。
 */
import { Image as ExpoImage } from 'expo-image';
import React, { memo, useMemo } from 'react';
import { Image, ImageSourcePropType, StyleSheet, View } from 'react-native';

import { colors } from '@/theme';
import { getBuiltinAvatarId, getBuiltinAvatarImage, isBuiltinAvatarUrl } from '@/utils/avatar';
import { getAvatarIcon } from '@/utils/defaultAvatarIcons';

import { GeneratedAvatar, isGeneratedAvatar } from './GeneratedAvatar';

interface AvatarProps {
  value: string;
  size: number;
  /** Custom avatar URL. If provided, will be used instead of generated avatar */
  avatarUrl?: string | null;
  /** Override border radius. Defaults to size / 4. */
  borderRadius?: number;
  /** Hide placeholder background (used when avatar frame covers the edge). */
  hideBackground?: boolean;
}

/**
 * Avatar component that displays either a custom uploaded avatar
 * or a deterministic lucide icon based on userId.
 *
 * Rendering priority:
 * 1. Remote URL → ExpoImage
 * 2. builtin:// URL → hand-drawn Image or generated SVG
 * 3. Wolf paw fallback
 */
const AvatarComponent: React.FC<AvatarProps> = ({
  value,
  size,
  avatarUrl,
  borderRadius: borderRadiusProp,
  hideBackground,
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
        backgroundColor: hideBackground ? colors.transparent : colors.border,
        overflow: 'hidden' as const,
      },
    ],
    [size, radius, hideBackground],
  );

  // Memoize URI source object to prevent new object creation
  const uriSource = useMemo(
    () => (avatarUrl && !isBuiltinAvatarUrl(avatarUrl) ? { uri: avatarUrl } : null),
    [avatarUrl],
  );

  /**
   * Resolve builtin:// URL into one of two variants:
   * - { type: 'image', source } for hand-drawn avatars with local files
   * - { type: 'generated', avatarId } for procedurally generated SVG avatars
   * - null for non-builtin URLs
   */
  const builtinVariant = useMemo(() => {
    if (!avatarUrl || !isBuiltinAvatarUrl(avatarUrl)) return null;
    const id = getBuiltinAvatarId(avatarUrl);
    if (isGeneratedAvatar(id)) return { type: 'generated' as const, avatarId: id };
    const source = getBuiltinAvatarImage(avatarUrl);
    if (source != null) return { type: 'image' as const, source };
    return null;
  }, [avatarUrl]);

  // Deterministic icon + color based on userId
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

  // 2. Builtin avatar (hand-drawn image or generated SVG)
  if (builtinVariant) {
    if (builtinVariant.type === 'generated') {
      return (
        <View style={imageStyle}>
          <GeneratedAvatar seed={builtinVariant.avatarId} size={size} />
        </View>
      );
    }
    return (
      <Image
        source={builtinVariant.source as ImageSourcePropType}
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
