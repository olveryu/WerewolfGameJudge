/**
 * Jest mock for @/components/AlertModal (test-only).
 *
 * Renders the REAL AlertModal so dialog UI actually appears in tests,
 * and reports each newly-shown dialog to the registered test harness
 * (so harness.hasSeen / pressButton keep working after the showAlert → state
 * migration). Dedupes by buttons array reference to avoid double-reporting
 * on re-renders.
 *
 * Usage in board tests: add `jest.mock('@/components/AlertModal');`
 * The harness registers via `setAlertModalTestHarness`.
 */

import React from 'react';

import type { AlertButton, AlertModalProps } from '@/components/AlertModal';
import { AlertModal as RealAlertModal } from '@/components/AlertModal';

interface TestHarness {
  record: (title: string, message?: string, buttons?: AlertButton[]) => void;
}

let testHarness: TestHarness | null = null;

/** Called by RoomScreenTestHarness constructor (test-only). */
export function setAlertModalTestHarness(harness: TestHarness | null): void {
  testHarness = harness;
}

export const AlertModal: React.FC<AlertModalProps> = (props) => {
  const { visible, title, message, buttons } = props;
  const prevButtonsRef = React.useRef<AlertButton[] | null>(null);

  React.useEffect(() => {
    if (visible && buttons !== prevButtonsRef.current) {
      prevButtonsRef.current = buttons;
      testHarness?.record(title, message, buttons);
    }
    if (!visible) {
      prevButtonsRef.current = null;
    }
  }, [visible, buttons, title, message]);

  return <RealAlertModal {...props} />;
};
