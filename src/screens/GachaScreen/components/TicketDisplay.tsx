/**
 * TicketDisplay — 券数展示卡片
 *
 * 左侧图标 + 大号数字 + 标签。
 * 底部嵌入 PityProgressBar。
 * golden 模式有金色调背景和边框。
 */
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { borderRadius, colors, fixed, spacing, textStyles, typography, withAlpha } from '@/theme';

import { PityProgressBar } from './PityProgressBar';

// ─── Constants ──────────────────────────────────────────────────────────

const GOLDEN_BORDER = '#FFD700';
const GOLDEN_ICON = '#DAA520';

// ─── Props ──────────────────────────────────────────────────────────────

interface TicketDisplayProps {
  count: number;
  label: string;
  pity: number;
  pityThreshold: number;
  golden?: boolean;
  reducedMotion?: boolean | null;
}

// ─── Component ──────────────────────────────────────────────────────────

export function TicketDisplay({
  count,
  label,
  pity,
  pityThreshold,
  golden,
  reducedMotion,
}: TicketDisplayProps) {
  const iconName: React.ComponentProps<typeof Ionicons>['name'] = golden
    ? 'star'
    : 'ticket-outline';
  const iconColor = golden ? GOLDEN_ICON : colors.primary;

  return (
    <View style={[styles.container, golden && styles.containerGolden]}>
      <View style={styles.topRow}>
        <View style={[styles.iconWrap, golden && styles.iconWrapGolden]}>
          <Ionicons name={iconName} size={15} color={iconColor} />
        </View>
        <Text style={styles.count}>{count}</Text>
        <Text style={styles.label}>{label}券</Text>
      </View>
      <PityProgressBar
        pity={pity}
        threshold={pityThreshold}
        golden={golden}
        reducedMotion={reducedMotion}
      />
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: borderRadius.medium,
    borderWidth: fixed.borderWidth,
    borderColor: colors.borderLight,
    padding: spacing.small + spacing.micro,
    gap: spacing.tight + spacing.micro,
  },
  containerGolden: {
    borderColor: withAlpha(GOLDEN_BORDER, 0.25),
    backgroundColor: withAlpha(GOLDEN_BORDER, 0.04),
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.small,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(colors.primary, 0.1),
  },
  iconWrapGolden: {
    backgroundColor: withAlpha(GOLDEN_BORDER, 0.1),
  },
  count: {
    fontSize: typography.title,
    fontWeight: typography.weights.bold,
    color: colors.text,
    lineHeight: 26,
  },
  label: {
    ...textStyles.captionSmall,
    color: colors.textSecondary,
    marginLeft: 'auto',
  },
});
