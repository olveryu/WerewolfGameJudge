/**
 * GalleryControls — Shared gallery playback controls (G5).
 *
 * Unified order and variants: prev (icon) / play-pause (secondary) /
 * next (icon, primary at the end) / reveal-all (ghost).
 * Games keep their own nouns ('上一项' vs '上一段') and command wiring.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import type React from 'react';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { colors, componentSizes, spacing } from '@/theme';

interface GalleryControlsProps {
  readonly onPrev: () => void;
  readonly onNext: () => void;
  /** null hides the play/pause button (e.g. untimed gallery). */
  readonly onTogglePlay: (() => void) | null;
  readonly onRevealAll: () => void;
  readonly isFirst: boolean;
  readonly isLast: boolean;
  readonly isPlaying: boolean;
  readonly isSubmitting: boolean;
  readonly prevLabel: string;
  readonly nextLabel: string;
  /** When isLast, the next button becomes primary with this label. */
  readonly nextEndLabel?: string;
  readonly playLabel: string;
  readonly pauseLabel: string;
  readonly prevTestID?: string;
  readonly nextTestID?: string;
}

const GalleryControlsComponent: React.FC<GalleryControlsProps> = ({
  onPrev,
  onNext,
  onTogglePlay,
  onRevealAll,
  isFirst,
  isLast,
  isPlaying,
  isSubmitting,
  prevLabel,
  nextLabel,
  nextEndLabel,
  playLabel,
  pauseLabel,
  prevTestID,
  nextTestID,
}) => {
  const showEndLabel = isLast && nextEndLabel !== undefined;
  return (
    <View style={styles.controls}>
      <Button
        variant="icon"
        size="md"
        disabled={isFirst || isSubmitting}
        onPress={onPrev}
        accessibilityLabel={prevLabel}
        testID={prevTestID}
      >
        <Ionicons name="play-skip-back" size={componentSizes.icon.md} color={colors.text} />
      </Button>
      {onTogglePlay !== null && (
        <Button
          variant="secondary"
          size="md"
          disabled={isSubmitting}
          onPress={onTogglePlay}
          accessibilityLabel={isPlaying ? pauseLabel : playLabel}
          icon={
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={componentSizes.icon.sm}
              color={colors.primary}
            />
          }
        >
          {isPlaying ? pauseLabel : playLabel}
        </Button>
      )}
      <Button
        variant={showEndLabel ? 'primary' : 'icon'}
        size="md"
        disabled={isSubmitting}
        onPress={onNext}
        accessibilityLabel={showEndLabel ? nextEndLabel : nextLabel}
        testID={nextTestID}
      >
        {showEndLabel ? (
          nextEndLabel
        ) : (
          <Ionicons name="play-skip-forward" size={componentSizes.icon.md} color={colors.text} />
        )}
      </Button>
      <Button variant="ghost" size="sm" disabled={isSubmitting} onPress={onRevealAll}>
        全部揭晓
      </Button>
    </View>
  );
};

export const GalleryControls = memo(GalleryControlsComponent);
GalleryControls.displayName = 'GalleryControls';

const styles = StyleSheet.create({
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.small,
  },
});
