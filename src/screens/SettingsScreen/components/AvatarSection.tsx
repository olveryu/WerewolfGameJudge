/**
 * AvatarSection - 头像显示/编辑组件（Memoized）
 *
 * 显示当前头像 + 上传按钮，通过回调上报操作意图。
 * 渲染 UI 并上报用户 intent，不 import service，不包含业务逻辑判断。
 */
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { memo } from 'react';
import {
  ActivityIndicator,
  Image,
  ImageSourcePropType,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { Avatar } from '@/components/Avatar';
import { UI_ICONS } from '@/config/iconTokens';
import { componentSizes, fixed, ThemeColors } from '@/theme';
import { AVATAR_IMAGES, getAvatarImageByIndex } from '@/utils/avatar';

import { SettingsScreenStyles } from './styles';

/** Number of avatars shown in the anonymous-user preview strip. */
const PREVIEW_STRIP_COUNT = 4;

/** Evenly-spaced indices into AVATAR_IMAGES for the preview strip. */
const PREVIEW_STRIP_INDICES: number[] = (() => {
  const step = Math.floor(AVATAR_IMAGES.length / PREVIEW_STRIP_COUNT);
  return Array.from({ length: PREVIEW_STRIP_COUNT }, (_, i) => i * step);
})();

interface AvatarSectionProps {
  isAnonymous: boolean;
  uid: string;
  avatarSource: ImageSourcePropType | null;
  /** Whether the avatar source is a remote URL (use expo-image) */
  isRemote?: boolean;
  uploadingAvatar: boolean;
  displayName: string | null;
  onPickAvatar: () => void;
  styles: SettingsScreenStyles;
  colors: ThemeColors;
}

export const AvatarSection = memo<AvatarSectionProps>(
  ({
    isAnonymous,
    uid,
    avatarSource,
    isRemote,
    uploadingAvatar,
    displayName,
    onPickAvatar,
    styles,
    colors,
  }) => {
    // Anonymous users: show avatar + name, then a teaser card to upgrade
    if (isAnonymous) {
      return (
        <View style={styles.avatarPreviewSection}>
          <Avatar
            value={uid}
            size={componentSizes.avatar.xl}
            borderRadius={styles.avatar.borderRadius as number}
          />
          <Text style={styles.userName}>{displayName || '匿名用户'}</Text>

          {/* Teaser card */}
          <TouchableOpacity
            style={styles.avatarPreviewCard}
            onPress={onPickAvatar}
            activeOpacity={fixed.activeOpacity}
          >
            <View style={styles.avatarPreviewRow}>
              {PREVIEW_STRIP_INDICES.map((avatarIdx) => (
                <Image
                  key={avatarIdx}
                  source={getAvatarImageByIndex(avatarIdx) as ImageSourcePropType}
                  style={styles.avatarPreviewItem}
                  resizeMode="cover"
                />
              ))}
              <View style={styles.avatarPreviewLockBadge}>
                <Ionicons
                  name="lock-closed"
                  size={componentSizes.icon.sm}
                  color={colors.textSecondary}
                />
              </View>
            </View>
            <Text style={styles.avatarPreviewDesc}>
              {`绑定邮箱，解锁 ${AVATAR_IMAGES.length} 款暗黑头像和自定义昵称`}
            </Text>
            <Text style={styles.avatarPreviewCta}>浏览全部头像 ›</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // No custom avatar: show default lucide avatar with edit badge
    if (!avatarSource) {
      return (
        <TouchableOpacity onPress={onPickAvatar} activeOpacity={fixed.activeOpacity}>
          <View>
            <Avatar
              value={uid}
              size={componentSizes.avatar.xl}
              borderRadius={styles.avatar.borderRadius as number}
            />
            <View style={styles.avatarEditBadge}>
              <Ionicons
                name={UI_ICONS.CAMERA}
                size={componentSizes.icon.sm}
                color={colors.textSecondary}
              />
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        onPress={onPickAvatar}
        activeOpacity={uploadingAvatar ? 1 : fixed.activeOpacity}
        accessibilityState={{ disabled: uploadingAvatar }}
      >
        {uploadingAvatar ? (
          <View style={styles.avatarPlaceholder}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <View>
            {isRemote ? (
              <ExpoImage
                source={avatarSource}
                style={styles.avatar}
                contentFit="cover"
                transition={200}
                cachePolicy="disk"
              />
            ) : (
              <Image source={avatarSource} style={styles.avatar} resizeMode="cover" />
            )}
            <View style={styles.avatarEditBadge}>
              <Ionicons
                name={UI_ICONS.CAMERA}
                size={componentSizes.icon.sm}
                color={colors.textSecondary}
              />
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  },
);

AvatarSection.displayName = 'AvatarSection';
