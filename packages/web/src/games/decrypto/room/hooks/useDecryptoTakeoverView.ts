import type { DecryptoState } from '@game-judge/game-engine/games/decrypto/public';
import { useEffect, useState } from 'react';

import { readDecryptoTakeoverView } from '@/games/decrypto/services/decryptoTakeoverView';
import { handleError } from '@/utils/errorPipeline';
import { roomScreenLog } from '@/utils/logger';

/** Keeps bot-private information bound to the exact seat and authoritative state revision. */
export function useDecryptoTakeoverView({
  state,
  revision,
  roomCode,
  controlledSeat,
}: {
  readonly state: DecryptoState;
  readonly revision: number;
  readonly roomCode: string;
  readonly controlledSeat: number | null;
}) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; state: DecryptoState } | null>(null);
  const [failedRequest, setFailedRequest] = useState<string | null>(null);
  const isPlaying = state.phase.kind === 'playing';
  const { gameSequence, phaseRevision } = state;
  const key = `${roomCode}:${gameSequence}:${revision}:${controlledSeat}:${attempt}`;
  useEffect(() => {
    if (controlledSeat === null || !isPlaying) return;
    const controller = new AbortController();
    void readDecryptoTakeoverView(roomCode, controlledSeat, controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return;
        if (response.seat !== controlledSeat || response.state.gameSequence !== gameSequence) {
          throw new Error('[FAIL-FAST] Decrypto takeover view does not match the room');
        }
        setResult({ key, state: response.state });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setFailedRequest(key);
        handleError(error, {
          label: '读取接管席位的游戏信息',
          logger: roomScreenLog,
          feedback: 'toast',
        });
      });
    return () => controller.abort();
  }, [controlledSeat, gameSequence, isPlaying, key, roomCode]);
  const view =
    isPlaying && result?.key === key && result.state.phaseRevision === phaseRevision
      ? result.state
      : null;
  return {
    view,
    isLoading: isPlaying && controlledSeat !== null && view === null,
    hasError: failedRequest === key,
    retry: () => setAttempt((current) => current + 1),
  };
}
