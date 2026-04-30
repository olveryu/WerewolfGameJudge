/**
 * BoardStrategyContent — 板子策略攻略 Accordion 内容组件
 *
 * 展示板子核心博弈描述 + 可折叠的策略 sections（好人方/狼人方/第三方/首夜/翻车）。
 * 纯展示组件，不 import service，不含业务逻辑。
 * 通过 props 接收 boardName，从 BOARD_STRATEGY 查找数据。
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback, useMemo, useState } from 'react';
import {
  LayoutAnimation,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';

import { PressableScale } from '@/components/PressableScale';
import {
  borderRadius,
  colors,
  componentSizes,
  fixed,
  spacing,
  textStyles,
  typography,
  withAlpha,
} from '@/theme';

import { BOARD_STRATEGY, type BoardStrategy } from './boardStrategyData';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface BoardStrategyContentProps {
  /** 板子名称（对应 BOARD_STRATEGY 的 key） */
  boardName: string;
}

interface StrategySection {
  key: string;
  title: string;
  accentColor: string;
  items: readonly string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildSections(data: BoardStrategy): StrategySection[] {
  const sections: StrategySection[] = [
    {
      key: 'good',
      title: '好人方策略',
      accentColor: colors.villager,
      items: data.goodStrategy,
    },
    {
      key: 'wolf',
      title: '狼人方策略',
      accentColor: colors.wolf,
      items: data.wolfStrategy,
    },
  ];

  if (data.thirdStrategy && data.thirdStrategy.length > 0) {
    sections.push({
      key: 'third',
      title: '第三方策略',
      accentColor: colors.third,
      items: data.thirdStrategy,
    });
  }

  sections.push(
    {
      key: 'firstNight',
      title: '首夜关键决策',
      accentColor: colors.warning,
      items: data.firstNight,
    },
    {
      key: 'pitfalls',
      title: '常见翻车',
      accentColor: colors.textMuted,
      items: data.pitfalls,
    },
  );

  return sections;
}

function getDifficultyLabel(difficulty: number): string {
  return `难度 ${difficulty}/5`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const BoardStrategyContent: React.FC<BoardStrategyContentProps> = ({ boardName }) => {
  const data = BOARD_STRATEGY[boardName];
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const sections = useMemo(() => (data ? buildSections(data) : []), [data]);

  const handleToggleSection = useCallback((key: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  if (!data) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>暂无攻略数据</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Meta info row */}
      <View style={styles.metaRow}>
        <View style={styles.metaChip}>
          <Text style={styles.metaChipText}>{getDifficultyLabel(data.difficulty)}</Text>
        </View>
        <View style={styles.metaChip}>
          <Text style={styles.metaChipText}>{data.recommendLevel}</Text>
        </View>
        {data.tags.map((tag) => (
          <View key={tag} style={styles.tagChip}>
            <Text style={styles.tagChipText}>{tag}</Text>
          </View>
        ))}
      </View>

      {/* Summary */}
      <View style={styles.summarySection}>
        <Text style={styles.sectionTitle}>核心博弈</Text>
        <Text style={styles.summaryText}>{data.summary}</Text>
      </View>

      {/* Accordion sections */}
      {sections.map((section) => {
        const isExpanded = expandedKeys.has(section.key);
        return (
          <View key={section.key} style={styles.accordionContainer}>
            <PressableScale
              onPress={() => handleToggleSection(section.key)}
              style={styles.accordionHeader}
            >
              <View style={[styles.accordionAccent, { backgroundColor: section.accentColor }]} />
              <Text style={styles.accordionTitle}>{section.title}</Text>
              <Ionicons
                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                size={componentSizes.icon.sm}
                color={colors.textSecondary}
              />
            </PressableScale>

            {isExpanded && (
              <View
                style={[
                  styles.accordionBody,
                  { borderLeftColor: withAlpha(section.accentColor, 0.3) },
                ]}
              >
                {section.items.map((item, idx) => (
                  <View key={idx} style={styles.bulletRow}>
                    <Text style={styles.bulletDot}>·</Text>
                    <Text style={styles.bulletText}>{item}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        );
      })}

      {/* Meta analysis */}
      <View style={styles.metaAnalysis}>
        <Text style={styles.metaLabel}>Meta</Text>
        <Text style={styles.metaValue}>{data.meta}</Text>
      </View>
    </ScrollView>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingVertical: spacing.medium,
    gap: spacing.medium,
  },

  // Meta info
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.tight,
  },
  metaChip: {
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.micro,
    borderRadius: borderRadius.full,
    backgroundColor: withAlpha(colors.primary, 0.1),
  },
  metaChipText: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.medium,
    color: colors.primary,
  },
  tagChip: {
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.micro,
    borderRadius: borderRadius.full,
    backgroundColor: colors.background,
    borderWidth: fixed.borderWidth,
    borderColor: colors.border,
  },
  tagChipText: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
  },

  // Summary
  summarySection: {
    gap: spacing.small,
  },
  sectionTitle: {
    ...textStyles.secondarySemibold,
    color: colors.textSecondary,
  },
  summaryText: {
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    color: colors.text,
  },

  // Accordion
  accordionContainer: {
    gap: 0,
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.small,
    paddingHorizontal: spacing.medium,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.medium,
    borderWidth: fixed.borderWidth,
    borderColor: colors.borderLight,
  },
  accordionAccent: {
    width: spacing.tight,
    height: typography.secondary,
    borderRadius: borderRadius.full,
    marginRight: spacing.small,
  },
  accordionTitle: {
    flex: 1,
    ...textStyles.secondarySemibold,
    color: colors.text,
  },
  accordionBody: {
    marginLeft: spacing.medium,
    paddingLeft: spacing.medium,
    paddingVertical: spacing.small,
    borderLeftWidth: spacing.micro + 1,
  },

  // Bullets
  bulletRow: {
    flexDirection: 'row',
    paddingVertical: spacing.micro,
  },
  bulletDot: {
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    color: colors.textMuted,
    marginRight: spacing.small,
  },
  bulletText: {
    flex: 1,
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    color: colors.text,
  },

  // Meta analysis
  metaAnalysis: {
    paddingTop: spacing.small,
    borderTopWidth: fixed.borderWidth,
    borderTopColor: colors.borderLight,
    gap: spacing.micro,
  },
  metaLabel: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.semibold,
    color: colors.textMuted,
  },
  metaValue: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    color: colors.textSecondary,
  },

  // Empty
  emptyContainer: {
    padding: spacing.large,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    color: colors.textMuted,
  },
});
