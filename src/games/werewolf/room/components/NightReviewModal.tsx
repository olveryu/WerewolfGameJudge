/**
 * NightReviewModal - Night action review modal (for judge/spectator)
 *
 * Displays a summary of all night-1 actions and the true identity of every player.
 * Renders Modal UI with pre-built data; no service imports, no business logic.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { Team } from '@game-judge/game-engine/games/werewolf/public';
import { formatSeat } from '@game-judge/game-engine/platform/room/formatSeat';
import type React from 'react';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { BaseCenterModal } from '@/components/BaseCenterModal';
import { CloseButton } from '@/components/CloseButton';
import { STATUS_ICONS } from '@/config/iconTokens';
import { TESTIDS } from '@/testids';
import {
  borderRadius,
  colors,
  componentSizes,
  fixed,
  spacing,
  textStyles,
  typography,
  withAlpha,
} from '@/theme';

import type { NightReviewData, NightReviewIdentity } from '../NightReview.helpers';

interface NightReviewModalProps {
  visible: boolean;
  data: NightReviewData;
  onClose: () => void;
}

interface IdentityGroup {
  readonly key: string;
  readonly label: string;
  readonly color: string;
  readonly items: NightReviewIdentity[];
}

const TEAM_ORDER: readonly (Team | null)[] = [Team.Wolf, Team.Good, Team.Third, null];

function teamMeta(team: Team | null): { label: string; color: string } {
  switch (team) {
    case Team.Wolf:
      return { label: '狼人阵营', color: colors.wolf };
    case Team.Good:
      return { label: '好人阵营', color: colors.god };
    case Team.Third:
      return { label: '第三方', color: colors.third };
    default:
      return { label: '未分配', color: colors.textMuted };
  }
}

function groupIdentities(identities: NightReviewIdentity[]): IdentityGroup[] {
  return TEAM_ORDER.map((team) => {
    const items = identities.filter((identity) => identity.team === team);
    const meta = teamMeta(team);
    return { key: team ?? 'none', label: meta.label, color: meta.color, items };
  }).filter((group) => group.items.length > 0);
}

export const NightReviewModal: React.FC<NightReviewModalProps> = ({ visible, data, onClose }) => {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const contentStyle = useMemo(
    () => ({ width: screenWidth * 0.88, maxHeight: screenHeight * 0.75 }),
    [screenWidth, screenHeight],
  );
  const identityGroups = useMemo(() => groupIdentities(data.identities), [data.identities]);

  return (
    <BaseCenterModal
      visible={visible}
      onClose={onClose}
      contentStyle={contentStyle}
      testID={TESTIDS.nightReviewModal}
      dismissOnOverlayPress
    >
      <CloseButton onPress={onClose} />

      <Text style={styles.title}>本局复盘</Text>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Fair play reminder */}
        <View style={styles.disclaimerBar}>
          <Ionicons
            name={STATUS_ICONS.WARNING}
            size={componentSizes.icon.sm}
            color={colors.warning}
          />
          <Text style={styles.disclaimerText}>仅供裁判及观战者参考，请勿外泄</Text>
        </View>

        {/* Action summary section */}
        <Text style={styles.sectionTitle}>行动摘要</Text>
        {data.actionLines.map((line, i) => (
          <Text key={`action-${i}`} style={styles.line}>
            {line}
          </Text>
        ))}

        {/* Divider */}
        <View style={styles.divider} />

        {/* Identity table section, grouped by team */}
        <Text style={styles.sectionTitle}>全员身份</Text>
        {identityGroups.map((group) => (
          <View key={group.key} style={styles.identityGroup}>
            <View style={[styles.groupBadge, { backgroundColor: withAlpha(group.color, 0.15) }]}>
              <View style={[styles.groupDot, { backgroundColor: group.color }]} />
              <Text style={[styles.groupLabel, { color: group.color }]}>{group.label}</Text>
            </View>
            {group.items.map((identity) => (
              <Text key={`identity-${identity.seat}`} style={styles.line}>
                {formatSeat(identity.seat)}：{identity.roleName}
              </Text>
            ))}
          </View>
        ))}
      </ScrollView>
    </BaseCenterModal>
  );
};

const styles = StyleSheet.create({
  title: {
    fontSize: typography.subtitle,
    lineHeight: typography.lineHeights.subtitle,
    fontWeight: typography.weights.bold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.medium,
  },
  scrollView: {
    flex: 1,
  },
  sectionTitle: {
    ...textStyles.bodySemibold,
    color: colors.primary,
    marginBottom: spacing.small,
  },
  disclaimerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.small,
    backgroundColor: withAlpha(colors.warning, 0.12),
    borderRadius: borderRadius.medium,
    paddingVertical: spacing.small,
    paddingHorizontal: spacing.medium,
    marginBottom: spacing.medium,
  },
  disclaimerText: {
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    fontWeight: typography.weights.semibold,
    color: colors.warning,
  },
  line: {
    fontSize: typography.secondary,
    color: colors.text,
    lineHeight: typography.lineHeights.secondary,
    paddingLeft: spacing.small,
  },
  divider: {
    height: fixed.divider,
    backgroundColor: colors.border,
    marginVertical: spacing.medium,
  },
  identityGroup: {
    gap: spacing.tight,
    marginBottom: spacing.small,
  },
  groupBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.micro,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.micro,
  },
  groupDot: {
    width: 6,
    height: 6,
    borderRadius: borderRadius.full,
  },
  groupLabel: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.semibold,
  },
});
