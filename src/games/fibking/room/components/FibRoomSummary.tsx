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
  readonly playerCount: number;
  readonly preparationStage: FibPreparationStage | null;
  readonly preparationFailureCode: FibPreparationFailureCode | null;
}

const PREPARATION_STAGE_LABELS: Readonly<Record<FibPreparationStage, string>> = {
  queued: '等待选取词语',
  selecting: '正在选取中文词语',
  finalizing: '正在检查词语和释义',
};

const INVENTORY_EXHAUSTED_LABEL = '本桌新题已用完，请等待题库更新';

const FibRoomSummaryComponent: React.FC<FibRoomSummaryProps> = ({
  headerRight,
  phase,
  playerCount,
  preparationStage,
  preparationFailureCode,
}) => {
  // The summary carries configuration only. Preparation stage detail
  // stays while preparing; of the failure codes only inventory
  // exhaustion is explained here — a plain selection failure is the
  // host console's retry primary and the players' bottom message.
  const preparationStatus =
    phase === 'preparing'
      ? preparationStage === null
        ? null
        : PREPARATION_STAGE_LABELS[preparationStage]
      : phase === 'preparationFailed' && preparationFailureCode === 'inventoryExhausted'
        ? INVENTORY_EXHAUSTED_LABEL
        : null;
  if (phase === 'preparing' && preparationStatus === null) {
    throw new Error(`[FAIL-FAST] Fib summary is missing status for phase ${phase}`);
  }
  if (phase === 'preparationFailed' && preparationFailureCode === null) {
    throw new Error(`[FAIL-FAST] Fib summary is missing status for phase ${phase}`);
  }

  return (
    <RoomGameSummary
      headerRight={headerRight}
      icon="bulb-outline"
      title={`瞎掰王 · ${playerCount}人局`}
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
