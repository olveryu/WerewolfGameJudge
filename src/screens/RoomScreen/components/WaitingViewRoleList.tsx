/**
 * WaitingViewRoleList.tsx - Shows players who haven't viewed their roles
 *
 * Performance: Memoized with arePropsEqual, receives pre-created styles from parent.
 *
 * ❌ Do NOT import: any Service singletons, showAlert
 * ✅ Allowed: types, styles, UI components
 */
import React, { memo } from 'react';
import { View, Text } from 'react-native';
import { type WaitingViewRoleListStyles } from './styles';

export interface WaitingViewRoleListProps {
  /** Seat numbers (0-indexed) of players who haven't viewed roles */
  seatIndices: number[];
  /** Pre-created styles from parent */
  styles: WaitingViewRoleListStyles;
}

function arePropsEqual(prev: WaitingViewRoleListProps, next: WaitingViewRoleListProps): boolean {
  // seatIndices is an array — compare by length + reference (parent should stabilize via useMemo)
  return prev.seatIndices === next.seatIndices && prev.styles === next.styles;
}

const WaitingViewRoleListComponent: React.FC<WaitingViewRoleListProps> = ({
  seatIndices,
  styles,
}) => {
  if (seatIndices.length === 0) {
    return null;
  }

  // Convert 0-indexed to 1-indexed for display
  const seatNumbers = seatIndices.map((s) => `${s + 1}号`).join(', ');

  return (
    <View style={styles.actionLogContainer}>
      <Text style={styles.actionLogTitle}>⏳ 等待查看身份</Text>
      <Text style={styles.actionLogItem}>{seatNumbers}</Text>
    </View>
  );
};

export const WaitingViewRoleList = memo(WaitingViewRoleListComponent, arePropsEqual);

WaitingViewRoleList.displayName = 'WaitingViewRoleList';
