/**
 * ShareProgressModal - Visible lifecycle of one direct report share run
 *
 * The detail action sheet dismisses itself the moment 「分享战报」 is
 * tapped, so this modal owns the feedback from the tap until the platform
 * takes over: the generating phase shows the capture's real band count,
 * the uploading phase shows an honest spinner (uploads report no
 * progress, so no number is invented). Cancelling detaches the wait
 * without killing the background capture.
 */
import type React from 'react';
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

import type { ReportShareRun } from '../hooks/useNightReviewShare';

interface ShareProgressModalProps {
  run: ReportShareRun;
  onCancel: () => void;
}

export const ShareProgressModal: React.FC<ShareProgressModalProps> = ({ run, onCancel }) => {
  const { width: screenWidth } = useWindowDimensions();
  const contentStyle = useMemo(() => ({ width: screenWidth * 0.72 }), [screenWidth]);

  const progress = run.phase === 'capturing' ? run.progress : null;
  const fillRatio = progress !== null && progress.total > 0 ? progress.done / progress.total : 0;

  return (
    <BaseCenterModal
      visible
      onClose={onCancel}
      contentStyle={contentStyle}
      testID={TESTIDS.shareProgressModal}
    >
      <View style={styles.content}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.statusText}>
          {run.phase === 'uploading'
            ? '正在上传…'
            : progress !== null
              ? `生成中 ${progress.done}/${progress.total} 段`
              : '生成中…'}
        </Text>
        {progress !== null && (
          <View
            style={styles.progressTrack}
            accessible
            accessibilityRole="progressbar"
            accessibilityValue={{ now: progress.done, min: 0, max: progress.total }}
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
};

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
