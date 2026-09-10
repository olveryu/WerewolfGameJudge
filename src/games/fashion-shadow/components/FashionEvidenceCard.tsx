/** FashionEvidenceCard — visual evidence dossier for public/destroyed investigation outcomes. */
import type React from 'react';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { borderRadius, fixed, spacing, typography } from '@/theme';
import { fashionShadowColors } from '@/theme/fashionShadowColors';

import { useFashionCompactLayout } from './useFashionCompactLayout';

type FashionEvidenceStatus = 'pending' | 'public' | 'destroyed';

interface FashionEvidenceCardProps {
  readonly evidenceId: string;
  readonly title: string;
  readonly location: string;
  readonly summary: string;
  readonly implications: readonly string[];
  readonly status: FashionEvidenceStatus;
}

const statusLabel: Readonly<Record<FashionEvidenceStatus, string>> = {
  pending: '待表决',
  public: 'PUBLIC / 已公开',
  destroyed: 'DESTROYED / 已销毁',
};

export const FashionEvidenceCard: React.FC<FashionEvidenceCardProps> = ({
  evidenceId,
  title,
  location,
  summary,
  implications,
  status,
}) => {
  const compactLayout = useFashionCompactLayout();
  const reducedMotion = useReducedMotion();
  const reveal = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(reveal);
    if (reducedMotion) {
      reveal.value = 1;
      return;
    }

    reveal.value = 0;
    reveal.value = withTiming(1, { duration: 360 });
    return () => cancelAnimation(reveal);
  }, [evidenceId, reducedMotion, reveal, status]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: reveal.value,
    transform: [{ translateY: (1 - reveal.value) * 12 }],
  }));

  return (
    <Animated.View
      style={[
        styles.card,
        compactLayout ? styles.compactCard : null,
        status === 'public' ? styles.publicCard : null,
        status === 'destroyed' ? styles.destroyedCard : null,
        animatedStyle,
      ]}
      accessible
      accessibilityLabel={`${evidenceId} ${title}，${location}，状态：${statusLabel[status]}`}
    >
      <View style={styles.topRow}>
        <Text style={styles.id}>{evidenceId}</Text>
        <Text
          style={[
            styles.status,
            status === 'public' ? styles.publicText : null,
            status === 'destroyed' ? styles.destroyedText : null,
          ]}
        >
          {statusLabel[status]}
        </Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.location}>{location} · CASE EVIDENCE</Text>
      <View style={styles.scanLine} />
      <Text style={styles.summaryLabel}>
        {status === 'destroyed' ? '销毁前案件摘要' : '证据事实摘要'}
      </Text>
      <Text style={styles.summary}>{summary}</Text>
      {status === 'public' && implications.length > 0 ? (
        <Text style={styles.implication}>直接角色关联：{implications.join('、')}</Text>
      ) : null}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: '46%',
    borderRadius: borderRadius.medium,
    borderWidth: fixed.borderWidth,
    borderColor: fashionShadowColors.border,
    backgroundColor: fashionShadowColors.surfaceRaised,
    padding: spacing.medium,
    gap: spacing.small,
  },
  compactCard: { flexBasis: '100%', minWidth: '100%' },
  publicCard: {
    borderColor: fashionShadowColors.neonCyan,
    backgroundColor: fashionShadowColors.neonCyanSoft,
  },
  destroyedCard: {
    borderColor: fashionShadowColors.danger,
    backgroundColor: fashionShadowColors.dangerSoft,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.small,
  },
  id: {
    color: fashionShadowColors.neonPink,
    fontSize: typography.subtitle,
    lineHeight: typography.lineHeights.subtitle,
    fontWeight: typography.weights.bold,
  },
  status: {
    flexShrink: 1,
    color: fashionShadowColors.textMuted,
    fontSize: typography.captionSmall,
    lineHeight: typography.lineHeights.captionSmall,
    fontWeight: typography.weights.bold,
    textAlign: 'right',
  },
  publicText: {
    color: fashionShadowColors.neonCyan,
  },
  destroyedText: {
    color: fashionShadowColors.danger,
  },
  title: {
    color: fashionShadowColors.text,
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.semibold,
  },
  location: {
    color: fashionShadowColors.textMuted,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
  },
  scanLine: {
    borderTopWidth: fixed.borderWidth,
    borderTopColor: fashionShadowColors.neonCyanSoft,
  },
  summaryLabel: {
    color: fashionShadowColors.neonCyan,
    fontSize: typography.captionSmall,
    lineHeight: typography.lineHeights.captionSmall,
    fontWeight: typography.weights.bold,
  },
  summary: {
    color: fashionShadowColors.textSecondary,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
  },
  implication: {
    color: fashionShadowColors.neonPink,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.semibold,
  },
});
