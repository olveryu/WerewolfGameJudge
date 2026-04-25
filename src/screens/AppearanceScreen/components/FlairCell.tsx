import Ionicons from '@expo/vector-icons/Ionicons';
import { memo, useCallback } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { AvatarWithFrame } from '@/components/AvatarWithFrame';
import { RarityCellBg } from '@/components/RarityCellBg';
import { type FlairId, getFlairById } from '@/components/seatFlairs';
import {
  getRarityCellConfig,
  getRarityCellStyle,
  getRaritySelectedStyle,
} from '@/config/rarityVisual';
import { borderRadius as borderRadiusToken, colors, componentSizes, fixed } from '@/theme';

import type { FlairGridItem } from '../types';
import { FRAME_GRID_CELL_SIZE } from '../types';
import type { AppearanceScreenStyles } from './styles';

interface FlairCellProps {
  item: FlairGridItem;
  selectedFlair: FlairId | 'none' | null;
  previewAvatarUrl: string | null | undefined;
  userId: string;
  onPress: (id: FlairId | 'none') => void;
  styles: AppearanceScreenStyles;
}

export const FlairCell = memo<FlairCellProps>(
  ({ item, selectedFlair, previewAvatarUrl, userId, onPress, styles }) => {
    const handlePress = useCallback(() => onPress(item.id), [onPress, item.id]);
    const isSelected = selectedFlair === item.id;
    const FlairComponent = item.id !== 'none' ? getFlairById(item.id)?.Component : undefined;
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
          !isSelected && item.isActive && selectedFlair === null && styles.frameGridCellActive,
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
              styles.flairPreviewCell,
              { width: FRAME_GRID_CELL_SIZE, height: FRAME_GRID_CELL_SIZE },
            ]}
          >
            {FlairComponent && (
              <FlairComponent size={FRAME_GRID_CELL_SIZE} borderRadius={borderRadiusToken.medium} />
            )}
            <AvatarWithFrame
              value={userId}
              size={FRAME_GRID_CELL_SIZE - 8}
              avatarUrl={previewAvatarUrl}
            />
          </View>
        )}
        <Text style={[styles.frameGridName, isSelected && styles.frameGridNameSelected]}>
          {item.unlocked ? item.name : '???'}
        </Text>
      </TouchableOpacity>
    );
  },
);

FlairCell.displayName = 'FlairCell';
