/** Route authoritative Pictionary phases to task, transition, gallery, and ended surfaces. */

import type { PictionaryState } from '@game-judge/game-engine/games/pictionary/public';
import type React from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import type { PictionaryRoomSession } from '@/games/pictionary/model/PictionaryRoomSession';
import { colors, fixed, spacing } from '@/theme';
import { showConfirmAlert } from '@/utils/alertPresets';

import { usePictionaryStageCommand } from '../hooks/usePictionaryStageCommand';
import { usePictionaryStageDeadline } from '../hooks/usePictionaryStageDeadline';
import { PictionaryEndedStage, PictionaryGalleryStage } from './PictionaryGalleryStage';
import { PictionaryTaskStage } from './PictionaryTaskStage';

interface PictionaryStageProps {
  readonly state: PictionaryState;
  readonly mySeat: number | null;
  readonly userId: string;
  readonly isHost: boolean;
  readonly session: PictionaryRoomSession;
}

export const PictionaryStage: React.FC<PictionaryStageProps> = ({
  state,
  mySeat,
  userId,
  isHost,
  session,
}) => {
  if (state.phase === 'lobby') {
    throw new Error('[FAIL-FAST] Pictionary lobby must use the shared seat workspace');
  }
  const deadline = usePictionaryStageDeadline({
    deadlineAt: state.deadlineAt,
    phaseRevision: state.phaseRevision,
    canExpire: mySeat !== null,
    session,
  });
  const command = usePictionaryStageCommand(session);

  if (state.phase === 'gallery') {
    return (
      <PictionaryGalleryStage
        state={state}
        isHost={isHost}
        session={session}
        remainingSeconds={deadline.remainingSeconds}
      />
    );
  }
  if (state.phase === 'ended') {
    return <PictionaryEndedStage state={state} isHost={isHost} session={session} />;
  }

  const showManualFinish = isHost && state.phase === 'answering' && state.deadlineAt === null;
  const finishPhase = (): void => {
    showConfirmAlert(
      '结束这一棒？',
      '尚未完成的玩家会被记为未作答。',
      async () => {
        await command.submit('结束这一棒', { type: 'pictionary.phase.finish' });
      },
      { confirmText: '结束本棒' },
    );
  };

  return (
    <View style={styles.container}>
      <PictionaryTaskStage
        state={state}
        mySeat={mySeat}
        userId={userId}
        session={session}
        remainingSeconds={deadline.remainingSeconds}
        isExpired={deadline.isExpired}
      />
      {showManualFinish && (
        <View style={styles.manualControl}>
          <Button variant="secondary" disabled={command.isSubmitting} onPress={finishPhase}>
            结束本棒
          </Button>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 0 },
  manualControl: {
    alignItems: 'flex-end',
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.small,
    borderTopWidth: fixed.borderWidth,
    borderTopColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
});
