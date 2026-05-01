/**
 * LoadingScreen - 统一加载界面组件
 *
 * 两种模式：
 * 1. Step mode（`steps` prop）— 启动阶段展示真实初始化步骤 checklist
 * 2. Indeterminate mode（`message` prop）— Screen 级 Suspense fallback / 通用加载
 *
 * 带有 logo 脉冲动画，与 PWA 启动画面保持一致。
 * 渲染加载状态 UI 与脉冲动画。不 import service，不含业务逻辑。
 */
import { useEffect, useState } from 'react';
import { Image, type LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
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

import { borderRadius, colors, componentSizes, shadows, spacing, typography } from '@/theme';

import appIcon from '../../../assets/pwa/icon-192.png';

export interface BootStep {
  readonly id: string;
  readonly label: string;
  readonly done: boolean;
}

interface LoadingScreenProps {
  /** 加载提示文本（indeterminate mode） */
  readonly message?: string;
  /** 是否全屏显示（默认 true） */
  readonly fullScreen?: boolean;
  /** 启动步骤列表（step mode）— 提供时展示 checklist，忽略 message */
  readonly steps?: readonly BootStep[];
  /** 错误信息 — 展示错误 UI + 重试按钮 */
  readonly error?: string | null;
  /** 重试回调 — error 存在时必须提供 */
  readonly onRetry?: () => void;
}

/** Width of the sliding bar relative to track width */
const BAR_WIDTH_RATIO = 0.3;
/** Full cycle duration for the sliding animation */
const PROGRESS_DURATION_MS = 1_500;

export function LoadingScreen({
  message = '加载中',
  fullScreen = true,
  steps,
  error,
  onRetry,
}: LoadingScreenProps) {
  const reducedMotion = useReducedMotion();
  const pulseProgress = useSharedValue(1);
  const progressValue = useSharedValue(0);
  const [trackWidth, setTrackWidth] = useState(0);

  const handleTrackLayout = (e: LayoutChangeEvent) => setTrackWidth(e.nativeEvent.layout.width);

  const barPixelWidth = trackWidth * BAR_WIDTH_RATIO;

  const isStepMode = steps != null && steps.length > 0;

  // ── Pulse animation (skip for reduced motion) ──
  useEffect(() => {
    if (reducedMotion) return;
    pulseProgress.value = withRepeat(
      withSequence(withTiming(1.05, { duration: 1000 }), withTiming(1, { duration: 1000 })),
      -1,
    );
  }, [pulseProgress, reducedMotion]);

  // ── Indeterminate progress bar (only in message mode, skip for reduced motion) ──
  useEffect(() => {
    if (reducedMotion || isStepMode || trackWidth === 0) return;
    progressValue.value = 0;
    progressValue.value = withRepeat(withTiming(1, { duration: PROGRESS_DURATION_MS }), -1);
  }, [reducedMotion, isStepMode, progressValue, trackWidth]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseProgress.value }],
    opacity: interpolate(pulseProgress.value, [1, 1.05], [1, 0.8]),
  }));

  const progressBarStyle = useAnimatedStyle(() => ({
    width: barPixelWidth,
    backgroundColor: colors.primary,
    transform: [
      { translateX: interpolate(progressValue.value, [0, 1], [-barPixelWidth, trackWidth]) },
    ],
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
          {onRetry && (
            <Pressable
              style={[styles.retryButton, { backgroundColor: colors.primary }]}
              onPress={onRetry}
              accessibilityRole="button"
              accessibilityLabel="重试"
            >
              <Text style={[styles.retryText, { color: colors.textInverse }]}>重试</Text>
            </Pressable>
          )}
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
          {/* Indeterminate progress bar */}
          <View
            style={[styles.progressTrack, { backgroundColor: colors.border }]}
            onLayout={handleTrackLayout}
          >
            <Animated.View style={[styles.progressBar, progressBarStyle]} />
          </View>
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
    height: 3,
    borderRadius: borderRadius.small,
    overflow: 'hidden',
    marginTop: spacing.large,
  },
  progressBar: {
    height: '100%',
    borderRadius: borderRadius.small,
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
  retryButton: {
    paddingVertical: spacing.small,
    paddingHorizontal: spacing.xlarge,
    borderRadius: borderRadius.medium,
  },
  retryText: {
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    fontWeight: typography.weights.medium,
  },
});
