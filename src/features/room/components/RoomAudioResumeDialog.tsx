/**
 * RoomAudioResumeDialog — the host's "game resumed" gate after a rejoin.
 *
 * A reconnect leaves the host's device without a user gesture for the
 * audio context, so narration cannot resume on its own; this dialog is
 * the gesture. Copy and behavior are werewolf's, now shared by every
 * game with host narration (`useRoomAudioResume` drives `visible`).
 */

import type React from 'react';

import { AlertModal } from '@/components/AlertModal';

export const ROOM_AUDIO_RESUME_TITLE = '游戏已恢复';
export const ROOM_AUDIO_RESUME_MESSAGE = '点击下方按钮继续游戏并恢复音频';
export const ROOM_AUDIO_RESUME_BUTTON = '继续游戏';

interface RoomAudioResumeDialogProps {
  readonly visible: boolean;
  readonly onContinue: () => void;
}

export const RoomAudioResumeDialog: React.FC<RoomAudioResumeDialogProps> = ({
  visible,
  onContinue,
}) => (
  // Every way out continues the game — button, backdrop, back — and
  // AlertModal closes after a button press, so continue is bound once,
  // on close (binding it to the button as well would run it twice).
  <AlertModal
    visible={visible}
    title={ROOM_AUDIO_RESUME_TITLE}
    message={ROOM_AUDIO_RESUME_MESSAGE}
    buttons={[{ text: ROOM_AUDIO_RESUME_BUTTON }]}
    onClose={onContinue}
  />
);
