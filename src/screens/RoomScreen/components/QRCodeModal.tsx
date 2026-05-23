/**
 * QRCodeModal - 房间二维码分享弹窗
 *
 * 展示房间 URL 对应的 QR 码 + 房间号。
 * 支持「分享」（生成临时 PNG → 系统分享 sheet）和「复制链接」两种操作。
 * 小程序 web-view 内改为显示微信转发引导。
 * 纯展示组件：不 import service，不含业务逻辑判断。
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import QRCodeLib from 'qrcode';
import type React from 'react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Platform, StyleSheet, Text, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { BaseCenterModal } from '@/components/BaseCenterModal';
import { Button } from '@/components/Button';
import { TESTIDS } from '@/testids';
import {
  borderRadius,
  colors,
  componentSizes,
  fixed,
  shadows,
  spacing,
  textStyles,
  typography,
} from '@/theme';
import { log } from '@/utils/logger';
import { isMiniProgram } from '@/utils/miniProgram';

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
  roomCode: string;
  roomUrl: string;
  onShareImage: (getBase64: () => Promise<string>) => void;
  onCopyLink: () => void;
  onClose: () => void;
}

/** QR 码尺寸（逻辑像素） */
const QR_SIZE = 160;
/** QR 中心 logo 尺寸 */
const QR_LOGO_SIZE = 44;
/** QR 中心 logo 外边距（白色背景区域） */
const QR_LOGO_MARGIN = 4;

/**
 * Render QR module data as a compact SVG string.
 * Each dark module is drawn as a 1×1 path segment (crispEdges).
 */
