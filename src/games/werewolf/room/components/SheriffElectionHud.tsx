/** Compact, privacy-safe sheriff-election status shown persistently above the seat board. */

import Ionicons from '@expo/vector-icons/Ionicons';
import type React from 'react';
import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { SheriffElectionPanelModel } from '@/games/werewolf/room/hooks/useSheriffElection';
import { TESTIDS } from '@/testids';
import { colors, componentSizes } from '@/theme';

import type { SheriffElectionPanelStyles } from './sheriffElectionPanel.styles';
import { getSheriffElectionSummary } from './sheriffElectionSummary';

interface SheriffElectionHudProps {
  readonly model: SheriffElectionPanelModel;
  readonly styles: SheriffElectionPanelStyles;
  readonly onOpenDetails: (() => void) | null;
}

/** Kept for backwards compatibility; prefer getSheriffElectionSummary. */
export const getHudSummary = getSheriffElectionSummary;

const SheriffElectionHudComponent: React.FC<SheriffElectionHudProps> = ({
  model,
  styles,
  onOpenDetails,
}) => {
  const content = (
    <>
      <View style={styles.hudTopRow}>
        <View style={styles.hudTitleGroup}>
          <Ionicons
            name="shield-checkmark-outline"
            size={componentSizes.icon.sm}
            color={colors.primary}
          />
          <Text style={styles.hudTitle}>警长竞选</Text>
        </View>
        <View style={styles.hudPhaseBadge} testID={TESTIDS.sheriffElectionHudPhase}>
          <Text style={styles.hudPhaseBadgeText}>{model.view.phaseTitle}</Text>
        </View>
      </View>
      <View style={styles.hudSummaryRow}>
        <Text style={styles.hudSummary} numberOfLines={2}>
          {getSheriffElectionSummary(model)}
        </Text>
        {onOpenDetails !== null && (
          <View style={styles.hudDetails} testID={TESTIDS.sheriffDetailsButton}>
            <Text style={styles.hudDetailsText}>详情</Text>
            <Ionicons name="chevron-up" size={componentSizes.icon.xs} color={colors.primary} />
          </View>
        )}
      </View>
    </>
  );

  if (onOpenDetails === null) {
    return (
      <View style={styles.hud} testID={TESTIDS.sheriffElectionHud}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.hud, pressed && styles.hudPressed]}
      onPress={onOpenDetails}
      accessibilityRole="button"
      accessibilityLabel="查看警长竞选详情"
      testID={TESTIDS.sheriffElectionHud}
    >
      {content}
    </Pressable>
  );
};

export const SheriffElectionHud = memo(SheriffElectionHudComponent);
SheriffElectionHud.displayName = 'SheriffElectionHud';
