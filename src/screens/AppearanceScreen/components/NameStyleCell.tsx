import Ionicons from '@expo/vector-icons/Ionicons';
import type { NameStyleId } from '@werewolf/game-engine/growth/rewardCatalog';
import { memo, useCallback } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { NameStyleText } from '@/components/nameStyles';
import { RarityCellBg } from '@/components/RarityCellBg';
import {
  getRarityCellConfig,
  getRarityCellStyle,
  getRaritySelectedStyle,
} from '@/config/rarityVisual';
import { borderRadius as borderRadiusToken, colors, componentSizes, fixed } from '@/theme';

import type { NameStyleGridItem } from '../types';
import { FRAME_GRID_CELL_SIZE } from '../types';
import type { AppearanceScreenStyles } from './styles';

interface NameStyleCellProps {
  item: NameStyleGridItem;
  selectedNameStyle: NameStyleId | 'none' | null;
  onPress: (id: NameStyleId | 'none') => void;
  styles: AppearanceScreenStyles;
}

export const NameStyleCell = memo<NameStyleCellProps>(
  ({ item, selectedNameStyle, onPress, styles }) => {
    const handlePress = useCallback(() => onPress(item.id), [onPress, item.id]);
    const isSelected = selectedNameStyle === item.id;
    const rarityCfg = item.id !== 'none' ? getRarityCellConfig(item.rarity) : null;
    const rarityCellStyle = item.id !== 'none' ? getRarityCellStyle(item.rarity) : null;
    const selectedStyle =
      item.id !== 'none' ? getRaritySelectedStyle(item.rarity) : styles.frameGridCellSelected;

    return (
      <TouchableOpacity
        style={[
          styles.frameGridCell,
          rarityCellStyle,
          isSelected && selectedStyle,
          !isSelected && item.isActive && selectedNameStyle === null && styles.frameGridCellActive,
          !item.unlocked && styles.frameGridCellLocked,
        ]}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        {rarityCfg && (
          <RarityCellBg
            rarity={item.rarity}
            borderRadius={borderRadiusToken.medium - fixed.borderWidthThick}
          />
        )}
        {item.id === 'none' ? (
          <View
            style={[
              styles.frameGridNoFrame,
              { width: FRAME_GRID_CELL_SIZE, height: FRAME_GRID_CELL_SIZE },
            ]}
          >
            <Ionicons
              name="close-circle-outline"
              size={componentSizes.icon.xl}
              color={colors.textMuted}
            />
          </View>
        ) : (
          <View
            style={[
              styles.nameStylePreviewCell,
              { width: FRAME_GRID_CELL_SIZE, height: FRAME_GRID_CELL_SIZE },
            ]}
          >
            <NameStyleText styleId={item.id} style={styles.nameStylePreviewText}>
              {item.name}
            </NameStyleText>
          </View>
        )}
        <Text style={[styles.frameGridName, isSelected && styles.frameGridNameSelected]}>
          {item.unlocked ? item.name : '???'}
        </Text>
      </TouchableOpacity>
    );
  },
);

NameStyleCell.displayName = 'NameStyleCell';