function renderQrSvg(
  modules: { size: number; data: Uint8Array },
  size: number,
  darkColor: string,
  lightColor: string,
): string {
  const n = modules.size;
  let darkPath = '';
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (modules.data[y * n + x]) {
        darkPath += `M${x} ${y}h1v1h-1z`;
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" width="${size}" height="${size}" shape-rendering="crispEdges"><rect width="${n}" height="${n}" fill="${lightColor}"/><path fill="${darkColor}" d="${darkPath}"/></svg>`;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports -- Metro require for local PNG asset
const appLogo = require('../../../../assets/pwa/icon-192.png') as number;

const QRCodeModalComponent: React.FC<QRCodeModalProps> = ({
  visible,
  roomCode,
  roomUrl,
  onShareImage,
  onCopyLink,
  onClose,
}) => {
  const shareCardRef = useRef<View>(null);
  const [isSharing, setIsSharing] = useState(false);
  const preCapturedRef = useRef<string | null>(null);
  const [isPreCaptureReady, setIsPreCaptureReady] = useState(Platform.OS !== 'web');

  const qrDataUrl = useMemo(() => {
    if (!roomUrl) return '';
    // qrcode.toString is async but we need sync — use the underlying create() + render
    const segments = QRCodeLib.create(roomUrl, { errorCorrectionLevel: 'H' });
    const svgStr = renderQrSvg(segments.modules, QR_SIZE, colors.primary, colors.surface);
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgStr)}`;
  }, [roomUrl]);

  // Pre-capture the share card on web so navigator.share() can be called
  // within the user-activation window (avoids NotAllowedError).
  // Skip in mini-program: share card view is not rendered (uses WeChat forward guide instead).
  useEffect(() => {
    if (!visible || Platform.OS !== 'web' || isMiniProgram()) return;
    preCapturedRef.current = null;
    setIsPreCaptureReady(false);
    // Use rAF + timeout to ensure the modal's layout & QR code have rendered
    // (Android WebView needs more time than 300ms)
    let cancelled = false;
    const frameId = requestAnimationFrame(() => {
      const timer = setTimeout(() => {
        if (cancelled) return;
        captureShareCard(shareCardRef)
          .then((b64) => {
            if (cancelled) return;
            preCapturedRef.current = b64;
            setIsPreCaptureReady(true);
          })
          .catch((e: unknown) => {
            if (cancelled) return;
            // Pre-capture failed; enable button anyway for on-demand fallback
            log.warn('Pre-capture share card failed', {
              error: e instanceof Error ? e.message : String(e),
            });
            setIsPreCaptureReady(true);
          });
      }, 500);
      cleanupTimer = timer;
    });
    let cleanupTimer: ReturnType<typeof setTimeout> | null = null;
    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
      if (cleanupTimer) clearTimeout(cleanupTimer);
    };
  }, [visible]);

  const getBase64 = useCallback(async () => {
    if (preCapturedRef.current) return preCapturedRef.current;
    return captureShareCard(shareCardRef);
  }, []);

  const handleShare = useCallback(() => {
    if (isSharing) return;
    setIsSharing(true);
    onShareImage(getBase64);
    // Reset after a short delay to cover async sharing flow
    setTimeout(() => setIsSharing(false), 2000);
  }, [isSharing, onShareImage, getBase64]);

  const inMiniProgram = isMiniProgram();

  return (
    <BaseCenterModal
      visible={visible}
      onClose={onClose}
      dismissOnOverlayPress
      contentStyle={styles.modalBox}
      testID={TESTIDS.qrCodeModal}
    >
      <Text style={styles.title}>分享房间</Text>

      {inMiniProgram ? (
        <>
          {/* Mini program: guide user to use WeChat native forward */}
          <View style={styles.shareCard}>
            <Ionicons
              name="paper-plane-outline"
              size={componentSizes.icon.xl * 2}
              color={colors.primary}
              style={styles.guideIcon}
            />
            <Text style={styles.roomCode}>房间号 {roomCode}</Text>
            <Text style={styles.guideStep}>1. 点击右上角 ··· 按钮</Text>
            <Text style={styles.guideStep}>2. 选择「转发给朋友」</Text>
            <Text style={styles.guideStep}>好友打开直接进入房间 🎉</Text>
          </View>
          <View style={styles.buttonRow}>
            <Button variant="primary" onPress={onClose} accessibilityLabel="关闭">
              我知道了
            </Button>
          </View>
        </>
      ) : (
        <>
          {/* Normal web/native: QR code + share/copy buttons */}
          <View ref={shareCardRef} collapsable={false} style={styles.shareCard}>
            <View style={styles.qrContainer}>
              <View style={styles.qrWrapper}>
                <Image source={{ uri: qrDataUrl }} style={styles.qrImage} />
                <View style={styles.logoContainer}>
                  <Image source={appLogo} style={styles.logoImage} />
                </View>
              </View>
            </View>
            <Text style={styles.roomCode}>房间号 {roomCode}</Text>
            <Text style={styles.hint}>扫一扫二维码，加入房间</Text>
          </View>
          <View style={styles.buttonRow}>
            <Button variant="primary" onPress={onCopyLink}>
              复制链接（推荐）
            </Button>
            <Button
              variant="secondary"
              onPress={handleShare}
              loading={isSharing || !isPreCaptureReady}
              testID={TESTIDS.qrCodeShareButton}
            >
              分享图片
            </Button>
            <Button variant="secondary" onPress={onClose} accessibilityLabel="关闭">
              关闭
            </Button>
          </View>
        </>
      )}
    </BaseCenterModal>
  );
};

export const QRCodeModal = memo(QRCodeModalComponent);

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  modalBox: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xlarge,
    padding: spacing.xlarge,
    alignItems: 'center',
    minWidth: 280,
    ...shadows.md,
  },
  title: {
    ...textStyles.titleBold,
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
  qrImage: {
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
  roomCode: {
    ...textStyles.subtitleSemibold,
    color: colors.text,
    marginBottom: spacing.tight,
  },
  hint: {
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    color: colors.textSecondary,
    marginBottom: spacing.large,
  },
  guideIcon: {
    marginBottom: spacing.medium,
  },
  guideStep: {
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
    color: colors.textSecondary,
    textAlign: 'center' as const,
    marginBottom: spacing.tight,
  },
  buttonRow: {
    gap: spacing.small,
    alignSelf: 'stretch',
  },
  buttonDisabled: {
    opacity: fixed.disabledOpacity,
  },
  closeButton: {
    backgroundColor: colors.surfaceHover,
    paddingVertical: spacing.medium,
    borderRadius: borderRadius.full,
    borderWidth: fixed.borderWidth,
    borderColor: colors.border,
    alignItems: 'center',
  },
  closeButtonText: {
    ...textStyles.bodySemibold,
    color: colors.text,
  },
});
