/** Product announcement modal composed with game-owned announcement tabs. */

import Ionicons from '@expo/vector-icons/Ionicons';
import type React from 'react';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { BaseCenterModal } from '@/components/BaseCenterModal';
import { ANNOUNCEMENT_VERSIONS, ANNOUNCEMENTS } from '@/config/announcements';
import { useAuthContext as useAuth } from '@/contexts/AuthContext';
import type { ClientGameAnnouncementTab } from '@/games/home';
import { borderRadius, colors, componentSizes, spacing, typography } from '@/theme';

import { FeedbackTab } from './FeedbackTab';

const CHANGELOG_TAB = 'changelog';
const FEEDBACK_TAB = 'feedback';
const ANNOUNCEMENT_MAX_HEIGHT = 400;
const ANNOUNCEMENT_SCREEN_HEIGHT_RATIO = 0.45;

interface AnnouncementModalProps {
  readonly visible: boolean;
  readonly gameTabs: readonly ClientGameAnnouncementTab[];
  readonly onClose: () => void;
  readonly hasUnreadFeedback: boolean;
  readonly onUnreadFeedbackChange: (count: number) => void;
}

export const AnnouncementModal: React.FC<AnnouncementModalProps> = ({
  visible,
  gameTabs,
  onClose,
  hasUnreadFeedback,
  onUnreadFeedbackChange,
}) => {
  const { height: screenHeight } = useWindowDimensions();
  const scrollMaxHeight = Math.min(
    ANNOUNCEMENT_MAX_HEIGHT,
    Math.round(screenHeight * ANNOUNCEMENT_SCREEN_HEIGHT_RATIO),
  );
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(() => gameTabs[0]?.key ?? CHANGELOG_TAB);
  const activeGameTab = gameTabs.find((tab) => tab.key === activeTab);
  const ActiveGameTabContent = activeGameTab?.Content ?? null;

  if (activeGameTab === undefined && activeTab !== CHANGELOG_TAB && activeTab !== FEEDBACK_TAB) {
    throw new Error(`[FAIL-FAST] Unknown announcement tab ${activeTab}`);
  }

  return (
    <BaseCenterModal
      visible={visible}
      onClose={onClose}
      dismissOnOverlayPress
      animationType="fade"
      contentStyle={styles.modalContent}
    >
      <View style={styles.container}>
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

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabBar}
          contentContainerStyle={styles.tabBarContent}
        >
          {gameTabs.map((tab) => (
            <AnnouncementTabButton
              key={tab.key}
              label={tab.label}
              isActive={activeTab === tab.key}
              onPress={() => setActiveTab(tab.key)}
            />
          ))}
          <AnnouncementTabButton
            label="更新日志"
            isActive={activeTab === CHANGELOG_TAB}
            onPress={() => setActiveTab(CHANGELOG_TAB)}
          />
          <AnnouncementTabButton
            label="意见反馈"
            isActive={activeTab === FEEDBACK_TAB}
            hasBadge={hasUnreadFeedback}
            onPress={() => setActiveTab(FEEDBACK_TAB)}
          />
        </ScrollView>

        {ActiveGameTabContent !== null && <ActiveGameTabContent maxHeight={scrollMaxHeight} />}

        {activeTab === CHANGELOG_TAB && (
          <ScrollView
            style={[styles.scrollArea, { maxHeight: scrollMaxHeight }]}
            showsVerticalScrollIndicator={false}
          >
            {ANNOUNCEMENT_VERSIONS.map((version, index) => {
              const announcement = ANNOUNCEMENTS[version];
              if (announcement === undefined) {
                throw new Error(`[FAIL-FAST] Missing announcement content for ${version}`);
              }
              return (
                <View key={version}>
                  {index > 0 && <View style={styles.separator} />}
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

        {activeTab === FEEDBACK_TAB && (
          <FeedbackTab
            scrollMaxHeight={scrollMaxHeight}
            isLoggedIn={user !== null}
            onUnreadChange={onUnreadFeedbackChange}
          />
        )}
      </View>
    </BaseCenterModal>
  );
};

interface AnnouncementTabButtonProps {
  readonly label: string;
  readonly isActive: boolean;
  readonly hasBadge?: boolean;
  readonly onPress: () => void;
}

const AnnouncementTabButton: React.FC<AnnouncementTabButtonProps> = ({
  label,
  isActive,
  hasBadge = false,
  onPress,
}) => (
  <Pressable style={[styles.tab, isActive && styles.tabActive]} onPress={onPress}>
    <View style={styles.tabLabelRow}>
      <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{label}</Text>
      {hasBadge && <View style={styles.tabDot} />}
    </View>
  </Pressable>
);

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
  tabBar: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.medium,
  },
  tabBarContent: {
    flexGrow: 1,
  },
  tab: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.small,
    borderBottomWidth: 2,
    borderBottomColor: colors.transparent,
  },
  tabActive: {
    borderBottomColor: colors.primary,
  },
  tabLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.micro,
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
  tabDot: {
    width: 6,
    height: 6,
    borderRadius: borderRadius.full,
    backgroundColor: colors.error,
  },
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
