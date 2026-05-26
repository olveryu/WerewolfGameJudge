/**
 * AnnouncementModal — Announcement and feedback modal (3-tab switcher)
 *
 * Controlled component: parent passes visible / onClose.
 * Tab 1 "Boards": all preset boards grouped by version, latest on top.
 * Tab 2 "Changelog": vertical scroll of version updates (latest on top).
 * Tab 3 "Feedback": two-way conversation system (FeedbackTab component).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { PRESET_TEMPLATES, TEMPLATE_CATEGORY_LABELS } from '@werewolf/game-engine/models/Template';
import type React from 'react';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { BaseCenterModal } from '@/components/BaseCenterModal';
import {
  ANNOUNCEMENT_VERSIONS,
  ANNOUNCEMENTS,
  BOARD_VERSION_MAP,
  BOARD_VERSIONS_DESC,
} from '@/config/announcements';
import { useAuthContext as useAuth } from '@/contexts/AuthContext';
import { borderRadius, colors, componentSizes, spacing, typography, withAlpha } from '@/theme';

import { FeedbackTab } from './FeedbackTab';

type Tab = 'boards' | 'changelog' | 'feedback';

/** Color token key for each category */
const CATEGORY_COLOR: Record<string, string> = {
  classic: colors.god,
  advanced: colors.primary,
  special: colors.warning,
  thirdParty: colors.third,
};

/** Collapse by default when boards in a version group >= this value */
const COLLAPSE_THRESHOLD = 6;

interface AnnouncementModalProps {
  visible: boolean;
  onClose: () => void;
  hasUnreadFeedback: boolean;
  onUnreadFeedbackChange: (count: number) => void;
}

