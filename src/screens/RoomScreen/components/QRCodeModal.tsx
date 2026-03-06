/**
 * QRCodeModal - 房间二维码分享弹窗
 *
 * 展示房间 URL 对应的 QR 码 + 房间号。
 * 支持「分享」（生成临时 PNG → 系统分享 sheet）和「复制链接」两种操作。
 * 纯展示组件：不 import service，不含业务逻辑判断。
 */
import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { captureRef } from 'react-native-view-shot';

import { TESTIDS } from '@/testids';
import { borderRadius, shadows, spacing, type ThemeColors, typography, useColors } from '@/theme';
import { fixed } from '@/theme/tokens';

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

  const getBase64 = useCallback(
    () =>
      captureRef(shareCardRef, {
        format: 'png',
        result: 'base64',
        quality: 1,
      }),
    [],
  );

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
              <QRCode
                value={roomUrl}
                size={QR_SIZE}
                color={colors.primary}
                backgroundColor={colors.surface}
                ecl="H"
                logo={appLogo}
                logoSize={QR_LOGO_SIZE}
                logoMargin={QR_LOGO_MARGIN}
                logoBackgroundColor={colors.surface}
                logoBorderRadius={QR_LOGO_SIZE / 4}
              />
            </View>
            <Text style={styles.roomNumber}>房间号 {roomNumber}</Text>
            <Text style={styles.hint}>扫一扫二维码 加入房间</Text>
          </View>

          {/* Action buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.shareButton, isSharing && styles.buttonDisabled]}
              onPress={handleShare}
              activeOpacity={isSharing ? 1 : 0.7}
              accessibilityState={{ disabled: isSharing }}
              testID={TESTIDS.qrCodeShareButton}
            >
              <Text style={styles.shareButtonText}>{isSharing ? '分享中...' : '分享图片'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.copyButton} onPress={onCopyLink} activeOpacity={0.7}>
              <Text style={styles.copyButtonText}>复制链接</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.7}>
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
  return {
    overlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
    },
    modalBox: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.xlarge,
      padding: spacing.xlarge,
      alignItems: 'center' as const,
      minWidth: 280,
      ...shadows.md,
    },
    title: {
      fontSize: typography.title,
      fontWeight: typography.weights.bold,
      color: colors.text,
      marginBottom: spacing.medium,
    },
    shareCard: {
      backgroundColor: colors.surface,
      alignItems: 'center' as const,
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
    roomNumber: {
      fontSize: typography.subtitle,
      fontWeight: typography.weights.semibold,
      color: colors.text,
      marginBottom: spacing.tight,
    },
    hint: {
      fontSize: typography.secondary,
      color: colors.textSecondary,
      marginBottom: spacing.large,
    },
    buttonRow: {
      flexDirection: 'row' as const,
      gap: spacing.small,
      marginBottom: spacing.small,
    },
    shareButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.large,
      paddingVertical: spacing.medium,
      borderRadius: borderRadius.medium,
      alignItems: 'center' as const,
    },
    shareButtonText: {
      color: colors.textInverse,
      fontSize: typography.body,
      fontWeight: typography.weights.semibold,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    copyButton: {
      backgroundColor: colors.surfaceHover,
      paddingHorizontal: spacing.large,
      paddingVertical: spacing.medium,
      borderRadius: borderRadius.medium,
      borderWidth: fixed.borderWidth,
      borderColor: colors.border,
      alignItems: 'center' as const,
    },
    copyButtonText: {
      color: colors.text,
      fontSize: typography.body,
      fontWeight: typography.weights.semibold,
    },
    closeButton: {
      paddingVertical: spacing.small,
      paddingHorizontal: spacing.large,
    },
    closeButtonText: {
      color: colors.textSecondary,
      fontSize: typography.secondary,
    },
  };
}
