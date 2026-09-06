/** Load and present one protected Pictionary drawing without exposing its R2 object key. */

import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Modal } from '@/components/AppModal';
import { CloseButton } from '@/components/CloseButton';
import { readPictionaryDrawingDataUri } from '@/games/pictionary/services/pictionaryMediaApi';
import { borderRadius, colors, fixed, spacing, textStyles } from '@/theme';
import { roomScreenLog } from '@/utils/logger';

interface PictionaryDrawingImageProps {
  readonly roomCode: string;
  readonly entryId: string;
  readonly accessibilityLabel: string;
}

type DrawingImageState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'loaded'; readonly uri: string }
  | { readonly kind: 'failed' };

export const PictionaryDrawingImage: React.FC<PictionaryDrawingImageProps> = ({
  roomCode,
  entryId,
  accessibilityLabel,
}) => {
  const [attempt, setAttempt] = useState(0);
  const [imageState, setImageState] = useState<DrawingImageState>({ kind: 'loading' });
  const [isFullscreenVisible, setIsFullscreenVisible] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setImageState({ kind: 'loading' });
    void readPictionaryDrawingDataUri(roomCode, entryId, controller.signal).then(
      (uri) => setImageState({ kind: 'loaded', uri }),
      (error: unknown) => {
        if (controller.signal.aborted) return;
        roomScreenLog.warn('Pictionary drawing could not be loaded', { entryId, error });
        setImageState({ kind: 'failed' });
      },
    );
    return () => controller.abort();
  }, [attempt, entryId, roomCode]);

  const openFullscreen = useCallback(() => setIsFullscreenVisible(true), []);
  const closeFullscreen = useCallback(() => setIsFullscreenVisible(false), []);

  return (
    <View style={styles.frame}>
      {imageState.kind === 'loaded' ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${accessibilityLabel}，全屏查看`}
            onPress={openFullscreen}
            style={({ pressed }) => [styles.imageButton, pressed && styles.pressed]}
          >
            <Image
              source={{ uri: imageState.uri }}
              style={styles.image}
              contentFit="contain"
              accessibilityLabel={accessibilityLabel}
            />
            <View pointerEvents="none" style={styles.expandIndicator}>
              <Ionicons name="expand-outline" size={18} color={colors.textInverse} />
            </View>
          </Pressable>
          <Modal
            visible={isFullscreenVisible}
            transparent
            animationType="fade"
            statusBarTranslucent
            onRequestClose={closeFullscreen}
          >
            <SafeAreaView style={styles.fullscreenOverlay}>
              <Image
                source={{ uri: imageState.uri }}
                style={styles.fullscreenImage}
                contentFit="contain"
                accessibilityLabel={`${accessibilityLabel}全屏预览`}
              />
              <CloseButton
                onPress={closeFullscreen}
                variant="onOverlay"
                style={styles.closeButton}
              />
            </SafeAreaView>
          </Modal>
        </>
      ) : imageState.kind === 'loading' ? (
        <View style={styles.status} accessibilityLabel="正在加载画作">
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.statusText}>正在加载画作</Text>
        </View>
      ) : (
        <View style={styles.status}>
          <Ionicons name="image-outline" size={32} color={colors.textMuted} />
          <Text style={styles.statusText}>画作加载失败</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="重新加载画作"
            onPress={() => setAttempt((current) => current + 1)}
            style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
          >
            <Ionicons name="refresh-outline" size={18} color={colors.primary} />
            <Text style={styles.retryText}>重试</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    aspectRatio: 4 / 3,
    overflow: 'hidden',
    borderRadius: borderRadius.medium,
    borderWidth: fixed.borderWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  imageButton: { width: '100%', height: '100%' },
  image: { width: '100%', height: '100%' },
  expandIndicator: {
    position: 'absolute',
    right: spacing.small,
    bottom: spacing.small,
    width: fixed.minTouchTarget,
    height: fixed.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.full,
    backgroundColor: colors.overlay,
  },
  fullscreenOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.medium,
    backgroundColor: colors.text,
  },
  fullscreenImage: { width: '100%', height: '100%' },
  closeButton: { top: spacing.medium, right: spacing.medium },
  status: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.small,
    padding: spacing.medium,
  },
  statusText: { ...textStyles.secondary, color: colors.textSecondary },
  retryButton: {
    minHeight: fixed.minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.tight,
    paddingHorizontal: spacing.medium,
  },
  retryText: { ...textStyles.secondarySemibold, color: colors.primary },
  pressed: { opacity: fixed.activeOpacity },
});
