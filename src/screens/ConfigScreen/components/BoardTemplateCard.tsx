/**
 * BoardTemplateCard - 板子预设卡片（折叠/展开/选中三态）
 *
 * 折叠态：标题 + 阵营统计 + 关键差异角色。
 * 展开态：完整角色按阵营分组 + "选择此板子"按钮。
 * 选中态：左蓝边框 + 高亮。
 * 渲染 UI 并通过回调上报 onSelect / onToggleExpand，
 * 不 import service，不包含业务逻辑判断。
 */
import { Ionicons } from '@expo/vector-icons';
import type { PresetTemplate } from '@werewolf/game-engine/models/Template';
import { memo, useCallback, useMemo } from 'react';
import { LayoutAnimation, Platform, Text, TouchableOpacity, UIManager, View } from 'react-native';

import { useColors, withAlpha } from '@/theme';
import { fixed } from '@/theme/tokens';

import { computeFactionStats, FACTION_COLOR_MAP, getKeyRoles } from '../configHelpers';
import { FactionStatBadges, RoleListByFaction } from './RoleListByFaction';
import type { TemplatePickerStyles } from './templatePicker.styles';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─────────────────────────────────────────────────────────────────────────────

interface BoardTemplateCardProps {
  template: PresetTemplate;
  isSelected: boolean;
  isExpanded: boolean;
  onToggleExpand: (name: string) => void;
  onSelect: (name: string) => void;
  /** Callback when a role chip is tapped (reports roleId to parent) */
  onRolePress?: (roleId: string) => void;
  styles: TemplatePickerStyles;
}

export const BoardTemplateCard = memo<BoardTemplateCardProps>(
  ({ template, isSelected, isExpanded, onToggleExpand, onSelect, onRolePress, styles }) => {
    const colors = useColors();

    const stats = useMemo(() => computeFactionStats(template.roles), [template.roles]);
    const keyRoles = useMemo(() => getKeyRoles(template.roles, 4), [template.roles]);
    const remainingCount = useMemo(() => {
      const totalSpecial = template.roles.filter((r) => r !== 'wolf' && r !== 'villager').length;
      return Math.max(0, totalSpecial - keyRoles.length);
    }, [template.roles, keyRoles]);

    const handleToggle = useCallback(() => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      onToggleExpand(template.name);
    }, [onToggleExpand, template.name]);

    const handleSelect = useCallback(() => {
      onSelect(template.name);
    }, [onSelect, template.name]);

    return (
      <View style={[styles.templateCard, isSelected && styles.templateCardSelected]}>
        {/* Tap header area to expand/collapse */}
        <TouchableOpacity
          style={styles.templateCardHeader}
          onPress={handleToggle}
          activeOpacity={fixed.activeOpacity}
        >
          {/* Row 1: Title + player count */}
          <View style={styles.templateCardTitleRow}>
            <Text style={styles.templateCardTitle} numberOfLines={1}>
              {template.name.replace(/\d+人$/, '')}
            </Text>
            <View style={styles.templateCardPlayerBadge}>
              <Text style={styles.templateCardPlayerText}>{template.roles.length}人</Text>
            </View>
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={colors.textSecondary}
              style={styles.templateCardChevron}
            />
          </View>

          {/* Row 2: Faction stat badges */}
          <FactionStatBadges stats={stats} styles={styles} />

          {/* Row 3: Key role chips (collapsed preview) */}
          {!isExpanded && keyRoles.length > 0 && (
            <View style={styles.keyRoleRow}>
              {keyRoles.map((item) => {
                const colorKey = FACTION_COLOR_MAP[item.faction] ?? 'villager';
                const chipColor = colors[colorKey as keyof typeof colors] as string;
                return (
                  <View
                    key={item.roleId}
                    style={[
                      styles.keyRoleChip,
                      {
                        borderColor: withAlpha(chipColor, 0.3),
                        backgroundColor: withAlpha(chipColor, 0.06),
                      },
                    ]}
                  >
                    <Text style={[styles.keyRoleChipText, { color: chipColor }]}>
                      {item.displayName}
                    </Text>
                  </View>
                );
              })}
              {remainingCount > 0 && <Text style={styles.keyRoleMore}>+{remainingCount}</Text>}
            </View>
          )}
        </TouchableOpacity>

        {/* Expanded: full role list + CTA */}
        {isExpanded && (
          <View style={styles.templateCardExpanded}>
            <View style={styles.templateCardDivider} />
            <RoleListByFaction roles={template.roles} styles={styles} onRolePress={onRolePress} />
            <TouchableOpacity
              style={[styles.templateCardCTA, isSelected && styles.templateCardCTASelected]}
              onPress={handleSelect}
              activeOpacity={fixed.activeOpacity}
            >
              <Text
                style={[
                  styles.templateCardCTAText,
                  isSelected && styles.templateCardCTATextSelected,
                ]}
              >
                {isSelected ? '已选择 ✓' : '选择此板子'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  },
);

BoardTemplateCard.displayName = 'BoardTemplateCard';
