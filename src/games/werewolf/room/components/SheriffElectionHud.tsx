/** Compact, privacy-safe sheriff-election status shown persistently above the seat board. */

import Ionicons from '@expo/vector-icons/Ionicons';
import type { SheriffElectionResult } from '@game-judge/game-engine/games/werewolf/public';
import { formatSeat } from '@game-judge/game-engine/platform/room/formatSeat';
import type React from 'react';
import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { SheriffElectionPanelModel } from '@/games/werewolf/room/hooks/useSheriffElection';
import { TESTIDS } from '@/testids';
import { colors, componentSizes } from '@/theme';

import type { SheriffElectionPanelStyles } from './sheriffElectionPanel.styles';

interface SheriffElectionHudProps {
  readonly model: SheriffElectionPanelModel;
  readonly styles: SheriffElectionPanelStyles;
  readonly onOpenDetails: (() => void) | null;
}

function getResultSummary(result: SheriffElectionResult): string {
  return result.kind === 'elected' ? `${formatSeat(result.sheriffSeat)} 当选警长` : '本局没有警长';
}

function getHudSummary(model: SheriffElectionPanelModel): string {
  const { view } = model;
  if (view.finalResult !== null) return getResultSummary(view.finalResult);
  if (view.speakingOrder.length > 0) {
    return `发言顺序：${view.speakingOrder.map(formatSeat).join(' → ')}`;
  }
  if (view.voteProgress !== null) {
    return `${view.voteProgress.submittedCount}/${view.voteProgress.eligibleCount} 人已投票`;
  }
  if (view.canCancelRegistration) return '你已报名，可在底部取消报名';
  if (view.candidateRecords !== null) {
    return `${view.candidateRecords.activeCandidateSeats.length} 位候选人留在警上`;
  }
  return view.phaseDescription;
}

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
        <Text style={styles.hudSummary} numberOfLines={1}>
          {getHudSummary(model)}
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
