/**
 * BoardInfoCard - 板子信息卡片（可折叠，Memoized）
 *
 * 显示角色配置概览（狼/神/民数量）。
 *
 * ✅ 允许：渲染 UI + 折叠交互
 * ❌ 禁止：import service / 业务逻辑判断
 */
import React, { useState, useEffect, memo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { type BoardInfoCardStyles } from './styles';

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
  /** Whether the card should be collapsed */
  collapsed?: boolean;
  /** Pre-created styles from parent */
  styles: BoardInfoCardStyles;
}

const BoardInfoCardComponent: React.FC<BoardInfoCardProps> = ({
  playerCount,
  wolfRolesText,
  godRolesText,
  specialRolesText,
  villagerCount,
  collapsed = false,
  styles,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(collapsed);
  const [userHasInteracted, setUserHasInteracted] = useState(false);

  // Sync with external collapsed prop only if user hasn't manually interacted
  useEffect(() => {
    if (!userHasInteracted) {
      setIsCollapsed(collapsed);
    }
  }, [collapsed, userHasInteracted]);

  const handleToggle = () => {
    setUserHasInteracted(true);
    setIsCollapsed(!isCollapsed);
  };

  return (
    <View style={styles.boardInfoContainer}>
      <TouchableOpacity style={styles.headerRow} onPress={handleToggle} activeOpacity={0.7}>
        <Text style={styles.boardInfoTitle}>板子配置 ({playerCount}人局)</Text>
        <Text style={styles.collapseIcon}>{isCollapsed ? '▼' : '▲'}</Text>
      </TouchableOpacity>

      {!isCollapsed && (
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
              <Text style={styles.roleCategoryText}>
                {villagerCount > 1 ? `村民×${villagerCount}` : '村民'}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

export const BoardInfoCard = memo(BoardInfoCardComponent);

BoardInfoCard.displayName = 'BoardInfoCard';
