/**
 * AvatarSection - Memoized avatar display/edit component
 *
 * Performance: Receives pre-created styles from parent.
 */
import React, { memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  ImageSourcePropType,
} from 'react-native';
import { ThemeColors } from '../../../theme';
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
