/**
 * The host's "game resumed" gate after a rejoin. A reconnect leaves the host's page without a user
 * gesture for audio, so narration cannot resume on its own; pressing continue is that gesture.
 * Every way out continues the game (button, Escape), and the gate is not an alert-queue alert
 * because `useRoomAudioResume` blocks that queue while the gate is due.
 */
import { ALERT_TEST_IDS, AlertDialog } from '@/components/AlertDialog';

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
    <AlertDialog
      open={visible}
      title={ROOM_AUDIO_RESUME_TITLE}
      message={ROOM_AUDIO_RESUME_MESSAGE}
      buttons={[{ text: ROOM_AUDIO_RESUME_BUTTON, onPress: onContinue }]}
      onDismiss={onContinue}
      testIds={ALERT_TEST_IDS}
    />
  );
}
