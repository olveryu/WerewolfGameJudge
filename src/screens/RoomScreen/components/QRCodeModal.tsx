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
  const qrRef = useRef<{ toDataURL: (cb: (data: string) => void) => void }>(null);
  const [isSharing, setIsSharing] = useState(false);

  const getBase64 = useCallback(
    () =>
      new Promise<string>((resolve, reject) => {
        if (!qrRef.current) {
          reject(new Error('QR ref not ready'));
          return;
        }
        qrRef.current.toDataURL((data: string) => resolve(data));
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

          {/* QR Code */}
          <View style={styles.qrContainer}>
            {/* react-native-qrcode-svg renders SVG on native, but toDataURL
                needs getRef for sharing. On web we skip sharing support. */}
            <QRCode
              value={roomUrl}
              size={QR_SIZE}
              color={colors.text}
              backgroundColor={colors.surface}
              getRef={(ref: { toDataURL: (cb: (data: string) => void) => void } | null) => {
                // react-native-qrcode-svg uses getRef prop instead of React.forwardRef
                (qrRef as React.MutableRefObject<typeof ref>).current = ref;
              }}
            />
          </View>

          <Text style={styles.roomNumber}>房间号 {roomNumber}</Text>

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
