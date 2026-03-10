/**
 * QRCodeModal - 房间二维码分享弹窗
 *
 * 展示房间 URL 对应的 QR 码 + 房间号。
 * 支持「分享」（生成临时 PNG → 系统分享 sheet）和「复制链接」两种操作。
 * 纯展示组件：不 import service，不含业务逻辑判断。
 */
import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import { Image, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { captureRef } from 'react-native-view-shot';

import { TESTIDS } from '@/testids';
import { borderRadius, shadows, spacing, type ThemeColors, typography, useColors } from '@/theme';
import { fixed } from '@/theme/tokens';

/**
 * Capture the share card View as a base64-encoded PNG.
 *
 * - Native: `captureRef` from react-native-view-shot.
 * - Web: `html2canvas` directly — react-native-view-shot's `captureRef` calls
 *   `findNodeHandle` which is unsupported on web.  html2canvas is already a
 *   transitive dependency of react-native-view-shot.
 */
async function captureShareCard(ref: React.RefObject<View | null>): Promise<string> {
  if (Platform.OS === 'web') {
    const html2canvas = (await import('html2canvas')).default;
    const node = ref.current as unknown as HTMLElement;
    if (!node) throw new Error('Share card ref not ready');
    const canvas = await html2canvas(node, { backgroundColor: null });
    const dataUrl = canvas.toDataURL('image/png');
    // Strip "data:image/png;base64," prefix → raw base64
    const prefix = 'base64,';
    const idx = dataUrl.indexOf(prefix);
    return idx >= 0 ? dataUrl.slice(idx + prefix.length) : dataUrl;
  }
  return captureRef(ref, { format: 'png', result: 'base64', quality: 1 });
}

interface QRCodeModalProps {
  visible: boolean;
  roomNumber: string;
  roomUrl: string;
  onShareImage: (getBase64: () => Promise<string>) => void;
  onCopyLink: () => void;
  onClose: () => void;
}

/** QR 码尺寸（逻辑像素） */
const QR_SIZE = 200;
/** QR 中心 logo 尺寸 */
const QR_LOGO_SIZE = 44;
/** QR 中心 logo 外边距（白色背景区域） */
const QR_LOGO_MARGIN = 4;

// eslint-disable-next-line @typescript-eslint/no-require-imports -- Metro require for local PNG asset
const appLogo = require('../../../../assets/pwa/icon-192.png') as number;

const QRCodeModalComponent: React.FC<QRCodeModalProps> = ({
  visible,
  roomNumber,
  roomUrl,
  onShareImage,
  onCopyLink,
  onClose,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const shareCardRef = useRef<View>(null);
  const [isSharing, setIsSharing] = useState(false);

  const getBase64 = useCallback(() => captureShareCard(shareCardRef), []);

  const handleShare = useCallback(() => {
    if (isSharing) return;
    setIsSharing(true);
    onShareImage(getBase64);
    // Reset after a short delay to cover async sharing flow
    setTimeout(() => setIsSharing(false), 2000);
  }, [isSharing, onShareImage, getBase64]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
        testID={TESTIDS.qrCodeModal}
      >
        <TouchableOpacity style={styles.modalBox} activeOpacity={1} onPress={undefined}>
          <Text style={styles.title}>分享房间</Text>

          {/* Share card: captured as image via react-native-view-shot */}
          <View ref={shareCardRef} collapsable={false} style={styles.shareCard}>
            <View style={styles.qrContainer}>
              {/* Logo is overlaid as a separate View instead of using the
                  library's logo prop, because html2canvas cannot render
                  SVG <image> elements embedded by react-native-qrcode-svg. */}
              <View style={styles.qrWrapper}>
                <QRCode
                  value={roomUrl}
                  size={QR_SIZE}
                  color={colors.primary}
                  backgroundColor={colors.surface}
                  ecl="H"
                />
                <View style={styles.logoContainer}>
                  <Image source={appLogo} style={styles.logoImage} />
                </View>
              </View>
            </View>
            <Text style={styles.roomNumber}>房间号 {roomNumber}</Text>
            <Text style={styles.hint}>扫一扫二维码，加入房间</Text>
          </View>

          {/* Action buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.shareButton, isSharing && styles.buttonDisabled]}
              onPress={handleShare}
              activeOpacity={isSharing ? 1 : fixed.activeOpacity}
              accessibilityState={{ disabled: isSharing }}
              testID={TESTIDS.qrCodeShareButton}
            >
              <Text style={styles.shareButtonText}>{isSharing ? '分享中…' : '分享图片'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.copyButton}
              onPress={onCopyLink}
              activeOpacity={fixed.activeOpacity}
            >
              <Text style={styles.copyButtonText}>复制链接</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            activeOpacity={fixed.activeOpacity}
            accessibilityLabel="关闭"
          >
            <Text style={styles.closeButtonText}>关闭</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

export const QRCodeModal = memo(QRCodeModalComponent);

// ─── Styles ─────────────────────────────────────────────────────────────────

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalBox: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.xlarge,
      padding: spacing.xlarge,
      alignItems: 'center',
      minWidth: 280,
      ...shadows.md,
    },
    title: {
      fontSize: typography.title,
      lineHeight: typography.lineHeights.title,
      fontWeight: typography.weights.bold,
      color: colors.text,
      marginBottom: spacing.medium,
    },
    shareCard: {
      backgroundColor: colors.surface,
      alignItems: 'center',
      paddingHorizontal: spacing.large,
      paddingTop: spacing.medium,
      paddingBottom: spacing.small,
    },
    qrContainer: {
      padding: spacing.medium,
      backgroundColor: colors.surface,
      borderRadius: borderRadius.large,
      borderWidth: fixed.borderWidth,
      borderColor: colors.border,
      marginBottom: spacing.medium,
    },
    qrWrapper: {
      position: 'relative',
      width: QR_SIZE,
      height: QR_SIZE,
    },
    logoContainer: {
      position: 'absolute',
      top: (QR_SIZE - QR_LOGO_SIZE - QR_LOGO_MARGIN * 2) / 2,
      left: (QR_SIZE - QR_LOGO_SIZE - QR_LOGO_MARGIN * 2) / 2,
      width: QR_LOGO_SIZE + QR_LOGO_MARGIN * 2,
      height: QR_LOGO_SIZE + QR_LOGO_MARGIN * 2,
      backgroundColor: colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: borderRadius.medium,
    },
    logoImage: {
      width: QR_LOGO_SIZE,
      height: QR_LOGO_SIZE,
      borderRadius: borderRadius.medium,
    },
    roomNumber: {
      fontSize: typography.subtitle,
      lineHeight: typography.lineHeights.subtitle,
      fontWeight: typography.weights.semibold,
      color: colors.text,
      marginBottom: spacing.tight,
    },
    hint: {
      fontSize: typography.secondary,
      lineHeight: typography.lineHeights.secondary,
      color: colors.textSecondary,
      marginBottom: spacing.large,
    },
    buttonRow: {
      flexDirection: 'row',
      gap: spacing.small,
      marginBottom: spacing.small,
    },
    shareButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.large,
      paddingVertical: spacing.medium,
      borderRadius: borderRadius.full,
      alignItems: 'center',
    },
    shareButtonText: {
      color: colors.textInverse,
      fontSize: typography.body,
      lineHeight: typography.lineHeights.body,
      fontWeight: typography.weights.semibold,
    },
    buttonDisabled: {
      opacity: fixed.disabledOpacity,
    },
    copyButton: {
      backgroundColor: colors.surfaceHover,
      paddingHorizontal: spacing.large,
      paddingVertical: spacing.medium,
      borderRadius: borderRadius.full,
      borderWidth: fixed.borderWidth,
      borderColor: colors.border,
      alignItems: 'center',
    },
    copyButtonText: {
      color: colors.text,
      fontSize: typography.body,
      lineHeight: typography.lineHeights.body,
      fontWeight: typography.weights.semibold,
    },
    closeButton: {
      paddingVertical: spacing.small,
      paddingHorizontal: spacing.large,
    },
    closeButtonText: {
      color: colors.textSecondary,
      fontSize: typography.secondary,
      lineHeight: typography.lineHeights.secondary,
    },
  });
}
