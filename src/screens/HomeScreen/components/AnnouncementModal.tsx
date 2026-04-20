/**
 * AnnouncementModal — What's New 版本更新弹窗
 *
 * 受控组件：由父级传入 visible / onClose。
 * 展示当前版本的更新内容 + 开发者微信号。
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { toast } from 'sonner-native';

import { BaseCenterModal } from '@/components/BaseCenterModal';
import { Button } from '@/components/Button';
import { ANNOUNCEMENTS, DEVELOPER_WECHAT_ID } from '@/config/announcements';
import { APP_VERSION } from '@/config/version';
import { borderRadius, colors, componentSizes, spacing, typography } from '@/theme';

interface AnnouncementModalProps {
  visible: boolean;
  onClose: () => void;
}

export const AnnouncementModal: React.FC<AnnouncementModalProps> = ({ visible, onClose }) => {
  const announcement = ANNOUNCEMENTS[APP_VERSION];

  const handleCopyWechat = useCallback(() => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(DEVELOPER_WECHAT_ID);
      toast.success('已复制微信号');
    }
  }, []);

  if (!announcement) return null;

  return (
    <BaseCenterModal visible={visible} onClose={onClose} dismissOnOverlayPress animationType="fade">
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Ionicons name="sparkles" size={componentSizes.icon.md} color={colors.primary} />
          <Text style={styles.title}>{announcement.title}</Text>
        </View>

        {/* Update items */}
        <View style={styles.itemList}>
          {announcement.items.map((item) => (
            <View key={item} style={styles.itemRow}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.itemText}>{item}</Text>
            </View>
          ))}
        </View>

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
    width: 300,
    alignItems: 'stretch',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
    marginBottom: spacing.medium,
  },
  title: {
    fontSize: typography.title,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  itemList: {
    marginBottom: spacing.medium,
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
