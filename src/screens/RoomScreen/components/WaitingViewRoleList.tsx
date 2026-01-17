/**
 * WaitingViewRoleList.tsx - Shows players who haven't viewed their roles
 *
 * Uses the real styles from RoomScreen.styles.ts
 */

import React from 'react';
import { View, Text } from 'react-native';
import { styles } from '../RoomScreen.styles';

export interface WaitingViewRoleListProps {
  /** Seat numbers (0-indexed) of players who haven't viewed roles */
  seatIndices: number[];
}

export const WaitingViewRoleList: React.FC<WaitingViewRoleListProps> = ({ seatIndices }) => {
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

export default WaitingViewRoleList;
