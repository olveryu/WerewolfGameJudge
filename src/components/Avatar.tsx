/**
 * Avatar - 用户头像组件
 *
 * 三层头像系统：
 * 1. avatarUrl → 用户上传（ExpoImage）
 * 2. 注册用户 → 56 张暗黑肖像（RN Image）
 * 3. 匿名用户 → Lucide 线条 SVG 图标
 *
 * Memoized 以避免不必要的重渲染。
 * 渲染头像图片，通过 props 配置。不 import service，不含业务逻辑。
 */
import { Image as ExpoImage } from 'expo-image';
import React, { memo, useMemo } from 'react';
import { Image, ImageSourcePropType, StyleSheet, View } from 'react-native';

import { useColors } from '@/theme';
import { getAvatarByUid, getAvatarImage, getAvatarImageByIndex } from '@/utils/avatar';
import { getLucideColorByIndex, getLucideIconByIndex } from '@/utils/lucideAvatars';

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
  /** Whether this player is anonymous. When true (and no avatarUrl), renders a Lucide line icon. */
  isAnonymous?: boolean;
  /** Pre-computed unique Lucide icon index for anonymous players (from getUniqueLucideAvatarMap). */
  lucideIndex?: number;
}

/**
 * Avatar component that displays user avatar with three-tier priority:
 * 1. avatarUrl (custom uploaded) → ExpoImage
 * 2. Registered user → local dark fantasy portrait (RN Image)
 * 3. Anonymous user → Lucide line SVG icon
 *
 * Memoized to prevent unnecessary re-renders when parent components update
 */
const AvatarComponent: React.FC<AvatarProps> = ({
  value,
  size,
  avatarUrl,
  roomId,
  avatarIndex,
  borderRadius: borderRadiusProp,
  isAnonymous,
  lucideIndex,
}) => {
  const colors = useColors();
  const radius = borderRadiusProp ?? size / 4;

  // Memoize style object to prevent new object creation on each render
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
    [size, radius, colors.border],
  );

  // Memoize URI source object to prevent new object creation
  const uriSource = useMemo(() => (avatarUrl ? { uri: avatarUrl } : null), [avatarUrl]);

  // Memoize local image source based on avatarIndex, uid and roomId
  const localImageSource = useMemo(() => {
    if (avatarUrl || isAnonymous) return null; // Not needed for custom or anonymous
    if (avatarIndex !== undefined) return getAvatarImageByIndex(avatarIndex);
    return roomId ? getAvatarByUid(roomId, value) : getAvatarImage(value);
  }, [avatarUrl, isAnonymous, avatarIndex, roomId, value]);

  // Tier 1: custom uploaded avatar
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

  // Tier 3: anonymous user → Lucide line icon
  if (isAnonymous) {
    const idx = lucideIndex ?? 0;
    const IconComponent = getLucideIconByIndex(idx);
    const iconColor = getLucideColorByIndex(idx);
    const iconSize = Math.round(size * 0.55);
    // Tinted background: icon color at 15% opacity
    const tintedBg = `${iconColor}26`;
    return (
      <View style={[imageStyle, { backgroundColor: tintedBg }]} accessibilityLabel="匿名头像">
        <View style={styles.iconCenter}>
          <IconComponent size={iconSize} color={iconColor} strokeWidth={1.5} />
        </View>
      </View>
    );
  }

  // Tier 2: registered user → dark fantasy portrait
  return (
    <Image
      source={localImageSource as ImageSourcePropType}
      style={imageStyle}
      resizeMode="cover"
      accessibilityLabel="头像"
    />
  );
};

// Memoize to prevent re-renders when props haven't changed
export const Avatar = memo(AvatarComponent);

const styles = StyleSheet.create({
  avatar: {},
  iconCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
