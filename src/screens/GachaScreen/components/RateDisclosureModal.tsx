/**
 * RateDisclosureModal — 概率公示弹窗
 *
 * 表格展示普通抽 / 黄金抽各稀有度概率，底部保底规则说明。
 * 数据直接读 game-engine 导出的 NORMAL_RATES / GOLDEN_RATES，无 hardcode。
 */
import {
  GOLDEN_RATES,
  NORMAL_RATES,
  PITY_THRESHOLD,
} from '@werewolf/game-engine/growth/gachaProbability';
import type { Rarity } from '@werewolf/game-engine/growth/rewardCatalog';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BaseCenterModal } from '@/components/BaseCenterModal';
import { Button } from '@/components/Button';
import { RARITY_VISUAL } from '@/config/rarityVisual';
import { borderRadius, colors, spacing, typography, withAlpha } from '@/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const COLUMNS: readonly Rarity[] = ['legendary', 'epic', 'rare', 'common'];

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
            <Text style={styles.labelText}>✨ 普通</Text>
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
            <Text style={styles.labelText}>⭐ 黄金</Text>
          </View>
          {COLUMNS.map((r) => (
            <View key={r} style={styles.dataCell}>
              <Text style={styles.dataText}>{GOLDEN_RATES[r]}%</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Rules */}
      <View style={styles.rulesSection}>
        <Text style={styles.ruleText}>
          · {PITY_THRESHOLD} 次保底：普通抽保底稀有，黄金抽保底史诗
        </Text>
        <Text style={styles.ruleText}>· 已拥有物品不会重复，池清空后自动升级</Text>
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
    dataText: {
      fontSize: typography.caption,
      color: colors.textSecondary,
      fontVariant: ['tabular-nums'],
    },

    // ── Rules ──
    rulesSection: {
      gap: spacing.tight,
    },
    ruleText: {
      fontSize: typography.captionSmall,
      color: colors.textMuted,
      lineHeight: typography.captionSmall * 1.5,
    },

    // ── Close ──
    closeButton: {
      alignSelf: 'stretch',
    },
  });
}
