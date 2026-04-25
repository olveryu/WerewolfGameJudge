import Ionicons from '@expo/vector-icons/Ionicons';
import type { Rarity } from '@werewolf/game-engine/growth/rewardCatalog';
import { memo, useCallback } from 'react';
import { Image, ImageSourcePropType, TouchableOpacity, View } from 'react-native';

import { RarityCellBg } from '@/components/RarityCellBg';
import { getRarityCellStyle, getRaritySelectedStyle } from '@/config/rarityVisual';
import { borderRadius as borderRadiusToken, colors, componentSizes, fixed } from '@/theme';

import type { AppearanceScreenStyles } from './styles';

interface AvatarCellProps {
  index: number;
  imageSource: number;
  isSelected: boolean;
  isCurrentlyUsed: boolean;
  locked: boolean;
  rarity: Rarity | null;
  onPress: (index: number) => void;
  onLongPress: (index: number) => void;
  styles: AppearanceScreenStyles;
}

export const AvatarCell = memo<AvatarCellProps>(
  ({
    index,
    imageSource,
    isSelected,
    isCurrentlyUsed,
    locked,
    rarity,
    onPress,
    onLongPress,
    styles,
  }) => {
    const handlePress = useCallback(() => {
      onPress(index);
    }, [onPress, index]);

    const handleLongPress = useCallback(() => {
      onLongPress(index);
    }, [onLongPress, index]);

    const rarityCellStyle = getRarityCellStyle(rarity);

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
        <Image
          source={imageSource as ImageSourcePropType}
          style={styles.pickerItemImage}
          resizeMode="cover"
        />
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
