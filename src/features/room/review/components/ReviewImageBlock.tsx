/**
 * A drawing block. The drawing loads through the review's shared asset
 * store; the block shows a skeleton while it loads, the game's message
 * when the drawing is honestly unavailable, and a retry when the load or
 * the decode failed. In the export stage it reports readiness to the
 * gate: decoded or unavailable is ready, a failure blocks the export.
 */

import { type ReactNode, useContext, useEffect, useSyncExternalStore } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { borderRadius, fixed, spacing, typography } from '@/theme';

import { REPORT_PALETTE } from '../reportTheme';
import { ReviewExportGateContext, useReviewAssetStore } from '../reviewAssetStore';
import type { ReviewImageBlock as ReviewImageBlockModel } from '../types';

export function ReviewImageBlock({
  block,
  blockId,
}: {
  readonly block: ReviewImageBlockModel;
  readonly blockId: string;
}) {
  const store = useReviewAssetStore();
  const gate = useContext(ReviewExportGateContext);
  const asset = useSyncExternalStore(store.subscribe, () => store.read(block.assetId));

  useEffect(() => {
    if (asset === null) store.request(block.assetId, block.load);
  }, [asset, block.assetId, block.load, store]);

  useEffect(() => {
    if (gate === null || asset === null) return;
    if (asset.status === 'unavailable') gate.report(blockId, 'ready');
    if (asset.status === 'failed') gate.report(blockId, 'failed');
  }, [asset, blockId, gate]);

  const frame = [styles.frame, { aspectRatio: block.aspectRatio }];
  let body: ReactNode;
  if (asset === null || asset.status === 'loading') {
    body = (
      <View style={[frame, styles.placeholder]}>
        <ActivityIndicator color={REPORT_PALETTE.textMuted} />
      </View>
    );
  } else if (asset.status === 'loaded') {
    body = (
      <Image
        source={{ uri: asset.dataUri }}
        style={frame}
        resizeMode="contain"
        accessibilityLabel={block.caption}
        onLoad={() => gate?.report(blockId, 'ready')}
        onError={() => store.markDecodeFailed(block.assetId)}
      />
    );
  } else if (asset.status === 'unavailable') {
    body = (
      <View style={[frame, styles.placeholder]}>
        <Text style={styles.placeholderText}>{asset.message}</Text>
      </View>
    );
  } else {
    body = (
      <Pressable
        style={[frame, styles.placeholder]}
        onPress={() => store.retry(block.assetId, block.load)}
        accessibilityRole="button"
        accessibilityLabel={`${block.caption}加载失败，点击重试`}
      >
        <Text style={styles.placeholderText}>加载失败 · 点击重试</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.block}>
      <Text style={styles.caption}>{block.caption}</Text>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: spacing.tight,
  },
  frame: {
    width: '100%',
    borderRadius: borderRadius.small,
    borderWidth: fixed.borderWidth,
    borderColor: REPORT_PALETTE.cardBorder,
    backgroundColor: REPORT_PALETTE.background,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.medium,
  },
  placeholderText: {
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    color: REPORT_PALETTE.textMuted,
    textAlign: 'center',
  },
  caption: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    color: REPORT_PALETTE.textSecondary,
  },
});
