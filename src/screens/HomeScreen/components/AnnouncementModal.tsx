/**
 * AnnouncementModal — 公告与反馈弹窗（两 tab 切换）
 *
 * 受控组件：由父级传入 visible / onClose。
 * Tab 1「更新日志」：垂直滚动展示版本更新内容（最新在上）。
 * Tab 2「意见反馈」：多行输入 + 提交按钮，需登录。
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import type React from 'react';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { toast } from 'sonner-native';

import { BaseCenterModal } from '@/components/BaseCenterModal';
import { ANNOUNCEMENT_VERSIONS, ANNOUNCEMENTS } from '@/config/announcements';
import { APP_VERSION } from '@/config/version';
import { useAuthContext as useAuth } from '@/contexts/AuthContext';
import { submitFeedback } from '@/services/feature/FeedbackService';
import { TESTIDS } from '@/testids';
import { borderRadius, colors, componentSizes, spacing, typography } from '@/theme';
import { handleError } from '@/utils/errorPipeline';
import { homeLog } from '@/utils/logger';

type Tab = 'changelog' | 'feedback';

interface AnnouncementModalProps {
  visible: boolean;
  onClose: () => void;
}

export const AnnouncementModal: React.FC<AnnouncementModalProps> = ({ visible, onClose }) => {
  const { height: screenHeight } = useWindowDimensions();
  const scrollMaxHeight = Math.min(400, Math.round(screenHeight * 0.45));

  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('changelog');
  const [feedbackText, setFeedbackText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmitFeedback = useCallback(async () => {
    const trimmed = feedbackText.trim();
    if (trimmed.length === 0) return;

    setIsSubmitting(true);
    try {
      await submitFeedback(trimmed, APP_VERSION);
      toast.success('感谢反馈！');
      setFeedbackText('');
    } catch (err) {
      handleError(err, {
        label: '提交反馈',
        logger: homeLog,
        feedback: 'toast',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [feedbackText]);

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

        {/* Tab bar */}
        <View style={styles.tabBar}>
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
            <Text style={[styles.tabText, activeTab === 'feedback' && styles.tabTextActive]}>
              意见反馈
            </Text>
          </Pressable>
        </View>

        {/* Tab content */}
        {activeTab === 'changelog' ? (
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
                    <Text style={styles.versionTitle}>{announcement.title}</Text>
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
        ) : (
          <View style={[styles.feedbackArea, { maxHeight: scrollMaxHeight }]}>
            {user ? (
              <>
                <TextInput
                  style={styles.feedbackInput}
                  value={feedbackText}
                  onChangeText={setFeedbackText}
                  placeholder="说说你的建议或遇到的问题…"
                  placeholderTextColor={colors.textMuted}
                  multiline
                  textAlignVertical="top"
                  maxLength={500}
                  editable={!isSubmitting}
                  testID={TESTIDS.feedbackInput}
                />
                <Text style={styles.charCount}>{feedbackText.length}/500</Text>
                <Pressable
                  style={[
                    styles.submitButton,
                    (feedbackText.trim().length === 0 || isSubmitting) &&
                      styles.submitButtonDisabled,
                  ]}
                  onPress={() => void handleSubmitFeedback()}
                  disabled={feedbackText.trim().length === 0 || isSubmitting}
                  testID={TESTIDS.feedbackSubmitButton}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color={colors.textInverse} />
                  ) : (
                    <Text style={styles.submitButtonText}>提交反馈</Text>
                  )}
                </Pressable>
              </>
            ) : (
              <View style={styles.loginHint}>
                <Ionicons
                  name="lock-closed-outline"
                  size={componentSizes.icon.lg}
                  color={colors.textMuted}
                />
                <Text style={styles.loginHintText}>登录后可提交建议</Text>
              </View>
            )}
          </View>
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
  // ── Changelog tab ──
  scrollArea: {
    marginBottom: spacing.small,
  },
  section: {
    gap: spacing.tight,
  },
  versionTitle: {
    fontSize: typography.body,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: spacing.tight,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.medium,
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
  // ── Feedback tab ──
  feedbackArea: {
    marginBottom: spacing.small,
  },
  feedbackInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.medium,
    padding: spacing.small,
    fontSize: typography.body,
    color: colors.text,
    height: 120,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: typography.captionSmall,
    color: colors.textMuted,
    textAlign: 'right',
    marginTop: spacing.tight,
    marginBottom: spacing.small,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.medium,
    paddingVertical: spacing.small,
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: typography.body,
    fontWeight: typography.weights.semibold,
    color: colors.textInverse,
  },
  loginHint: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.small,
    paddingVertical: spacing.xlarge,
  },
  loginHintText: {
    fontSize: typography.body,
    color: colors.textMuted,
  },
});
