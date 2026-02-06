/**
 * FactionPanel - Collapsible faction panel with colored header
 *
 * Shows faction emoji + title + count badge in header.
 * Tapping header toggles collapse. Content rendered only when expanded.
 *
 * Performance: Memoized, receives pre-created styles from parent.
 */
import React, { memo, useCallback } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { ConfigScreenStyles } from './styles';

export interface FactionPanelProps {
  factionKey: string;
  emoji: string;
  title: string;
  count: number;
  accentColor: string;
  expanded: boolean;
  onToggleExpand: (factionKey: string) => void;
  children: React.ReactNode;
  styles: ConfigScreenStyles;
}

const arePropsEqual = (prev: FactionPanelProps, next: FactionPanelProps): boolean => {
  return (
    prev.factionKey === next.factionKey &&
    prev.count === next.count &&
    prev.accentColor === next.accentColor &&
    prev.expanded === next.expanded &&
    prev.styles === next.styles &&
    // children will change when selection changes, so we skip deep compare
    // and rely on expanded flag to avoid unnecessary renders when collapsed
    (!prev.expanded && !next.expanded ? true : prev.children === next.children)
  );
};

export const FactionPanel = memo<FactionPanelProps>(
  ({ factionKey, emoji, title, count, accentColor, expanded, onToggleExpand, children, styles }) => {
    const handlePress = useCallback(
      () => onToggleExpand(factionKey),
      [factionKey, onToggleExpand],
    );

    return (
      <View style={styles.factionPanel}>
        <TouchableOpacity
          testID={`config-faction-header-${factionKey}`}
          style={styles.factionHeader}
          onPress={handlePress}
          activeOpacity={0.7}
        >
          <View style={styles.factionHeaderLeft}>
            <Text style={styles.factionChevron}>{expanded ? '▾' : '▸'}</Text>
            <Text style={[styles.factionTitle, { color: accentColor }]}>
              {emoji} {title}
            </Text>
          </View>
          <View style={[styles.factionBadge, { backgroundColor: accentColor + '20' }]}>
            <Text style={[styles.factionBadgeText, { color: accentColor }]}>
              ×{count}
            </Text>
          </View>
        </TouchableOpacity>

        {expanded && <View style={styles.factionContent}>{children}</View>}
      </View>
    );
  },
  arePropsEqual,
);

FactionPanel.displayName = 'FactionPanel';
