/**
 * BoardInfoCard - 角色配置信息卡片（可折叠，Memoized）
 *
 * 显示角色配置概览（狼/神/民数量）。点击角色名可查看该角色技能。
 * 渲染 UI、处理折叠交互并通过回调上报 onRolePress intent，不 import service，不包含业务逻辑判断。
 */
import { Ionicons } from '@expo/vector-icons';
import React, { memo, useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { FactionChip } from '@/components/FactionChip';
import { UI_ICONS } from '@/config/iconTokens';
import { componentSizes, fixed, useColors } from '@/theme';

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
  /** Number of generic villagers */
  villagerCount: number;
  /** Villager-faction roles that are NOT generic villager (e.g. mirrorSeer) */
  villagerRoleItems: readonly RoleDisplayItem[];
  /** Whether the card should be collapsed */
  collapsed?: boolean;
  /** Callback when a role chip is pressed (reports roleId to parent) */
  onRolePress?: (roleId: string) => void;
  /** Callback when the notepad button is pressed */
  onNotepadPress?: () => void;
  /** Pre-created styles from parent */
  styles: BoardInfoCardStyles;
}

/** Render a row of role chips for a faction category */
function RoleChipRow({
  items,
  onRolePress,
  styles,
  color,
}: {
  items: readonly RoleDisplayItem[];
  onRolePress?: (roleId: string) => void;
  styles: BoardInfoCardStyles;
  color: string;
}) {
  return (
    <View style={styles.roleChipRow}>
      {items.map((item) => (
        <FactionChip
          key={item.roleId}
          label={item.count > 1 ? `${item.displayName}×${item.count}` : item.displayName}
          color={color}
          size="md"
          onPress={onRolePress ? () => onRolePress(item.roleId) : undefined}
        />
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
  villagerRoleItems,
  collapsed = false,
  onRolePress,
  onNotepadPress,
  styles,
}) => {
  const colors = useColors();
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
      <TouchableOpacity
        style={styles.headerRow}
        onPress={handleToggle}
        activeOpacity={fixed.activeOpacity}
      >
        <Text style={styles.boardInfoTitle}>角色配置（{playerCount}人局）</Text>
        <View style={styles.headerRowRight}>
          {onNotepadPress != null && (
            <TouchableOpacity
              onPress={onNotepadPress}
              style={styles.notepadBtn}
              activeOpacity={fixed.activeOpacity}
            >
              <Ionicons
                name="document-text-outline"
                size={componentSizes.icon.sm}
                color={colors.primary}
              />
              <Text style={styles.notepadBtnText}>笔记</Text>
            </TouchableOpacity>
          )}
          <Ionicons
            name={isCollapsed ? 'chevron-down' : 'chevron-up'}
            size={componentSizes.icon.sm}
            color={colors.textSecondary}
          />
        </View>
      </TouchableOpacity>

      {!isCollapsed && (
        <View style={styles.boardInfoContent}>
          {wolfRoleItems.length > 0 && (
            <View style={styles.roleCategory}>
              <Text style={styles.roleCategoryLabel}>狼人：</Text>
              <RoleChipRow
                items={wolfRoleItems}
                onRolePress={onRolePress}
                styles={styles}
                color={colors.wolf}
              />
            </View>
          )}
          {godRoleItems.length > 0 && (
            <View style={styles.roleCategory}>
              <Text style={styles.roleCategoryLabel}>神职：</Text>
              <RoleChipRow
                items={godRoleItems}
                onRolePress={onRolePress}
                styles={styles}
                color={colors.god}
              />
            </View>
          )}
          {specialRoleItems.length > 0 && (
            <View style={styles.roleCategory}>
              <Text style={styles.roleCategoryLabel}>特殊：</Text>
              <RoleChipRow
                items={specialRoleItems}
                onRolePress={onRolePress}
                styles={styles}
                color={colors.third}
              />
            </View>
          )}
          {(villagerCount > 0 || villagerRoleItems.length > 0) && (
            <View style={styles.roleCategory}>
              <Text style={styles.roleCategoryLabel}>村民：</Text>
              <View style={styles.roleChipRow}>
                {villagerCount > 0 && (
                  <FactionChip
                    label={villagerCount > 1 ? `村民×${villagerCount}` : '村民'}
                    color={colors.villager}
                    size="md"
                    onPress={onRolePress ? () => onRolePress('villager') : undefined}
                  />
                )}
                {villagerRoleItems.map((item) => (
                  <FactionChip
                    key={item.roleId}
                    label={item.count > 1 ? `${item.displayName}×${item.count}` : item.displayName}
                    color={colors.villager}
                    size="md"
                    onPress={onRolePress ? () => onRolePress(item.roleId) : undefined}
                  />
                ))}
              </View>
            </View>
          )}
          <Text style={styles.boardInfoHint}>
            <Ionicons name={UI_ICONS.HINT} size={componentSizes.icon.xs} color={colors.textMuted} />
            {' 点击角色名查看能力说明'}
          </Text>
        </View>
      )}
    </View>
  );
};

export const BoardInfoCard = memo(BoardInfoCardComponent);

BoardInfoCard.displayName = 'BoardInfoCard';
