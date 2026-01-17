/**
 * BoardInfoCard.tsx - Game board configuration display
 *
 * Uses the real styles from RoomScreen.styles.ts
 */

import React from 'react';
import { View, Text } from 'react-native';
import { styles } from '../RoomScreen.styles';

export interface BoardInfoCardProps {
  /** Total number of players */
  playerCount: number;
  /** Wolf roles formatted string (e.g., "狼人x2, 狼王x1") */
  wolfRolesText: string;
  /** God roles formatted string */
  godRolesText: string;
  /** Special roles formatted string (optional) */
  specialRolesText?: string;
  /** Number of villagers */
  villagerCount: number;
}

export const BoardInfoCard: React.FC<BoardInfoCardProps> = ({
  playerCount,
  wolfRolesText,
  godRolesText,
  specialRolesText,
  villagerCount,
}) => {
  return (
    <View style={styles.boardInfoContainer}>
      <Text style={styles.boardInfoTitle}>板子配置 ({playerCount}人局)</Text>
      <View style={styles.boardInfoContent}>
        <View style={styles.roleCategory}>
          <Text style={styles.roleCategoryLabel}>🐺 狼人：</Text>
          <Text style={styles.roleCategoryText}>{wolfRolesText}</Text>
        </View>
        <View style={styles.roleCategory}>
          <Text style={styles.roleCategoryLabel}>✨ 神职：</Text>
          <Text style={styles.roleCategoryText}>{godRolesText}</Text>
        </View>
        {Boolean(specialRolesText) && (
          <View style={styles.roleCategory}>
            <Text style={styles.roleCategoryLabel}>🎭 特殊：</Text>
            <Text style={styles.roleCategoryText}>{specialRolesText}</Text>
          </View>
        )}
        {villagerCount > 0 && (
          <View style={styles.roleCategory}>
            <Text style={styles.roleCategoryLabel}>👤 村民：</Text>
            <Text style={styles.roleCategoryText}>{villagerCount}人</Text>
          </View>
        )}
      </View>
    </View>
  );
};

export default BoardInfoCard;
