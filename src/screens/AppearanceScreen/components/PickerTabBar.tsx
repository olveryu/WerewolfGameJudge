import type React from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

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

function handleKeyDown(event: React.KeyboardEvent<HTMLElement>) {
  const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]'));
  const currentIndex = tabs.findIndex((tab) => tab === event.target);
  if (currentIndex === -1) return;
  let nextIndex: number;
  switch (event.key) {
    case 'ArrowRight':
      nextIndex = (currentIndex + 1) % tabs.length;
      break;
    case 'ArrowLeft':
      nextIndex = (currentIndex + tabs.length - 1) % tabs.length;
      break;
    case 'Home':
      nextIndex = 0;
      break;
    case 'End':
      nextIndex = tabs.length - 1;
      break;
    default:
      return;
  }
  event.preventDefault();
  tabs[nextIndex]!.focus();
  tabs[nextIndex]!.click();
}

/** Appearance picker tab bar. */
export const PickerTabBar: React.FC<PickerTabBarProps> = ({ activeTab, onTabChange, styles }) => (
  <View
    style={styles.pickerTabBar}
    accessibilityRole="tablist"
    accessibilityLabel="外观分类"
    {...(Platform.OS === 'web' ? { onKeyDown: handleKeyDown } : {})}
  >
    {TABS.map((tab) => {
      const isActive = activeTab === tab.key;
      return (
        <Pressable
          key={tab.key}
          nativeID={`appearance-tab-${tab.key}`}
          accessibilityRole="tab"
          accessibilityLabel={tab.label}
          accessibilityState={{ selected: isActive }}
          aria-selected={isActive}
          tabIndex={isActive ? 0 : -1}
          aria-controls="appearance-picker-panel"
          style={[styles.pickerTab, isActive && styles.pickerTabActive]}
          onPress={() => onTabChange(tab.key)}
        >
          <Text style={[styles.pickerTabText, isActive && styles.pickerTabTextActive]}>
            {tab.label}
          </Text>
          {isActive && <View style={styles.pickerTabIndicator} />}
        </Pressable>
      );
    })}
  </View>
);
