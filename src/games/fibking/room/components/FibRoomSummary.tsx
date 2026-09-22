/** FibKing public summary and preparation status above the shared seat board. */

import Ionicons from '@expo/vector-icons/Ionicons';
import type {
  FibPhase,
  FibPreparationFailureCode,
  FibPreparationStage,
} from '@game-judge/game-engine/games/fibking/public';
import type React from 'react';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { RoomGameSummary } from '@/features/room/components/RoomGameSummary';
import { TESTIDS } from '@/testids';
import { colors, spacing, typography } from '@/theme';
import { componentSizes } from '@/theme/tokens';

interface FibRoomSummaryProps {
  readonly headerRight?: React.ReactNode;
  readonly phase: FibPhase;
  readonly occupiedSeatCount: number;
  readonly playerCount: number;
  readonly preparationStage: FibPreparationStage | null;
  readonly preparationFailureCode: FibPreparationFailureCode | null;
}

const PHASE_LABELS = {
  lobby: '等待入座',
  preparing: '准备词语',
  preparationFailed: '准备失败',
  ongoing: '描述进行中',
  ended: '本轮已结束',
} as const;

const PREPARATION_STAGE_LABELS: Readonly<Record<FibPreparationStage, string>> = {
  queued: '等待选取词语',
  selecting: '正在选取中文词语',
  finalizing: '正在检查词语和释义',
};

const PREPARATION_FAILURE_LABELS: Readonly<Record<FibPreparationFailureCode, string>> = {
  selectionFailed: '暂无可用词语，请重新准备',
  inventoryExhausted: '本桌新题已用完，请等待题库更新',
};

const FibRoomSummaryComponent: React.FC<FibRoomSummaryProps> = ({
  headerRight,
  phase,
  occupiedSeatCount,
  playerCount,
  preparationStage,
  preparationFailureCode,
}) => {
  const preparationStatus =
    phase === 'preparing'
      ? preparationStage === null
        ? null
        : PREPARATION_STAGE_LABELS[preparationStage]
      : phase === 'preparationFailed'
        ? preparationFailureCode === null
          ? null
          : PREPARATION_FAILURE_LABELS[preparationFailureCode]
        : null;
  if ((phase === 'preparing' || phase === 'preparationFailed') && preparationStatus === null) {
    throw new Error(`[FAIL-FAST] Fib summary is missing status for phase ${phase}`);
  }

  return (
    <RoomGameSummary
      headerRight={headerRight}
      icon="bulb-outline"
      title={`瞎掰王 · ${playerCount}人局`}
      subtitle={`${PHASE_LABELS[phase]} · ${occupiedSeatCount}/${playerCount} 人就座`}
    >
      {preparationStatus !== null ? (
        <View style={styles.preparationStatusRow} accessibilityLabel={preparationStatus}>
          <Ionicons
            name={phase === 'preparationFailed' ? 'alert-circle-outline' : 'time-outline'}
            size={componentSizes.icon.sm}
            color={phase === 'preparationFailed' ? colors.error : colors.primary}
          />
          <Text
            testID={TESTIDS.fibPreparationStatus}
            style={
              phase === 'preparationFailed'
                ? styles.preparationFailureText
                : styles.preparationStatusText
            }
          >
            {preparationStatus}
          </Text>
        </View>
      ) : null}
    </RoomGameSummary>
  );
};

export const FibRoomSummary = memo(FibRoomSummaryComponent);

const styles = StyleSheet.create({
  preparationStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.small,
    gap: spacing.tight,
  },
  preparationStatusText: {
    fontSize: typography.caption,
    lineHeight: typography.caption * 1.4,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
  },
  preparationFailureText: {
    fontSize: typography.caption,
    lineHeight: typography.caption * 1.4,
    fontWeight: typography.weights.semibold,
    color: colors.error,
  },
});
