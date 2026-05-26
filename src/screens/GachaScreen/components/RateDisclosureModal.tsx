/**
 * RateDisclosureModal — probability disclosure modal
 *
 * Table shows per-rarity probabilities for normal / golden draws, with pity rules at the bottom.
 * Data reads directly from game-engine's NORMAL_RATES / GOLDEN_RATES exports, no hardcoding.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  GOLDEN_RATES,
  NORMAL_RATES,
  PITY_THRESHOLD,
} from '@werewolf/game-engine/growth/gachaProbability';
import type { Rarity } from '@werewolf/game-engine/growth/rewardCatalog';
import { SHARD_VALUES } from '@werewolf/game-engine/growth/rewardCatalog';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BaseCenterModal } from '@/components/BaseCenterModal';
import { Button } from '@/components/Button';
import { GACHA_ICONS, UI_ICONS } from '@/config/iconTokens';
import { RARITY_VISUAL } from '@/config/rarityVisual';
import { borderRadius, colors, spacing, typography, withAlpha } from '@/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const COLUMNS: readonly Rarity[] = ['legendary', 'epic', 'rare', 'common'];

/** Draw count columns for reward source table */
const DRAW_COUNTS = [1, 2, 3, 4, 5] as const;

/** Per-game normal / daily login probabilities (%) — matches rollNormalDraws weights */
const NORMAL_DRAW_PROBS = [30, 35, 20, 10, 5] as const;

/** Level-up golden probabilities (%) — matches rollGoldenDraws weights */
const GOLDEN_DRAW_PROBS = [35, 35, 18, 8, 4] as const;

