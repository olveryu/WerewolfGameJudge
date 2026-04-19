/**
 * RarityCellBg — 稀有度底色渐变覆盖层
 *
 * 作为 grid cell 的第一个子元素（absolute 定位），从上至下渲染
 * 稀有度主题色渐变。Common 不渲染。
 * AvatarPickerScreen / UnlocksScreen 格子共用。
 */
import type { Rarity } from '@werewolf/game-engine/growth/rewardCatalog';
import { LinearGradient } from 'expo-linear-gradient';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { getRarityCellConfig } from '@/config/rarityVisual';

interface RarityCellBgProps {
  rarity: Rarity | null;
  borderRadius: number;
}

export const RarityCellBg = memo<RarityCellBgProps>(({ rarity, borderRadius }) => {
  const config = getRarityCellConfig(rarity);
  if (!config) return null;

  return (
    <View style={[styles.container, { borderRadius }]} pointerEvents="none">
      <LinearGradient
        colors={[...config.gradientColors]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
    </View>
  );
});

RarityCellBg.displayName = 'RarityCellBg';

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
});
