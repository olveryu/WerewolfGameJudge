/**
 * AvatarSection - 头像显示/编辑组件（Memoized）
 *
 * 显示当前头像 + 上传按钮，通过回调上报操作意图。
 *
 * ✅ 允许：渲染 UI + 上报用户 intent
 * ❌ 禁止：import service / 业务逻辑判断
 */
import React, { memo } from 'react';
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

export interface AvatarSectionProps {
  isAnonymous: boolean;
  avatarSource: ImageSourcePropType;
  uploadingAvatar: boolean;
  onPickAvatar: () => void;
  styles: SettingsScreenStyles;
  colors: ThemeColors;
}

const arePropsEqual = (prev: AvatarSectionProps, next: AvatarSectionProps): boolean => {
  return (
    prev.isAnonymous === next.isAnonymous &&
    prev.uploadingAvatar === next.uploadingAvatar &&
    prev.styles === next.styles &&
    // Compare avatarSource (uri objects or require'd images)
    JSON.stringify(prev.avatarSource) === JSON.stringify(next.avatarSource)
  );
};

export const AvatarSection = memo<AvatarSectionProps>(
  ({ isAnonymous, avatarSource, uploadingAvatar, onPickAvatar, styles, colors }) => {
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
            <Image source={avatarSource} style={styles.avatar} resizeMode="cover" />
            <View style={styles.avatarEditBadge}>
              <Text style={styles.avatarEditIcon}>📷</Text>
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  },
  arePropsEqual,
);

AvatarSection.displayName = 'AvatarSection';
