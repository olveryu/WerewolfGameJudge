import Ionicons from '@expo/vector-icons/Ionicons';
import type { SeatAnimationId } from '@werewolf/game-engine/growth/rewardCatalog';
import { memo, useCallback } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { RarityCellBg } from '@/components/RarityCellBg';
import { getSeatAnimationById } from '@/components/seatAnimations';
import { LoopingSeatAnimation } from '@/components/seatAnimations/LoopingSeatAnimation';
import {
  getRarityCellConfig,
  getRarityCellStyle,
  getRaritySelectedStyle,
} from '@/config/rarityVisual';
import { borderRadius as borderRadiusToken, colors, componentSizes, fixed } from '@/theme';

import type { SeatAnimationGridItem } from '../types';
import { FRAME_GRID_CELL_SIZE } from '../types';
import type { AppearanceScreenStyles } from './styles';

const AVATAR_PREVIEW_SIZE = FRAME_GRID_CELL_SIZE * 0.55;

interface SeatAnimationCellProps {
  item: SeatAnimationGridItem;
  selectedSeatAnimation: SeatAnimationId | 'none' | null;
  previewAvatarUrl: string | null | undefined;
  userId: string;
  onPress: (id: SeatAnimationId | 'none') => void;
  styles: AppearanceScreenStyles;
}

export const SeatAnimationCell = memo<SeatAnimationCellProps>(
  ({ item, selectedSeatAnimation, previewAvatarUrl, userId, onPress, styles }) => {
    const handlePress = useCallback(() => onPress(item.id), [onPress, item.id]);
    const isSelected = selectedSeatAnimation === item.id;
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
          !isSelected &&
            item.isActive &&
            selectedSeatAnimation === null &&
            styles.frameGridCellActive,
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
          <AnimPreview id={item.id} previewAvatarUrl={previewAvatarUrl} userId={userId} />
        )}
        <Text style={[styles.frameGridName, isSelected && styles.frameGridNameSelected]}>
          {item.unlocked ? item.name : '???'}
        </Text>
      </TouchableOpacity>
    );
  },
);

SeatAnimationCell.displayName = 'SeatAnimationCell';

const AnimPreview = memo<{
  id: SeatAnimationId;
  previewAvatarUrl: string | null | undefined;
  userId: string;
}>(({ id, previewAvatarUrl, userId }) => {
  const anim = getSeatAnimationById(id);
  if (!anim) return null;
  return (
    <View style={localStyles.animPreviewCell}>
      <LoopingSeatAnimation
        Component={anim.Component}
        size={FRAME_GRID_CELL_SIZE}
        borderRadius={borderRadiusToken.medium}
      >
        <View style={localStyles.avatarWrap}>
          <Avatar
            value={userId}
            avatarUrl={previewAvatarUrl}
            size={AVATAR_PREVIEW_SIZE}
            borderRadius={AVATAR_PREVIEW_SIZE / 2}
          />
        </View>
      </LoopingSeatAnimation>
    </View>
  );
});

AnimPreview.displayName = 'AnimPreview';

const localStyles = StyleSheet.create({
  animPreviewCell: {
    width: FRAME_GRID_CELL_SIZE,
    height: FRAME_GRID_CELL_SIZE,
    overflow: 'hidden',
  },
  avatarWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
