/**
 * LoadingScreen - unified loading UI component
 *
 * Two modes:
 * 1. Step mode (`steps` prop) - shows real initialization step checklist during boot
 * 2. Indeterminate mode (`message` prop) - screen-level Suspense fallback / generic loading
 *
 * Includes logo pulse animation, consistent with the PWA splash screen.
 * Renders loading state UI and pulse animation. Does not import service, contains no business logic.
 */
import { useEffect } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  FadeIn,
  interpolate,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { IndeterminateProgressBar } from '@/components/IndeterminateProgressBar';
import { borderRadius, colors, componentSizes, shadows, spacing, typography } from '@/theme';

import appIcon from '../../../assets/pwa/icon-192.png';

interface BootStep {
  readonly id: string;
  readonly label: string;
  readonly done: boolean;
}

interface LoadingScreenProps {
  /** Loading hint text (indeterminate mode) */
  readonly message?: string;
  /** Whether to display fullscreen (default true) */
  readonly fullScreen?: boolean;
  /** Boot step list (step mode) - shows checklist when provided, ignores message */
  readonly steps?: readonly BootStep[];
  /** Error message - shows error UI + retry button */
  readonly error?: string | null;
  /** Retry callback - must be provided when error exists */
  readonly onRetry?: () => void;
  /** Return-home callback shown alongside retry in an error state */
  readonly onBack?: () => void;
}

export function LoadingScreen({
  message = '加载中',
  fullScreen = true,
  steps,
  error,
  onRetry,
  onBack,
}: LoadingScreenProps) {
  const reducedMotion = useReducedMotion();
  const pulseProgress = useSharedValue(1);

  const isStepMode = steps != null && steps.length > 0;

  // ── Pulse animation (skip for reduced motion) ──
  useEffect(() => {
    if (reducedMotion) return;
    pulseProgress.value = withRepeat(
      withSequence(withTiming(1.05, { duration: 1000 }), withTiming(1, { duration: 1000 })),
      -1,
    );
    return () => cancelAnimation(pulseProgress);
  }, [pulseProgress, reducedMotion]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseProgress.value }],
    opacity: interpolate(pulseProgress.value, [1, 1.05], [1, 0.8]),
  }));

  // Step mode: find the first incomplete step as current active
  const currentStepLabel = isStepMode ? (steps.find((s) => !s.done)?.label ?? '准备就绪') : null;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background },
        !fullScreen && styles.inlineContainer,
      ]}
    >
      <Animated.View style={[styles.iconContainer, pulseStyle]}>
        <Image source={appIcon} style={styles.icon} resizeMode="contain" />
      </Animated.View>

      {error ? (
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          <View style={styles.errorActions}>
            {onRetry && (
              <Pressable
                style={[styles.errorButton, { backgroundColor: colors.primary }]}
                onPress={onRetry}
                accessibilityRole="button"
                accessibilityLabel="重试"
              >
                <Text style={[styles.errorButtonText, { color: colors.textInverse }]}>重试</Text>
              </Pressable>
            )}
            {onBack && (
              <Pressable
                style={[styles.errorButton, styles.backButton]}
                onPress={onBack}
                accessibilityRole="button"
                accessibilityLabel="返回首页"
              >
                <Text style={[styles.errorButtonText, { color: colors.primary }]}>返回首页</Text>
              </Pressable>
            )}
          </View>
        </View>
      ) : isStepMode ? (
        <View style={styles.stepContainer}>
          {steps.map((step) => (
            <StepRow key={step.id} step={step} isActive={step.label === currentStepLabel} />
          ))}
        </View>
      ) : (
        <>
          <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
          <IndeterminateProgressBar accessibilityLabel={message} style={styles.progressTrack} />
        </>
      )}
    </View>
  );
}

// ── Step row sub-component ──────────────────────────────────────────────────

function StepRow({ step, isActive }: { readonly step: BootStep; readonly isActive: boolean }) {
  return (
    <Animated.View
      entering={FadeIn.duration(200).reduceMotion(ReduceMotion.System)}
      style={styles.stepRow}
    >
      <Text
        style={[styles.stepIndicator, { color: step.done ? colors.success : colors.textMuted }]}
      >
        {step.done ? '✓' : '○'}
      </Text>
      <Text
        style={[
          styles.stepLabel,
          {
            color: step.done ? colors.textSecondary : isActive ? colors.text : colors.textMuted,
          },
          isActive && !step.done && styles.stepLabelActive,
        ]}
      >
        {step.label}
        {isActive && !step.done ? '...' : ''}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inlineContainer: {
    flex: 0,
    paddingVertical: spacing.xxlarge + spacing.medium,
  },
  iconContainer: {
    width: componentSizes.avatar.xl,
    height: componentSizes.avatar.xl,
    borderRadius: borderRadius.xlarge,
    overflow: 'hidden',
    marginBottom: spacing.large,
    ...shadows.lg,
  },
  icon: {
    width: '100%',
    height: '100%',
  },
  message: {
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
  },
  progressTrack: {
    width: '60%',
    marginTop: spacing.large,
  },
  stepContainer: {
    alignItems: 'flex-start',
    gap: spacing.small,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
  },
  stepIndicator: {
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    width: spacing.large,
    textAlign: 'center',
  },
  stepLabel: {
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
  },
  stepLabelActive: {
    fontWeight: typography.weights.medium,
  },
  errorContainer: {
    alignItems: 'center' as const,
    gap: spacing.medium,
    paddingHorizontal: spacing.xlarge,
  },
  errorText: {
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    textAlign: 'center' as const,
  },
  errorActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.small,
  },
  errorButton: {
    paddingVertical: spacing.small,
    paddingHorizontal: spacing.xlarge,
    borderRadius: borderRadius.medium,
  },
  backButton: {
    borderWidth: 1,
    borderColor: colors.primary,
  },
  errorButtonText: {
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    fontWeight: typography.weights.medium,
  },
});
