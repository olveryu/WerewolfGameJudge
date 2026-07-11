/**
 * QRCodeModal - room QR code share modal
 *
 * Displays the QR code for the room URL plus the room code.
 * Supports "Share" (generate temporary PNG -> system share sheet) and "Copy link".
 * Inside WeChat mini-program web-view, shows a WeChat forward guide instead.
 * Pure presentational component: imports no service, contains no business logic.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import type React from 'react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Image, Platform, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { captureRef } from 'react-native-view-shot';

import { BaseCenterModal } from '@/components/BaseCenterModal';
import { Button } from '@/components/Button';
import type { RoomShareModel } from '@/features/room/model/RoomShare';
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
    const index = dataUrl.indexOf(prefix);
    if (index < 0) throw new Error('Captured share card is not a base64 data URL');
    return dataUrl.slice(index + prefix.length);
  }
  return captureRef(ref, { format: 'png', result: 'base64', quality: 1 });
}

interface QRCodeModalProps {
  readonly model: RoomShareModel;
}

/** QR code size (logical pixels) */
const QR_SIZE = 160;
/** QR center logo size */
const QR_LOGO_SIZE = 44;
/** QR center logo margin (white background area) */
const QR_LOGO_MARGIN = 4;

// eslint-disable-next-line @typescript-eslint/no-require-imports -- Metro require for local PNG asset
const appLogo = require('../../../../assets/pwa/icon-192.png') as number;

const QRCodeModalComponent: React.FC<QRCodeModalProps> = ({ model }) => {
  const shareCardRef = useRef<View>(null);
  const [isSharing, setIsSharing] = useState(false);
  const preCapturedRef = useRef<string | null>(null);
  const [isPreCaptureReady, setIsPreCaptureReady] = useState(Platform.OS !== 'web');
  const [isShareCardLaidOut, setIsShareCardLaidOut] = useState(false);
  const [isLogoLoaded, setIsLogoLoaded] = useState(false);
  const shareSubmissionRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    if (!model.isVisible) return;
    preCapturedRef.current = null;
    setIsPreCaptureReady(Platform.OS !== 'web');
  }, [model.isVisible]);

  useEffect(() => {
    if (
      !model.isVisible ||
      Platform.OS !== 'web' ||
      isMiniProgram() ||
      !isShareCardLaidOut ||
      !isLogoLoaded
    ) {
      return;
    }
    let cancelled = false;
    const frameId = requestAnimationFrame(() => {
      void captureShareCard(shareCardRef)
        .then((base64) => {
          if (cancelled) return;
          preCapturedRef.current = base64;
          setIsPreCaptureReady(true);
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          log.warn('Pre-capture share card failed', {
            error: error instanceof Error ? error.message : String(error),
          });
          setIsPreCaptureReady(true);
        });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
    };
  }, [isLogoLoaded, isShareCardLaidOut, model.isVisible]);

  const getBase64 = useCallback(async () => {
    if (preCapturedRef.current) return preCapturedRef.current;
    return captureShareCard(shareCardRef);
  }, []);

  const handleShare = useCallback(async (): Promise<void> => {
    if (shareSubmissionRef.current !== null) {
      throw new Error('Room QR image share is already in progress');
    }
    setIsSharing(true);
    const submission = model.shareImage(getBase64);
    shareSubmissionRef.current = submission;
    try {
      await submission;
    } finally {
      shareSubmissionRef.current = null;
      setIsSharing(false);
    }
  }, [getBase64, model]);

  const inMiniProgram = isMiniProgram();

  return (
    <BaseCenterModal
      visible={model.isVisible}
      onClose={model.close}
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
            <Text style={styles.roomCode}>房间号 {model.roomCode}</Text>
            <Text style={styles.guideStep}>1. 点击右上角 ··· 按钮</Text>
            <Text style={styles.guideStep}>2. 选择「转发给朋友」</Text>
            <Text style={styles.guideStep}>好友打开直接进入房间 🎉</Text>
          </View>
          <View style={styles.buttonRow}>
            <Button variant="primary" onPress={model.close} accessibilityLabel="关闭">
              我知道了
            </Button>
          </View>
        </>
      ) : (
        <>
          {/* Normal web/native: QR code + share/copy buttons */}
          <View
            ref={shareCardRef}
            collapsable={false}
            style={styles.shareCard}
            onLayout={() => setIsShareCardLaidOut(true)}
          >
            <View style={styles.qrContainer}>
              <View style={styles.qrWrapper}>
                <QRCode
                  value={model.roomUrl}
                  size={QR_SIZE}
                  color={colors.primary}
                  backgroundColor={colors.surface}
                  ecl="H"
                />
                <View style={styles.logoContainer}>
                  <Image
                    source={appLogo}
                    style={styles.logoImage}
                    onLoadEnd={() => setIsLogoLoaded(true)}
                  />
                </View>
              </View>
            </View>
            <Text style={styles.roomCode}>房间号 {model.roomCode}</Text>
            <Text style={styles.hint}>扫一扫二维码，加入房间</Text>
          </View>
          <View style={styles.buttonRow}>
            <Button
              variant="primary"
              onPress={() => {
                void model.copyLink();
              }}
            >
              复制链接（推荐）
            </Button>
            <Button
              variant="secondary"
              onPress={() => {
                void handleShare();
              }}
              loading={isSharing || !isPreCaptureReady}
              testID={TESTIDS.qrCodeShareButton}
            >
              分享图片
            </Button>
            <Button variant="secondary" onPress={model.close} accessibilityLabel="关闭">
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
