/**
 * useRoomSeatOperations — shared pending/submitting state for seat operations.
 *
 * It does not know game rules or services. Callers decide whether an operation is allowed
 * and provide the execution callback for the current game.
 */
import { useCallback, useMemo, useRef, useState } from 'react';

export type RoomSeatOperationKind = 'enter' | 'move' | 'leave';

export interface RoomSeatOperation {
  kind: RoomSeatOperationKind;
  seat: number;
}

interface UseRoomSeatOperationsParams {
  runOperation: (operation: RoomSeatOperation) => Promise<boolean>;
}

export function useRoomSeatOperations({ runOperation }: UseRoomSeatOperationsParams) {
  const [operation, setOperation] = useState<RoomSeatOperation | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const openOperation = useCallback((next: RoomSeatOperation) => {
    submittingRef.current = false;
    setIsSubmitting(false);
    setOperation(next);
  }, []);

  const cancelOperation = useCallback(() => {
    setOperation(null);
  }, []);

  const confirmOperation = useCallback(async (): Promise<void> => {
    if (!operation) {
      throw new Error('useRoomSeatOperations.confirmOperation: no pending operation');
    }
    if (submittingRef.current) return;

    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      const ok = await runOperation(operation);
      if (ok) setOperation(null);
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }, [operation, runOperation]);

  return useMemo(
    () => ({
      operation,
      isSubmitting,
      openOperation,
      cancelOperation,
      confirmOperation,
    }),
    [cancelOperation, confirmOperation, isSubmitting, openOperation, operation],
  );
}
