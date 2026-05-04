/**
 * AnnouncementModal — What's New 版本更新弹窗
 *
 * 受控组件：由父级传入 visible / onClose。
 * 垂直滚动展示所有版本的更新内容（最新在上），版本间有分隔线。
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import type React from 'react';
import { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { toast } from 'sonner-native';

import { BaseCenterModal } from '@/components/BaseCenterModal';
import { Button } from '@/components/Button';
import { ANNOUNCEMENT_VERSIONS, ANNOUNCEMENTS, DEVELOPER_WECHAT_ID } from '@/config/announcements';
import { borderRadius, colors, componentSizes, spacing, typography } from '@/theme';

interface AnnouncementModalProps {
  visible: boolean;
  onClose: () => void;
}

export const AnnouncementModal: React.FC<AnnouncementModalProps> = ({ visible, onClose }) => {
  const { height: screenHeight } = useWindowDimensions();
  const scrollMaxHeight = Math.min(400, Math.round(screenHeight * 0.45));

  const handleCopyWechat = useCallback(() => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(DEVELOPER_WECHAT_ID);
      toast.success('已复制微信号');
    }
  }, []);

  if (ANNOUNCEMENT_VERSIONS.length === 0) return null;

  return (
    <BaseCenterModal visible={visible} onClose={onClose} dismissOnOverlayPress animationType="fade">
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Ionicons name="sparkles" size={componentSizes.icon.md} color={colors.primary} />
          <Text style={styles.headerTitle}>更新日志</Text>
        </View>

        {/* Scrollable version list */}
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

        {/* WeChat contact */}
        <View style={styles.contactRow}>
          <Ionicons
            name="chatbubble-ellipses-outline"
            size={componentSizes.icon.sm}
            color={colors.textMuted}
          />
          <Text style={styles.contactText}>反馈或建议？添加微信：{DEVELOPER_WECHAT_ID}</Text>
          <Pressable onPress={handleCopyWechat} hitSlop={8}>
            <Ionicons name="copy-outline" size={componentSizes.icon.sm} color={colors.primary} />
          </Pressable>
        </View>

        {/* Close button */}
        <Button variant="primary" onPress={onClose} style={styles.button}>
          我知道了
        </Button>
      </View>
    </BaseCenterModal>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 300,
    alignItems: 'stretch',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
    marginBottom: spacing.medium,
  },
  headerTitle: {
    fontSize: typography.title,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  scrollArea: {
    marginBottom: spacing.medium,
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
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.tight,
    paddingVertical: spacing.small,
    paddingHorizontal: spacing.small,
    backgroundColor: colors.background,
    borderRadius: borderRadius.medium,
    marginBottom: spacing.medium,
  },
  contactText: {
    flex: 1,
    fontSize: typography.caption,
    color: colors.textMuted,
  },
  button: {
    alignSelf: 'stretch',
  },
});