export const AnnouncementModal: React.FC<AnnouncementModalProps> = ({
  visible,
  onClose,
  hasUnreadFeedback,
  onUnreadFeedbackChange,
}) => {
  const { height: screenHeight } = useWindowDimensions();
  const scrollMaxHeight = Math.min(400, Math.round(screenHeight * 0.45));

  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('boards');
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(new Set());

  /** Boards grouped by version (each group preserves original PRESET_TEMPLATES order) */
  const boardsByVersion = useMemo(() => {
    return BOARD_VERSIONS_DESC.map((version) => {
      const boards = PRESET_TEMPLATES.filter((t) => BOARD_VERSION_MAP[t.name] === version);
      return { version, boards };
    });
  }, []);

  const latestBoardVersion = BOARD_VERSIONS_DESC[0];

  return (
    <BaseCenterModal
      visible={visible}
      onClose={onClose}
      dismissOnOverlayPress
      animationType="fade"
      contentStyle={styles.modalContent}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons
              name="megaphone-outline"
              size={componentSizes.icon.md}
              color={colors.primary}
            />
            <Text style={styles.headerTitle}>公告与反馈</Text>
          </View>
          <Pressable
            onPress={onClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="关闭公告"
          >
            <Ionicons name="close" size={componentSizes.icon.md} color={colors.textMuted} />
          </Pressable>
        </View>

        {/* Tab bar — 3 tabs */}
        <View style={styles.tabBar}>
          <Pressable
            style={[styles.tab, activeTab === 'boards' && styles.tabActive]}
            onPress={() => setActiveTab('boards')}
          >
            <Text style={[styles.tabText, activeTab === 'boards' && styles.tabTextActive]}>
              板子
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, activeTab === 'changelog' && styles.tabActive]}
            onPress={() => setActiveTab('changelog')}
          >
            <Text style={[styles.tabText, activeTab === 'changelog' && styles.tabTextActive]}>
              更新日志
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, activeTab === 'feedback' && styles.tabActive]}
            onPress={() => setActiveTab('feedback')}
          >
            <View style={styles.tabWithBadge}>
              <Text style={[styles.tabText, activeTab === 'feedback' && styles.tabTextActive]}>
                意见反馈
              </Text>
              {hasUnreadFeedback && <View style={styles.tabDot} />}
            </View>
          </Pressable>
        </View>

        {/* ── Tab: Boards ── */}
        {activeTab === 'boards' && (
          <ScrollView
            style={[styles.scrollArea, { maxHeight: scrollMaxHeight }]}
            showsVerticalScrollIndicator={false}
          >
            {boardsByVersion.map(({ version, boards }, groupIdx) => {
              const isLatest = version === latestBoardVersion;
              const shouldCollapse = boards.length >= COLLAPSE_THRESHOLD;
              const isExpanded = expandedVersions.has(version);

              return (
                <View key={version}>
                  {groupIdx > 0 && <View style={styles.separator} />}
                  <View style={[styles.versionGroup, isLatest && styles.versionGroupLatest]}>
                    {/* Version title row */}
                    <View style={styles.versionHeaderRow}>
                      <View
                        style={[
                          styles.versionBar,
                          { backgroundColor: isLatest ? colors.primary : colors.border },
                        ]}
                      />
                      <Text style={styles.versionTitle}>
                        {version === 'v1.0.0' ? 'v1.0.0 首发' : `${version} 新增`}
                      </Text>
                      {isLatest && (
                        <View style={styles.newBadge}>
                          <Text style={styles.newBadgeText}>NEW</Text>
                        </View>
                      )}
                    </View>

                    {/* Collapsed state */}
                    {shouldCollapse && !isExpanded ? (
                      <Pressable
                        style={styles.expandButton}
                        onPress={() => setExpandedVersions((prev) => new Set(prev).add(version))}
                      >
                        <Text style={styles.expandButtonText}>展开 {boards.length} 套板子</Text>
                        <Ionicons
                          name="chevron-down"
                          size={componentSizes.icon.xs}
                          color={colors.primary}
                        />
                      </Pressable>
                    ) : (
                      <View style={styles.boardChips}>
                        {boards.map((board) => {
                          const catColor = CATEGORY_COLOR[board.category] ?? colors.textMuted;
                          return (
                            <View key={board.name} style={styles.boardChipRow}>
                              <View style={styles.boardChip}>
                                <Text style={styles.boardChipText}>{board.name}</Text>
                              </View>
                              <Text style={[styles.categoryLabel, { color: catColor }]}>
                                {TEMPLATE_CATEGORY_LABELS[board.category]}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    )}

                    {/* Collapse button when expanded */}
                    {shouldCollapse && isExpanded && (
                      <Pressable
                        style={styles.expandButton}
                        onPress={() =>
                          setExpandedVersions((prev) => {
                            const next = new Set(prev);
                            next.delete(version);
                            return next;
                          })
                        }
                      >
                        <Text style={styles.expandButtonText}>收起</Text>
                        <Ionicons
                          name="chevron-up"
                          size={componentSizes.icon.xs}
                          color={colors.primary}
                        />
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}

        {/* ── Tab: Changelog ── */}
        {activeTab === 'changelog' && (
          <ScrollView
            style={[styles.scrollArea, { maxHeight: scrollMaxHeight }]}
            showsVerticalScrollIndicator={false}
          >
            {ANNOUNCEMENT_VERSIONS.map((version, i) => {
              const announcement = ANNOUNCEMENTS[version];
              if (!announcement) return null;
              return (
                <View key={version}>
                  {i > 0 && <View style={styles.separator} />}
                  <View style={styles.section}>
                    <Text style={styles.changelogTitle}>{announcement.title}</Text>
                    <View style={styles.itemList}>
                      {announcement.items.map((item) => (
                        <View key={item} style={styles.itemRow}>
                          <Text style={styles.bullet}>•</Text>
                          <Text style={styles.itemText}>{item}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}

        {/* ── Tab: Feedback ── */}
        {activeTab === 'feedback' && (
          <FeedbackTab
            scrollMaxHeight={scrollMaxHeight}
            isLoggedIn={!!user}
            onUnreadChange={onUnreadFeedbackChange}
          />
        )}
      </View>
    </BaseCenterModal>
  );
};

const styles = StyleSheet.create({
  modalContent: {
    width: 320,
    maxWidth: '90%',
  },
  container: {
    alignItems: 'stretch',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.medium,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
  },
  headerTitle: {
    fontSize: typography.title,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  // ── Tab bar ──
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.medium,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.small,
    borderBottomWidth: 2,
    borderBottomColor: colors.transparent,
  },
  tabActive: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: typography.body,
    fontWeight: typography.weights.medium,
    color: colors.textMuted,
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },
  tabWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.micro,
  },
  tabDot: {
    width: 6,
    height: 6,
    borderRadius: borderRadius.full,
    backgroundColor: colors.error,
  },
  // ── Shared ──
  scrollArea: {
    marginBottom: spacing.small,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.medium,
  },
  section: {
    gap: spacing.tight,
  },
  // ── Boards tab ──
  versionGroup: {
    gap: spacing.small,
  },
  versionGroupLatest: {
    backgroundColor: withAlpha(colors.primary, 0.04),
    borderRadius: borderRadius.small,
    padding: spacing.small,
    marginHorizontal: -spacing.small,
  },
  versionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
  },
  versionBar: {
    width: 3,
    height: 14,
    borderRadius: borderRadius.full,
  },
  versionTitle: {
    fontSize: typography.body,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  newBadge: {
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.small,
    paddingHorizontal: spacing.tight,
    paddingVertical: spacing.micro,
  },
  newBadgeText: {
    fontSize: typography.captionSmall,
    fontWeight: typography.weights.semibold,
    color: colors.primaryDark,
  },
  boardChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.tight,
  },
  boardChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.micro,
  },
  boardChip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: borderRadius.small,
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.micro,
  },
  boardChipText: {
    fontSize: typography.caption,
    color: colors.text,
    fontWeight: typography.weights.medium,
  },
  categoryLabel: {
    fontSize: typography.captionSmall,
    fontWeight: typography.weights.medium,
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.tight,
    paddingVertical: spacing.tight,
  },
  expandButtonText: {
    fontSize: typography.caption,
    color: colors.primary,
    fontWeight: typography.weights.medium,
  },
  // ── Changelog tab ──
  changelogTitle: {
    fontSize: typography.body,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: spacing.tight,
  },
  itemList: {
    gap: spacing.tight,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.small,
  },
  bullet: {
    fontSize: typography.body,
    color: colors.primary,
    lineHeight: typography.body * 1.5,
  },
  itemText: {
    flex: 1,
    fontSize: typography.body,
    color: colors.text,
    lineHeight: typography.body * 1.5,
  },
});
