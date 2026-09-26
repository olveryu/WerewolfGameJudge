/** Route authoritative Pictionary phases to task, transition, gallery, and ended surfaces. */

import type { PictionaryState } from '@game-judge/game-engine/games/pictionary/public';
import type React from 'react';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { RoomSeatBoardModel } from '@/features/room/model/RoomShellModel';
import type { PictionaryRoomSession } from '@/games/pictionary/model/PictionaryRoomSession';

import {
  type PictionaryTaskInput,
  usePictionaryAutoSubmission,
} from '../hooks/usePictionaryAutoSubmission';
import { usePictionaryStageDeadline } from '../hooks/usePictionaryStageDeadline';
import { PictionaryBotControlStrip } from './PictionaryBotControlStrip';
import { PictionaryEndedStage, PictionaryGalleryStage } from './PictionaryGalleryStage';
import { PictionaryTaskStage } from './PictionaryTaskStage';

interface PictionaryStageProps {
  readonly state: PictionaryState;
  readonly effectiveSeat: number | null;
  readonly controlledSeat: number | null;
  readonly userId: string;
  readonly isHost: boolean;
  readonly seatModel: RoomSeatBoardModel;
  readonly session: PictionaryRoomSession;
}

export const PictionaryStage: React.FC<PictionaryStageProps> = (props) => (
  <PictionaryStageContent
    key={`${props.state.roundId}:${props.state.stepIndex}:${props.userId}`}
    {...props}
  />
);

const PictionaryStageContent: React.FC<PictionaryStageProps> = ({
  state,
  effectiveSeat,
  controlledSeat,
  userId,
  isHost,
  seatModel,
  session,
}) => {
  if (state.phase === 'lobby') {
    throw new Error('[FAIL-FAST] Pictionary lobby must use the shared seat workspace');
  }
  const deadline = usePictionaryStageDeadline({
    deadlineAt: state.deadlineAt,
    phaseRevision: state.phaseRevision,
    canExpire: isHost || effectiveSeat !== null,
    session,
  });
  const [inputs] = useState(() => new Map<number, PictionaryTaskInput>());
  const autoSubmission = usePictionaryAutoSubmission(state, userId, session, inputs);

  if (state.phase === 'gallery') {
    return (
      <View style={styles.container}>
        <PictionaryGalleryStage
          state={state}
          isHost={isHost}
          session={session}
          remainingSeconds={deadline.remainingSeconds}
        />
      </View>
    );
  }
  if (state.phase === 'ended' || state.phase === 'aborted') {
    return (
      <View style={styles.container}>
        <PictionaryEndedStage state={state} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <PictionaryBotControlStrip model={seatModel} />
      <PictionaryTaskStage
        inputs={inputs}
        state={state}
        effectiveSeat={effectiveSeat}
        controlledSeat={controlledSeat}
        userId={userId}
        session={session}
        remainingSeconds={deadline.remainingSeconds}
        isExpired={deadline.isExpired}
        autoSubmission={autoSubmission}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 0 },
});
