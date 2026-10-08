/**
 * BoardInfoCard - Role configuration info card (collapsible, Memoized)
 *
 * Generic board info renderer. Games pass their own sections; the component
 * only handles rendering, collapse interaction, and onRolePress callbacks.
 * No game-specific labels, colors, or logic baked in.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import type React from 'react';
import { memo, useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { FactionChip } from '@/components/FactionChip';
import { UI_ICONS } from '@/config/iconTokens';
import type { BoardInfoSection } from '@/features/room/model/SeatGameRoom';
import { colors, componentSizes, fixed } from '@/theme';

import { type BoardInfoCardStyles } from './boardInfo.styles';

/**
 * 板子信息分组：标题 + 角色项 + 颜色。
 * 各游戏传入自己的分组，共享组件只负责渲染。
 * 狼人杀：[{ title: '狼人', items, color: colors.wolf }, ...]
 * 阿瓦隆：[{ title: '坏人', items, color: colors.wolf }, ...]
 */
interface BoardInfoCardProps {
  /** Total number of players */
  playerCount: number;
  /** 分组列表：各游戏传入自己的分组 */
  sections: readonly BoardInfoSection[];
  /** Whether the card should be collapsed */
  collapsed?: boolean;
  /** Callback when a role chip is pressed (reports roleId to parent) */
  onRolePress?: (roleId: string) => void;
  /** Callback when the notepad button is pressed */
  onNotepadPress?: () => void;
  /** Callback when the strategy button is pressed */
  onStrategyPress?: () => void;
  /** Pre-created styles from parent */
  styles: BoardInfoCardStyles;
  /**
   * 游戏专属的底部内容（如狼人杀的提名按钮）。
   * 共享组件只渲染板子信息，游戏特有 UI 由游戏传入。
   */
  footer?: React.ReactNode;
}

/** Render a row of role chips for a section */
function SectionChipRow({
  section,
  onRolePress,
  styles,
}: {
  section: BoardInfoSection;
  onRolePress?: (roleId: string) => void;
  styles: BoardInfoCardStyles;
}) {
  if (section.items.length === 0) return null;
  return (
    <View style={styles.roleCategory}>
      <Text style={styles.roleCategoryLabel}>{section.title}：</Text>
      <View style={styles.roleChipRow}>
        {section.items.map((item) => (
          <FactionChip
            key={item.roleId}
            label={item.count > 1 ? `${item.displayName}×${item.count}` : item.displayName}
            color={section.color}
            size="md"
            onPress={onRolePress ? () => onRolePress(item.roleId) : undefined}
          />
        ))}
      </View>
    </View>
  );
}

const BoardInfoCardComponent: React.FC<BoardInfoCardProps> = ({
  playerCount,
  sections,
  collapsed = false,
  onRolePress,
  onNotepadPress,
  onStrategyPress,
  styles,
  footer,
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
      <TouchableOpacity
        style={styles.headerRow}
        onPress={handleToggle}
        activeOpacity={fixed.activeOpacity}
      >
        <Text style={styles.boardInfoTitle}>配置（{playerCount}人）</Text>
        <View style={styles.headerRowRight}>
          {onStrategyPress != null && (
            <TouchableOpacity
              onPress={onStrategyPress}
              style={styles.notepadBtn}
              activeOpacity={fixed.activeOpacity}
            >
              <Ionicons name="book-outline" size={componentSizes.icon.sm} color={colors.primary} />
              <Text style={styles.notepadBtnText}>攻略</Text>
            </TouchableOpacity>
          )}
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
          {sections.map((section) => (
            <SectionChipRow
              key={section.title}
              section={section}
              onRolePress={onRolePress}
              styles={styles}
            />
          ))}
          <View style={styles.footerRow}>
            {onRolePress && (
              <Text style={styles.boardInfoHint} numberOfLines={1}>
                <Ionicons
                  name={UI_ICONS.HINT}
                  size={componentSizes.icon.xs}
                  color={colors.textMuted}
                />
                {' 点击角色名查看说明'}
              </Text>
            )}
            {footer}
          </View>
        </View>
      )}
    </View>
  );
};

export const BoardInfoCard = memo(BoardInfoCardComponent);

BoardInfoCard.displayName = 'BoardInfoCard';
