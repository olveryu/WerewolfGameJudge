/**
 * RarityCellBg — rarity background gradient overlay
 *
 * Rendered as the first child of a grid cell (absolute positioning), top-to-bottom
 * gradient using the rarity theme color. Common rarity is not rendered.
 * Shared by AppearanceScreen / UnlocksScreen grid cells.
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
    <View style={[styles.container, { borderRadius }]}>
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
    pointerEvents: 'none',
  },
});
