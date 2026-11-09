/**
 * The host's "game resumed" gate after a rejoin. A reconnect leaves the host's page without a user
 * gesture for audio, so narration cannot resume on its own; pressing continue is that gesture.
 * Every way out continues the game (button, Escape), and the gate is not an alert-queue alert
 * because `useRoomAudioResume` blocks that queue while the gate is due.
 */
import '@/components/CenterDialog.css';

import { Dialog } from '@ark-ui/react/dialog';
import { Portal } from '@ark-ui/react/portal';

import { Button } from '@/components/Button';

export const ROOM_AUDIO_RESUME_TITLE = '游戏已恢复';
export const ROOM_AUDIO_RESUME_MESSAGE = '点击下方按钮继续游戏并恢复音频';
export const ROOM_AUDIO_RESUME_BUTTON = '继续游戏';

export function RoomAudioResumeDialog({
  visible,
  onContinue,
}: {
  readonly visible: boolean;
  readonly onContinue: () => void;
}) {
  return (
    <Dialog.Root
      open={visible}
      role="alertdialog"
      closeOnInteractOutside={false}
      onOpenChange={(details) => {
        if (!details.open) onContinue();
      }}
      lazyMount
      unmountOnExit
    >
      <Portal>
        <Dialog.Backdrop className="center-dialog-backdrop" />
        <Dialog.Positioner className="center-dialog-positioner">
          <Dialog.Content className="center-dialog">
            <Dialog.Title className="center-dialog-title">{ROOM_AUDIO_RESUME_TITLE}</Dialog.Title>
            <Dialog.Description className="center-dialog-subtitle">
              {ROOM_AUDIO_RESUME_MESSAGE}
            </Dialog.Description>
            <div className="center-dialog-actions">
              <Button onClick={onContinue}>{ROOM_AUDIO_RESUME_BUTTON}</Button>
            </div>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
