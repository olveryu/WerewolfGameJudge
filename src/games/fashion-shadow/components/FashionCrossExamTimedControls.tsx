/** Cross-examination timer boundary that keeps 1s ticks out of the full room screen. */
import type {
  FashionEvidenceId,
  FashionPublicState,
} from '@game-judge/game-engine/games/fashion-shadow/public';
import type React from 'react';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';

import { FashionButton as Button } from './FashionButton';
import { FashionCountdown } from './FashionCountdown';
import { FashionCrossExamTranscript } from './FashionCrossExamTranscript';

interface FashionCrossExamTimedControlsProps {
  readonly state: FashionPublicState;
  readonly mySeat: number | null;
  readonly isHost: boolean;
  readonly hasBots: boolean;
  readonly isSubmitting: boolean;
  readonly children?: React.ReactNode;
  readonly onSend: (message: string, evidenceId?: FashionEvidenceId) => Promise<boolean>;
  readonly onFinish: () => void;
}

function getRemainingMs(endsAt: number | null): number {
  return endsAt === null ? 0 : Math.max(0, endsAt - Date.now());
}

export const FashionCrossExamTimedControls: React.FC<FashionCrossExamTimedControlsProps> = ({
  state,
  mySeat,
  isHost,
  hasBots,
  isSubmitting,
  children,
  onSend,
  onFinish,
}) => {
  const endsAt = state.interrogation?.endsAt ?? null;
  const [remainingMs, setRemainingMs] = useState(() => getRemainingMs(endsAt));

  useEffect(() => {
    setRemainingMs(getRemainingMs(endsAt));
    if (endsAt === null || endsAt <= Date.now()) return undefined;

    const timer = setInterval(() => {
      const nextRemainingMs = getRemainingMs(endsAt);
      setRemainingMs(nextRemainingMs);
      if (nextRemainingMs === 0) clearInterval(timer);
    }, 1000);

    return () => clearInterval(timer);
  }, [endsAt]);

  return (
    <View style={styles.actions}>
      <FashionCountdown remainingMs={remainingMs} match={state.interrogation?.match ?? 1} />
      {children}
      <FashionCrossExamTranscript
        state={state}
        mySeat={mySeat}
        mode="live"
        remainingMs={remainingMs}
        isSubmitting={isSubmitting}
        onSend={onSend}
      />
      {isHost ? (
        <Button
          variant="primary"
          onPress={onFinish}
          disabled={(remainingMs > 0 && !hasBots) || isSubmitting}
        >
          {state.interrogation?.match === 1
            ? hasBots && remainingMs > 0
              ? '体验模式：立即进入第 2 组'
              : '时间结束，进入第 2 组'
            : hasBots && remainingMs > 0
              ? '体验模式：立即进入讨论与评选'
              : '两组完成，进入讨论与评选'}
        </Button>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  actions: { gap: spacing.small },
});
