/**
 * AvatarSection - 头像显示/编辑组件（Memoized）
 *
 * 显示当前头像 + 上传按钮，通过回调上报操作意图。
 * 渲染 UI 并上报用户 intent，不 import service，不包含业务逻辑判断。
 */
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

import { ThemeColors } from '@/theme';

import { SettingsScreenStyles } from './styles';

interface AvatarSectionProps {
  isAnonymous: boolean;
  avatarSource: ImageSourcePropType;
  /** Whether the avatar source is a remote URL (use expo-image) */
  isRemote?: boolean;
  uploadingAvatar: boolean;
  onPickAvatar: () => void;
  styles: SettingsScreenStyles;
  colors: ThemeColors;
}

export const AvatarSection = memo<AvatarSectionProps>(
  ({ isAnonymous, avatarSource, isRemote, uploadingAvatar, onPickAvatar, styles, colors }) => {
    if (isAnonymous) {
      return (
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarPlaceholderIcon}>👤</Text>
        </View>
      );
    }

    return (
      <TouchableOpacity
        onPress={onPickAvatar}
        activeOpacity={uploadingAvatar ? 1 : 0.7}
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
              <Text style={styles.avatarEditIcon}>📷</Text>
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  },
);

AvatarSection.displayName = 'AvatarSection';
