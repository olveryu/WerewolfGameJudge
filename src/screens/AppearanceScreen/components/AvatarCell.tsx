import Ionicons from '@expo/vector-icons/Ionicons';
import type { Rarity } from '@werewolf/game-engine/growth/rewardCatalog';
import { memo, useCallback, useMemo } from 'react';
import { Image, type ImageSourcePropType, TouchableOpacity, View } from 'react-native';

import { GeneratedAvatar, isGeneratedAvatar } from '@/components/GeneratedAvatar';
import { RarityCellBg } from '@/components/RarityCellBg';
import { getRarityCellStyle, getRaritySelectedStyle } from '@/config/rarityVisual';
import { borderRadius as borderRadiusToken, colors, componentSizes, fixed } from '@/theme';
import { getHandDrawnThumb } from '@/utils/avatar';

import type { AppearanceScreenStyles } from './styles';

interface AvatarCellProps {
  avatarId: string;
  isSelected: boolean;
  isCurrentlyUsed: boolean;
  locked: boolean;
  rarity: Rarity | null;
  onPress: (avatarId: string) => void;
  onLongPress: (avatarId: string) => void;
  styles: AppearanceScreenStyles;
}

export const AvatarCell = memo<AvatarCellProps>(
  ({ avatarId, isSelected, isCurrentlyUsed, locked, rarity, onPress, onLongPress, styles }) => {
    const handlePress = useCallback(() => {
      onPress(avatarId);
    }, [onPress, avatarId]);

    const handleLongPress = useCallback(() => {
      onLongPress(avatarId);
    }, [onLongPress, avatarId]);

    const rarityCellStyle = getRarityCellStyle(rarity);

    const imageSource = useMemo(
      () => (isGeneratedAvatar(avatarId) ? null : getHandDrawnThumb(avatarId)),
      [avatarId],
    );

    return (
      <TouchableOpacity
        style={[
          styles.pickerItem,
          rarityCellStyle,
          isSelected && getRaritySelectedStyle(rarity),
          locked && styles.pickerItemLocked,
        ]}
        onPress={handlePress}
        onLongPress={handleLongPress}
        activeOpacity={0.7}
      >
        <RarityCellBg
          rarity={rarity}
          borderRadius={borderRadiusToken.medium - fixed.borderWidthThick}
        />
        {imageSource != null ? (
          <Image
            source={imageSource as ImageSourcePropType}
            style={styles.pickerItemImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.pickerItemGeneratedAvatar}>
            <GeneratedAvatar seed={avatarId} size={componentSizes.avatar.xl} />
          </View>
        )}
        {locked && (
          <View style={styles.pickerItemLockOverlay}>
            <Ionicons name="lock-closed" size={componentSizes.icon.sm} color={colors.textMuted} />
          </View>
        )}
        {isCurrentlyUsed && !isSelected && !locked && (
          <View style={styles.pickerCheckBadge}>
            <Ionicons name="checkmark" size={componentSizes.icon.xs} color={colors.textInverse} />
          </View>
        )}
      </TouchableOpacity>
    );
  },
);

AvatarCell.displayName = 'AvatarCell';
