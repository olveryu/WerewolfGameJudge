import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { fixed } from '@/theme';

import type { PickerTab } from '../types';
import type { AppearanceScreenStyles } from './styles';

const TABS: { key: PickerTab; label: string }[] = [
  { key: 'avatar', label: '头像' },
  { key: 'frame', label: '框' },
  { key: 'flair', label: '装饰' },
  { key: 'nameStyle', label: '名字' },
  { key: 'effect', label: '特效' },
  { key: 'seatAnimation', label: '入座' },
];

interface PickerTabBarProps {
  activeTab: PickerTab;
  onTabChange: (tab: PickerTab) => void;
  styles: AppearanceScreenStyles;
}

export const PickerTabBar: React.FC<PickerTabBarProps> = ({ activeTab, onTabChange, styles }) => (
  <View style={styles.pickerTabBar}>
    {TABS.map((tab) => {
      const isActive = activeTab === tab.key;
      return (
        <TouchableOpacity
          key={tab.key}
          style={[styles.pickerTab, isActive && styles.pickerTabActive]}
          onPress={() => onTabChange(tab.key)}
          activeOpacity={fixed.activeOpacity}
        >
          <Text style={[styles.pickerTabText, isActive && styles.pickerTabTextActive]}>
            {tab.label}
          </Text>
          {isActive && <View style={styles.pickerTabIndicator} />}
        </TouchableOpacity>
      );
    })}
  </View>
);
