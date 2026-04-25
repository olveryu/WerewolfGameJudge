import Ionicons from '@expo/vector-icons/Ionicons';
import type { RoleRevealEffectId } from '@werewolf/game-engine/growth/rewardCatalog';
import React, { memo, useCallback } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { RarityCellBg } from '@/components/RarityCellBg';
import {
  getRarityCellConfig,
  getRarityCellStyle,
  getRaritySelectedStyle,
} from '@/config/rarityVisual';
import { borderRadius as borderRadiusToken, colors, componentSizes, fixed } from '@/theme';

import type { EffectGridItem } from '../types';
import { FRAME_GRID_CELL_SIZE } from '../types';
import type { AppearanceScreenStyles } from './styles';

interface EffectCellProps {
  item: EffectGridItem;
  selectedEffect: RoleRevealEffectId | 'none' | 'random' | null;
  onPress: (id: RoleRevealEffectId | 'none' | 'random') => void;
  styles: AppearanceScreenStyles;
}

export const EffectCell = memo<EffectCellProps>(({ item, selectedEffect, onPress, styles }) => {
  const handlePress = useCallback(() => onPress(item.id), [onPress, item.id]);
  const isSelected = selectedEffect === item.id;
  const isSentinel = item.id === 'none' || item.id === 'random';
  const rarityCfg = !isSentinel ? getRarityCellConfig(item.rarity) : null;
  const rarityCellStyle = !isSentinel ? getRarityCellStyle(item.rarity) : null;
  const selectedStyle = !isSentinel
    ? getRaritySelectedStyle(item.rarity)
    : styles.frameGridCellSelected;

  return (
    <TouchableOpacity
      style={[
        styles.frameGridCell,
        rarityCellStyle,
        isSelected && selectedStyle,
        !isSelected && item.isActive && selectedEffect === null && styles.frameGridCellActive,
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
      <View
        style={[
          styles.effectPreviewCell,
          { width: FRAME_GRID_CELL_SIZE, height: FRAME_GRID_CELL_SIZE },
        ]}
      >
        <Ionicons
          name={item.icon as React.ComponentProps<typeof Ionicons>['name']}
          size={componentSizes.icon.xl}
          color={item.unlocked ? colors.text : colors.textMuted}
        />
      </View>
      <Text style={[styles.frameGridName, isSelected && styles.frameGridNameSelected]}>
        {item.unlocked ? item.name : '???'}
      </Text>
    </TouchableOpacity>
  );
});

EffectCell.displayName = 'EffectCell';
