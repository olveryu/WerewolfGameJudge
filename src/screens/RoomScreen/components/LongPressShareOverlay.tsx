/**
 * LongPressShareOverlay — 微信小程序 web-view 内长按保存图片的遮罩
 *
 * 全屏展示截图 `<img>`，用户长按触发微信原生菜单（保存到相册 / 转发）。
 * 仅在 web 平台渲染（小程序 web-view 环境），native 侧不会挂载此组件。
 */
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { TESTIDS } from '@/testids';
import { spacing, textStyles, typography } from '@/theme';

/** Fixed overlay colors — always dark regardless of app theme */
const OVERLAY_BG = 'rgba(0, 0, 0, 0.92)';
const OVERLAY_TEXT = '#ffffff';

interface LongPressShareOverlayProps {
  /** Base64-encoded PNG image data (without data: prefix) */
  base64: string;
  onClose: () => void;
}

const LongPressShareOverlayComponent: React.FC<LongPressShareOverlayProps> = ({
  base64,
  onClose,
}) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const byteChars = atob(base64);
    const byteArray = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      byteArray[i] = byteChars.charCodeAt(i);
    }
    const blob = new Blob([byteArray], { type: 'image/png' });
    const url = URL.createObjectURL(blob);
    blobUrlRef.current = url;
    setBlobUrl(url);

    return () => {
      URL.revokeObjectURL(url);
      blobUrlRef.current = null;
    };
  }, [base64]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  if (Platform.OS !== 'web' || !blobUrl) return null;

  return (
    <View style={styles.overlay} testID={TESTIDS.longPressShareOverlay}>
      <View style={styles.header}>
        <Text style={styles.hint}>长按图片保存到相册</Text>
        <TouchableOpacity
          onPress={handleClose}
          style={styles.closeButton}
          accessibilityLabel="关闭"
        >
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.scrollContainer}>
        {/* Use raw <img> so WeChat web-view long-press menu works (RN Image won't trigger it) */}
        <img src={blobUrl} alt="战报" style={imgStyle} />
      </View>
    </View>
  );
};

export const LongPressShareOverlay = memo(LongPressShareOverlayComponent);

// ─── Styles ─────────────────────────────────────────────────────────────────

/** Raw CSS style for the <img> element (not RN StyleSheet — web only) */
const imgStyle: React.CSSProperties = {
  width: '100%',
  height: 'auto',
  display: 'block',
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: OVERLAY_BG,
    zIndex: 9999,
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.large,
    paddingVertical: spacing.medium,
  },
  hint: {
    ...textStyles.body,
    color: OVERLAY_TEXT,
    fontSize: typography.body,
  },
  closeButton: {
    padding: spacing.small,
  },
  closeText: {
    color: OVERLAY_TEXT,
    fontSize: typography.title,
  },
  scrollContainer: {
    flex: 1,
    // Web-only: enable scrolling for long images
    ...(Platform.OS === 'web' ? { overflowY: 'auto' as never } : {}),
  },
});
