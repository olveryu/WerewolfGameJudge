/**
 * Manual mock for `@/components/AlertModal` — werewolf room board UI tests only.
 *
 * Renders the REAL AlertModal, but notifies the active RoomScreenTestHarness
 * whenever a modal transitions to visible. This keeps the harness's dialog
 * assertions (hasSeen/expectSeen/pressButton*) working after dialogs migrated
 * from showAlert() to hook-owned <AlertModal> state.
 *
 * Only active in test files that call `jest.mock('@/components/AlertModal')`.
 * Test-only; must not be referenced from production code.
 */
import React from 'react';

import { getActiveHarness } from '@/games/werewolf/room/__tests__/harness/RoomScreenTestHarness';

import type { AlertButton } from '../AlertModal';

const { AlertModal: ActualAlertModal } = jest.requireActual<{
  AlertModal: React.FC<{
    visible: boolean;
    title: string;
    message?: string;
    buttons: AlertButton[];
    input?: { placeholder?: string; defaultValue?: string };
    onClose: () => void;
  }>;
}>('../AlertModal');

interface ObservedAlertModalProps {
  visible: boolean;
  title: string;
  message?: string;
  buttons: AlertButton[];
  input?: { placeholder?: string; defaultValue?: string };
  onClose: () => void;
}

/** Wraps the real AlertModal; records each new alert (deduped by buttons identity). */
export const AlertModal: React.FC<ObservedAlertModalProps> = (props) => {
  const lastButtonsRef = React.useRef<AlertButton[] | null>(null);
  if (props.visible && props.buttons !== lastButtonsRef.current) {
    getActiveHarness()?.record(props.title, props.message, props.buttons);
    lastButtonsRef.current = props.buttons;
  }
  if (!props.visible) {
    lastButtonsRef.current = null;
  }
  return <ActualAlertModal {...props} />;
};
