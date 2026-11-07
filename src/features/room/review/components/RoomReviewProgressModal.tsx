/**
 * The visible lifecycle of a share run started outside the review dialog
 * (a host flow's 「分享战报」). Preparing and uploading are honest
 * spinners — neither reports progress, so no number is invented; the
 * capturing phase shows the capture's real count. Cancelling detaches
 * the wait without killing the background capture.
 */

import { useMemo } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import { BaseCenterModal } from '@/components/BaseCenterModal';
import { TESTIDS } from '@/testids';
import { borderRadius, colors, spacing, textStyles } from '@/theme';

import type { RoomReviewShareRun } from '../useRoomReviewExport';

/** One status line for a run, shared by the modal and the dialog footer. */
export function formatReviewShareRun(run: RoomReviewShareRun): string {
  switch (run.phase) {
    case 'preparing':
      return '正在准备…';
    case 'capturing':
      return `正在生成 ${run.done}/${run.total}`;
    case 'uploading':
      return '正在上传…';
  }
}

export function RoomReviewProgressModal({
  run,
  onCancel,
}: {
  readonly run: RoomReviewShareRun;
  readonly onCancel: () => void;
}) {
  const { width: windowWidth } = useWindowDimensions();
  const contentStyle = useMemo(() => ({ width: windowWidth * 0.72 }), [windowWidth]);
  const fillRatio = run.phase === 'capturing' && run.total > 0 ? run.done / run.total : null;

  return (
    <BaseCenterModal
      visible
      onClose={onCancel}
      contentStyle={contentStyle}
      testID={TESTIDS.roomReviewProgress}
    >
      <View style={styles.content}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.statusText}>{formatReviewShareRun(run)}</Text>
        {run.phase === 'capturing' && fillRatio !== null && (
          <View
            style={styles.progressTrack}
            accessible
            accessibilityRole="progressbar"
            accessibilityValue={{ now: run.done, min: 0, max: run.total }}
          >
            <View style={[styles.progressFill, { width: `${fillRatio * 100}%` }]} />
          </View>
        )}
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={onCancel}
          accessible
          accessibilityRole="button"
          accessibilityLabel="取消分享"
        >
          <Text style={styles.cancelButtonText}>取消</Text>
        </TouchableOpacity>
      </View>
    </BaseCenterModal>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    paddingVertical: spacing.medium,
  },
  statusText: {
    ...textStyles.body,
    color: colors.text,
    marginTop: spacing.medium,
    textAlign: 'center',
  },
  progressTrack: {
    alignSelf: 'stretch',
    height: spacing.tight,
    borderRadius: borderRadius.small,
    backgroundColor: colors.border,
    marginTop: spacing.medium,
    overflow: 'hidden',
  },
  progressFill: {
    height: spacing.tight,
    borderRadius: borderRadius.small,
    backgroundColor: colors.primary,
  },
  cancelButton: {
    marginTop: spacing.large,
    paddingVertical: spacing.small,
    paddingHorizontal: spacing.large,
  },
  cancelButtonText: {
    ...textStyles.body,
    color: colors.textSecondary,
  },
});
