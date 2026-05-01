import type React from 'react';
import { Pressable, Text, View } from 'react-native';

import { RARITY_ORDER, RARITY_VISUAL } from '@/config/rarityVisual';
import { colors, withAlpha } from '@/theme';

import type { RarityFilter } from '../types';
import type { AppearanceScreenStyles } from './styles';

const FILTER_TABS: { key: RarityFilter; label: string }[] = [
  { key: 'all', label: '全部' },
  ...RARITY_ORDER.map((r) => ({ key: r as RarityFilter, label: RARITY_VISUAL[r].label })),
];

interface RarityFilterBarProps {
  rarityFilter: RarityFilter;
  onFilterChange: (filter: RarityFilter) => void;
  styles: AppearanceScreenStyles;
}

export const RarityFilterBar: React.FC<RarityFilterBarProps> = ({
  rarityFilter,
  onFilterChange,
  styles,
}) => (
  <View style={styles.rarityTabBar}>
    {FILTER_TABS.map((rt) => {
      const isActive = rt.key === rarityFilter;
      const visual = rt.key !== 'all' ? RARITY_VISUAL[rt.key] : null;
      const activeColor = visual?.color ?? colors.primary;
      const activeShadow = visual?.chipShadow ?? `0px 2px 8px ${withAlpha(colors.primary, 0.3)}`;
      return (
        <Pressable
          key={rt.key}
          style={[
            styles.rarityTab,
            isActive && {
              backgroundColor: activeColor,
              boxShadow: activeShadow,
            },
          ]}
          onPress={() => onFilterChange(rt.key)}
        >
          <Text style={[styles.rarityTabText, isActive && styles.rarityTabTextActive]}>
            {rt.label}
          </Text>
        </Pressable>
      );
    })}
  </View>
);
