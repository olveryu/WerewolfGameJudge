/**
 * The host's "game resumed" gate after a rejoin. A reconnect leaves the host's page without a user
 * gesture for audio, so narration cannot resume on its own; pressing continue is that gesture.
 * Every way out continues the game (button, Escape), and the gate is not an alert-queue alert
 * because `useRoomAudioResume` blocks that queue while the gate is due.
 */
import '@/components/CenterDialog.css';

import { Portal } from '@ark-ui/react/portal';

import { AppDialog } from '@/components/AppDialog';
import { Button } from '@/components/Button';
import { TESTIDS } from '@/testids';

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
    <AppDialog.Root
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
        <AppDialog.Backdrop className="center-dialog-backdrop" />
        <AppDialog.Positioner
          className="center-dialog-positioner"
          data-testid={TESTIDS.alertModalOverlay}
        >
          <AppDialog.Content className="center-dialog" data-testid={TESTIDS.alertModal}>
            <AppDialog.Title className="center-dialog-title" data-testid={TESTIDS.alertTitle}>
              {ROOM_AUDIO_RESUME_TITLE}
            </AppDialog.Title>
            <AppDialog.Description
              className="center-dialog-subtitle"
              data-testid={TESTIDS.alertMessage}
            >
              {ROOM_AUDIO_RESUME_MESSAGE}
            </AppDialog.Description>
            <div className="center-dialog-actions">
              <Button onClick={onContinue} data-testid={TESTIDS.alertButton(0)}>
                {ROOM_AUDIO_RESUME_BUTTON}
              </Button>
            </div>
          </AppDialog.Content>
        </AppDialog.Positioner>
      </Portal>
    </AppDialog.Root>
  );
}
