/**
 * AvatarSection - avatar display/edit component (Memoized).
 *
 * Displays the current avatar plus an edit badge and reports action intent via callbacks.
 * Anonymous users additionally see an upgrade-prompt teaser card.
 * Renders UI and reports user intent; does not import services or contain business logic.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { memo } from 'react';
import {
  ActivityIndicator,
  Image,
  type ImageSourcePropType,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { Avatar } from '@/components/Avatar';
import { AvatarWithFrame } from '@/components/AvatarWithFrame';
import { getFlairById } from '@/components/seatFlairs';
import { UI_ICONS } from '@/config/iconTokens';
import { colors, componentSizes, fixed, type ThemeColors } from '@/theme';
import { AVATAR_IMAGES, getAvatarThumbByIndex } from '@/utils/avatar';

import { type SettingsScreenStyles } from './styles';

/** Number of avatars shown in the anonymous-user preview strip. */
const PREVIEW_STRIP_COUNT = 4;

/** Evenly-spaced indices into AVATAR_IMAGES for the preview strip. */
const PREVIEW_STRIP_INDICES: number[] = (() => {
  const step = Math.floor(AVATAR_IMAGES.length / PREVIEW_STRIP_COUNT);
  return Array.from({ length: PREVIEW_STRIP_COUNT }, (_, i) => i * step);
})();

interface AvatarSectionProps {
  isAnonymous: boolean;
  userId: string;
  avatarSource: ImageSourcePropType | null;
  /** Current avatarUrl string for AvatarWithFrame rendering */
  avatarUrl?: string | null;
  /** Current avatar frame ID */
  avatarFrame?: string | null;
  /** Current seat flair ID */
  seatFlair?: string | null;
  uploadingAvatar: boolean;
  displayName: string | null;
  onPickAvatar: () => void;
  styles: SettingsScreenStyles;
  colors: ThemeColors;
}

/** Avatar display area. */
export const AvatarSection = memo<AvatarSectionProps>(
  ({
    isAnonymous,
    userId,
    avatarSource,
    avatarUrl,
    avatarFrame,
    seatFlair,
    uploadingAvatar,
    displayName,
    onPickAvatar,
    styles,
  }) => {
    // Anonymous users: show avatar + name, then a teaser card to upgrade
    if (isAnonymous) {
      return (
        <View style={styles.avatarPreviewSection}>
          <Avatar
            value={userId}
            size={componentSizes.avatar.xl}
            borderRadius={styles.avatar.borderRadius as number}
          />
          <Text style={styles.userName}>{displayName || '匿名用户'}</Text>

          {/* Teaser card */}
          <View style={styles.avatarPreviewCard}>
            <View style={styles.avatarPreviewRow}>
              {PREVIEW_STRIP_INDICES.map((avatarIdx) => (
                <Image
                  key={avatarIdx}
                  source={getAvatarThumbByIndex(avatarIdx) as ImageSourcePropType}
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
              {`绑定邮箱，解锁 ${AVATAR_IMAGES.length} 款暗黑头像、自定义昵称和头像框`}
            </Text>
            <TouchableOpacity onPress={onPickAvatar} activeOpacity={fixed.activeOpacity}>
              <Text style={styles.avatarPreviewCta}>浏览全部头像 ›</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // ── Registered user: clickable avatar with edit badge ──

    if (uploadingAvatar) {
      return (
        <View style={styles.avatarPlaceholder}>
          <ActivityIndicator color={colors.primary} />
        </View>
      );
    }

    const flairConfig = seatFlair ? getFlairById(seatFlair) : undefined;
    const FlairComp = flairConfig?.Component;
    const avatarSize = componentSizes.avatar.xl;

    const avatarContent = avatarSource ? (
      <AvatarWithFrame
        value={userId}
        size={avatarSize}
        avatarUrl={avatarUrl}
        borderRadius={styles.avatar.borderRadius as number}
        frameId={avatarFrame}
      />
    ) : (
      <AvatarWithFrame
        value={userId}
        size={avatarSize}
        borderRadius={styles.avatar.borderRadius as number}
        frameId={avatarFrame}
      />
    );

    return (
      <TouchableOpacity onPress={onPickAvatar} activeOpacity={fixed.activeOpacity}>
        <View>
          {avatarContent}
          {FlairComp && (
            <FlairComp size={avatarSize} borderRadius={styles.avatar.borderRadius as number} />
          )}
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
  },
);

AvatarSection.displayName = 'AvatarSection';
