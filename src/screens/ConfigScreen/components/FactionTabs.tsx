/**
 * FactionTabs - 阵营分段标签栏（Memoized）
 *
 * 显示阵营 icon + 标题 + 计数角标，选中态带色下划线。
 * 渲染 UI 并通过回调上报 onTabChange，不 import service，不包含业务逻辑判断。
 */
import { memo, type ReactNode, useCallback } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { TESTIDS } from '@/testids';

import { ConfigScreenStyles } from './styles';

export interface FactionTabItem {
  key: string;
  icon: ReactNode;
  title: string;
  count: number;
  accentColor: string;
}

export interface FactionTabsProps {
  tabs: FactionTabItem[];
  activeKey: string;
  onTabPress: (key: string) => void;
  styles: ConfigScreenStyles;
}

export const FactionTabs = memo<FactionTabsProps>(({ tabs, activeKey, onTabPress, styles }) => {
  return (
    <View style={styles.tabBar}>
      {tabs.map((tab) => {
        const isActive = tab.key === activeKey;
        return (
          <FactionTab
            key={tab.key}
            tab={tab}
            isActive={isActive}
            onPress={onTabPress}
            styles={styles}
          />
        );
      })}
    </View>
  );
});

FactionTabs.displayName = 'FactionTabs';

// ── Individual Tab (internal) ──────────────────

interface FactionTabProps {
  tab: FactionTabItem;
  isActive: boolean;
  onPress: (key: string) => void;
  styles: ConfigScreenStyles;
}

const FactionTab = memo<FactionTabProps>(({ tab, isActive, onPress, styles }) => {
  const handlePress = useCallback(() => onPress(tab.key), [tab.key, onPress]);

  return (
    <TouchableOpacity
      testID={TESTIDS.configFactionTab(tab.key)}
      style={[styles.tab, isActive && styles.tabActive]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <Text style={[styles.tabLabel, { color: tab.accentColor }]}>
        {tab.icon} {tab.title}
      </Text>
      <View style={[styles.tabBadge, { backgroundColor: tab.accentColor + '20' }]}>
        <Text style={[styles.tabBadgeText, { color: tab.accentColor }]}>{tab.count}</Text>
      </View>
      {isActive && <View style={[styles.tabIndicator, { backgroundColor: tab.accentColor }]} />}
    </TouchableOpacity>
  );
});

FactionTab.displayName = 'FactionTab';
