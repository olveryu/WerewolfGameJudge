/**
 * BoardInfoCard - 板子信息卡片（可折叠，Memoized）
 *
 * 显示角色配置概览（狼/神/民数量）。点击角色名可查看该角色技能。
 *
 * ✅ 允许：渲染 UI + 折叠交互 + 上报 onRolePress intent
 * ❌ 禁止：import service / 业务逻辑判断
 */
import React, { memo, useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import type { RoleDisplayItem } from '../RoomScreen.helpers';
import { type BoardInfoCardStyles } from './styles';

interface BoardInfoCardProps {
  /** Total number of players */
  playerCount: number;
  /** Wolf role items (roleId + displayName + count) */
  wolfRoleItems: readonly RoleDisplayItem[];
  /** God role items */
  godRoleItems: readonly RoleDisplayItem[];
  /** Special role items (optional) */
  specialRoleItems: readonly RoleDisplayItem[];
  /** Number of villagers */
  villagerCount: number;
  /** Whether the card should be collapsed */
  collapsed?: boolean;
  /** Callback when a role chip is pressed (reports roleId to parent) */
  onRolePress?: (roleId: string) => void;
  /** Pre-created styles from parent */
  styles: BoardInfoCardStyles;
}

/** Render a row of touchable role chips for a faction category */
function RoleChipRow({
  items,
  onRolePress,
  styles,
}: {
  items: readonly RoleDisplayItem[];
  onRolePress?: (roleId: string) => void;
  styles: BoardInfoCardStyles;
}) {
  return (
    <View style={styles.roleChipRow}>
      {items.map((item) => (
        <TouchableOpacity
          key={item.roleId}
          style={styles.roleChip}
          activeOpacity={0.6}
          onPress={() => onRolePress?.(item.roleId)}
        >
          <Text style={styles.roleChipText}>
            {item.count > 1 ? `${item.displayName}×${item.count}` : item.displayName}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const BoardInfoCardComponent: React.FC<BoardInfoCardProps> = ({
  playerCount,
  wolfRoleItems,
  godRoleItems,
  specialRoleItems,
  villagerCount,
  collapsed = false,
  onRolePress,
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
            <RoleChipRow items={wolfRoleItems} onRolePress={onRolePress} styles={styles} />
          </View>
          <View style={styles.roleCategory}>
            <Text style={styles.roleCategoryLabel}>✨ 神职：</Text>
            <RoleChipRow items={godRoleItems} onRolePress={onRolePress} styles={styles} />
          </View>
          {specialRoleItems.length > 0 && (
            <View style={styles.roleCategory}>
              <Text style={styles.roleCategoryLabel}>🎭 特殊：</Text>
              <RoleChipRow items={specialRoleItems} onRolePress={onRolePress} styles={styles} />
            </View>
          )}
          {villagerCount > 0 && (
            <View style={styles.roleCategory}>
              <Text style={styles.roleCategoryLabel}>👤 村民：</Text>
              <View style={styles.roleChipRow}>
                <TouchableOpacity
                  style={styles.roleChip}
                  activeOpacity={0.6}
                  onPress={() => onRolePress?.('villager')}
                >
                  <Text style={styles.roleChipText}>
                    {villagerCount > 1 ? `村民×${villagerCount}` : '村民'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

export const BoardInfoCard = memo(BoardInfoCardComponent);

BoardInfoCard.displayName = 'BoardInfoCard';
