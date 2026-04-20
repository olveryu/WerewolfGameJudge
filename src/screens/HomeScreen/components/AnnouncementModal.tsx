/**
 * AnnouncementModal — What's New 版本更新弹窗
 *
 * 展示当前版本的更新内容 + 开发者微信号。
 * 用 MMKV `lastSeenVersion` 控制只弹一次：
 * - `lastSeenVersion !== APP_VERSION` 且有对应公告条目 → 弹出
 * - 关闭时写入 APP_VERSION → 下次不弹
 * - 当前版本无公告条目 → 静默写入，不弹
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BaseCenterModal } from '@/components/BaseCenterModal';
import { Button } from '@/components/Button';
import { ANNOUNCEMENTS, DEVELOPER_WECHAT_ID } from '@/config/announcements';
import { LAST_SEEN_VERSION_KEY } from '@/config/storageKeys';
import { APP_VERSION } from '@/config/version';
import { storage } from '@/lib/storage';
import { borderRadius, colors, componentSizes, spacing, typography } from '@/theme';

export const AnnouncementModal: React.FC = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const lastSeen = storage.getString(LAST_SEEN_VERSION_KEY);
    if (lastSeen === APP_VERSION) return;

    const announcement = ANNOUNCEMENTS[APP_VERSION];
    if (announcement) {
      setVisible(true);
    } else {
      // 无公告条目，静默更新版本号
      storage.set(LAST_SEEN_VERSION_KEY, APP_VERSION);
    }
  }, []);

  const handleClose = useCallback(() => {
    setVisible(false);
    storage.set(LAST_SEEN_VERSION_KEY, APP_VERSION);
  }, []);

  const announcement = ANNOUNCEMENTS[APP_VERSION];
  if (!announcement) return null;

  return (
    <BaseCenterModal
      visible={visible}
      onClose={handleClose}
      dismissOnOverlayPress
      animationType="fade"
    >
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
        </View>

        {/* Close button */}
        <Button variant="primary" onPress={handleClose} style={styles.button}>
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
