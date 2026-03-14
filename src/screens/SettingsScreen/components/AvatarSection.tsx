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
  TouchableOpacity,
  View,
} from 'react-native';

import { Avatar } from '@/components/Avatar';
import { UI_ICONS } from '@/config/iconTokens';
import { componentSizes, fixed, ThemeColors } from '@/theme';

import { SettingsScreenStyles } from './styles';

interface AvatarSectionProps {
  isAnonymous: boolean;
  uid: string;
  avatarSource: ImageSourcePropType | null;
  /** Whether the avatar source is a remote URL (use expo-image) */
  isRemote?: boolean;
  uploadingAvatar: boolean;
  onPickAvatar: () => void;
  styles: SettingsScreenStyles;
  colors: ThemeColors;
}

export const AvatarSection = memo<AvatarSectionProps>(
  ({ isAnonymous, uid, avatarSource, isRemote, uploadingAvatar, onPickAvatar, styles, colors }) => {
    // Anonymous users: show default lucide avatar, no edit
    if (isAnonymous) {
      return (
        <Avatar
          value={uid}
          size={componentSizes.avatar.xl}
          borderRadius={styles.avatar.borderRadius as number}
        />
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