/** Probability disclosure modal. */
export const RateDisclosureModal = React.memo<Props>(({ visible, onClose }) => {
  const styles = useMemo(() => createStyles(), []);

  return (
    <BaseCenterModal
      visible={visible}
      onClose={onClose}
      dismissOnOverlayPress
      contentStyle={styles.content}
    >
      <Text style={styles.title}>概率公示</Text>

      {/* Table */}
      <View style={styles.table}>
        {/* Header row */}
        <View style={styles.row}>
          <View style={styles.labelCell} />
          {COLUMNS.map((r) => (
            <View key={r} style={styles.headerCell}>
              <Text style={[styles.headerText, { color: RARITY_VISUAL[r].color }]}>
                {RARITY_VISUAL[r].label}
              </Text>
            </View>
          ))}
        </View>

        {/* Normal row */}
        <View style={[styles.row, styles.dataRow]}>
          <View style={styles.labelCell}>
            <View style={styles.labelRow}>
              <Ionicons name={GACHA_ICONS.NORMAL_DRAW} size={14} color={colors.textSecondary} />
              <Text style={styles.labelText}>普通</Text>
            </View>
          </View>
          {COLUMNS.map((r) => (
            <View key={r} style={styles.dataCell}>
              <Text style={styles.dataText}>{NORMAL_RATES[r]}%</Text>
            </View>
          ))}
        </View>

        {/* Golden row */}
        <View style={[styles.row, styles.dataRow, styles.goldenRow]}>
          <View style={styles.labelCell}>
            <View style={styles.labelRow}>
              <Ionicons name={GACHA_ICONS.GOLDEN_DRAW} size={14} color={colors.warning} />
              <Text style={styles.labelText}>黄金</Text>
            </View>
          </View>
          {COLUMNS.map((r) => (
            <View key={r} style={styles.dataCell}>
              <Text style={styles.dataText}>{GOLDEN_RATES[r]}%</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Shard conversion table */}
      <Text style={styles.sectionTitle}>重复碎片转化</Text>
      <View style={styles.table}>
        <View style={styles.row}>
          <View style={styles.labelCell} />
          {COLUMNS.map((r) => (
            <View key={r} style={styles.headerCell}>
              <Text style={[styles.headerText, { color: RARITY_VISUAL[r].color }]}>
                {RARITY_VISUAL[r].label}
              </Text>
            </View>
          ))}
        </View>
        <View style={[styles.row, styles.dataRow]}>
          <View style={styles.labelCell}>
            <Text style={styles.labelText}>碎片</Text>
          </View>
          {COLUMNS.map((r) => (
            <View key={r} style={styles.dataCell}>
              <Text style={styles.dataText}>{SHARD_VALUES[r]}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Reward source probability table */}
      <Text style={styles.sectionTitle}>券获取概率</Text>
      <View style={styles.table}>
        {/* Header: draw counts 1–5 */}
        <View style={styles.row}>
          <View style={styles.labelCell} />
          {DRAW_COUNTS.map((n) => (
            <View key={n} style={styles.headerCell}>
              <Text style={styles.headerText}>{n}张</Text>
            </View>
          ))}
        </View>
        {/* Normal draws (per-game + daily share same distribution) */}
        <View style={[styles.row, styles.dataRow]}>
          <View style={styles.labelCell}>
            <View style={styles.labelRow}>
              <Ionicons name={GACHA_ICONS.NORMAL_DRAW} size={14} color={colors.textSecondary} />
              <Text style={styles.labelText}>普通</Text>
            </View>
            <Text style={styles.labelSub}>每局/每日</Text>
          </View>
          {NORMAL_DRAW_PROBS.map((p, i) => (
            <View key={i} style={styles.dataCell}>
              <Text style={styles.dataText}>{p}%</Text>
            </View>
          ))}
        </View>
        {/* Level-up golden */}
        <View style={[styles.row, styles.dataRow, styles.goldenRow]}>
          <View style={styles.labelCell}>
            <View style={styles.labelRow}>
              <Ionicons name={GACHA_ICONS.GOLDEN_DRAW} size={14} color={colors.warning} />
              <Text style={styles.labelText}>黄金</Text>
            </View>
            <Text style={styles.labelSub}>升级获得</Text>
          </View>
          {GOLDEN_DRAW_PROBS.map((p, i) => (
            <View key={i} style={styles.dataCell}>
              <Text style={styles.dataText}>{p}%</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Rules */}
      <Text style={styles.sectionTitle}>规则</Text>
      <View style={styles.rulesSection}>
        <View style={styles.ruleRow}>
          <Ionicons name={UI_ICONS.INFO} size={14} color={colors.textMuted} />
          <Text style={styles.ruleText}>
            {PITY_THRESHOLD} 次保底：普通抽保底稀有，黄金抽保底史诗
          </Text>
        </View>
      </View>

      <Button variant="secondary" onPress={onClose} style={styles.closeButton}>
        知道了
      </Button>
    </BaseCenterModal>
  );
});

RateDisclosureModal.displayName = 'RateDisclosureModal';

function createStyles() {
  return StyleSheet.create({
    content: {
      width: 320,
      padding: spacing.large,
      gap: spacing.medium,
    },
    title: {
      fontSize: typography.heading,
      fontWeight: typography.weights.semibold,
      color: colors.text,
      textAlign: 'center',
    },
    sectionTitle: {
      fontSize: typography.caption,
      fontWeight: typography.weights.medium,
      color: colors.textSecondary,
    },

    // ── Table ──
    table: {
      borderRadius: borderRadius.medium,
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    row: {
      flexDirection: 'row',
    },
    dataRow: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    goldenRow: {
      backgroundColor: withAlpha(colors.warning, 0.05),
    },
    labelCell: {
      width: 72,
      paddingVertical: spacing.small,
      paddingHorizontal: spacing.small,
      justifyContent: 'center',
    },
    labelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    headerCell: {
      flex: 1,
      paddingVertical: spacing.small,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dataCell: {
      flex: 1,
      paddingVertical: spacing.small,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerText: {
      fontSize: typography.captionSmall,
      fontWeight: typography.weights.semibold,
    },
    labelText: {
      fontSize: typography.caption,
      fontWeight: typography.weights.medium,
      color: colors.text,
    },
    labelSub: {
      fontSize: typography.captionSmall,
      color: colors.textMuted,
      marginTop: spacing.micro,
    },
    dataText: {
      fontSize: typography.caption,
      color: colors.textSecondary,
      fontVariant: ['tabular-nums'],
    },

    // ── Rules ──
    rulesSection: {
      gap: spacing.tight,
    },
    ruleRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 6,
    },
    ruleText: {
      fontSize: typography.captionSmall,
      color: colors.textMuted,
      lineHeight: typography.captionSmall * 1.5,
      flex: 1,
    },

    // ── Close ──
    closeButton: {
      alignSelf: 'stretch',
    },
  });
}
