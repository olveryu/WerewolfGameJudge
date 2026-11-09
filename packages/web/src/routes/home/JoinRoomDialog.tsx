import { isRoomCode } from '@game-judge/game-engine/platform/protocol/roomCode';
import { useState } from 'react';

import { Button } from '@/components/Button';
import { CenterDialog } from '@/components/CenterDialog';
import { NumPad } from '@/components/NumPad';

const ROOM_CODE_LENGTH = 4;
const DIGIT_SLOTS = Array.from({ length: ROOM_CODE_LENGTH }, (_, index) => index);

interface JoinRoomDialogProps {
  open: boolean;
  onClose: () => void;
  onJoin: (roomCode: string) => void;
}

/** Room-code entry: four digit boxes over a numeric keypad. */
export function JoinRoomDialog({ open, onClose, onJoin }: JoinRoomDialogProps) {
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setRoomCode('');
    setError(null);
    onClose();
  };

  const join = () => {
    if (!isRoomCode(roomCode)) {
      setError('请输入4位数字房间号');
      return;
    }
    setRoomCode('');
    setError(null);
    onJoin(roomCode);
  };

  return (
    <CenterDialog open={open} onClose={close} title="加入房间" subtitle="输入4位房间号码">
      <div className="join-code" aria-label={`房间号 ${roomCode}`}>
        {DIGIT_SLOTS.map((slot) => (
          <span key={slot} className="join-code-digit">
            {roomCode[slot] ?? ''}
          </span>
        ))}
      </div>
      {error && <p className="join-error">{error}</p>}
      <NumPad value={roomCode} onValueChange={setRoomCode} maxLength={ROOM_CODE_LENGTH} />
      <div className="center-dialog-actions">
        <Button variant="secondary" onClick={close}>
          取消
        </Button>
        <Button onClick={join}>加入</Button>
      </div>
    </CenterDialog>
  );
}
