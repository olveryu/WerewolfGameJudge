import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Text, View } from 'react-native';

import { AvatarWithFrame } from '@/components/AvatarWithFrame';
import { Button } from '@/components/Button';
import { NameStyleText } from '@/components/nameStyles';
import { getFlairById } from '@/components/seatFlairs';
import { UI_ICONS } from '@/config/iconTokens';
import { colors, componentSizes } from '@/theme';

import { HERO_PREVIEW_SIZE } from '../types';
import type { AppearanceScreenStyles } from './styles';

interface HeroPreviewProps {
  userId: string;
  displayName: string;
  previewAvatarUrl: string | null | undefined;
  effectiveFrame: string | null;
  frameLabel: string;
  effectiveFlair: string | null | undefined;
  effectiveNameStyle: string | null | undefined;
  readOnly: boolean;
  hasCustomAvatar: boolean;
  onUpload: () => void;
  styles: AppearanceScreenStyles;
}

export const HeroPreview: React.FC<HeroPreviewProps> = ({
  userId,
  displayName,
  previewAvatarUrl,
  effectiveFrame,
  frameLabel,
  effectiveFlair,
  effectiveNameStyle,
  readOnly,
  hasCustomAvatar,
  onUpload,
  styles,
}) => {
  const flairConfig = effectiveFlair ? getFlairById(effectiveFlair) : null;
  const FlairComp = flairConfig?.Component;

  return (
    <View style={styles.heroPreview}>
      <View style={styles.heroPreviewLeft}>
        <View>
          <AvatarWithFrame
            value={userId}
            size={HERO_PREVIEW_SIZE}
            avatarUrl={previewAvatarUrl}
            frameId={effectiveFrame}
          />
          {FlairComp && <FlairComp size={HERO_PREVIEW_SIZE} borderRadius={HERO_PREVIEW_SIZE / 2} />}
        </View>
        <NameStyleText styleId={effectiveNameStyle} style={styles.nameStyleHeroName}>
          {displayName}
        </NameStyleText>
      </View>
      <View style={styles.heroPreviewRight}>
        <Text style={styles.heroFrameLabel}>当前框：{frameLabel}</Text>
        {!readOnly && (
          <Button
            variant="secondary"
            size="sm"
            icon={
              <Ionicons
                name={UI_ICONS.CAMERA}
                size={componentSizes.icon.sm}
                color={colors.primary}
              />
            }
            onPress={onUpload}
            textColor={colors.primary}
            style={styles.heroUploadBtn}
          >
            {hasCustomAvatar ? '更换自定义' : '上传自定义'}
          </Button>
        )}
        {readOnly && (
          <Text style={[styles.heroFrameLabel, { color: colors.textMuted }]}>绑定后可上传</Text>
        )}
      </View>
    </View>
  );
};
