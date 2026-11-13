import { isRoomCode } from '@game-judge/game-engine/platform/protocol/roomCode';
import { useId, useState } from 'react';

import { Button } from '@/components/Button';
import { CenterDialog } from '@/components/CenterDialog';
import { NumPad } from '@/components/NumPad';
import { TESTIDS } from '@/testids';

const ROOM_CODE_LENGTH = 4;
const DIGIT_SLOTS = Array.from({ length: ROOM_CODE_LENGTH }, (_, index) => index);

interface JoinRoomDialogProps {
  open: boolean;
  onClose: () => void;
  onJoin: (roomCode: string) => void;
}

/** Room-code entry: four digit boxes over a numeric keypad. */
export function JoinRoomDialog({ open, onClose, onJoin }: JoinRoomDialogProps) {
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const updateRoomCode = (value: string) => {
    setRoomCode(value);
    setError(null);
  };

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
    <CenterDialog
      open={open}
      onClose={close}
      title="加入房间"
      subtitle="输入4位房间号码"
      testId={TESTIDS.joinRoomDialog}
    >
      <form
        className="join-room-form"
        onSubmit={(event) => {
          event.preventDefault();
          join();
        }}
      >
        <div className="join-code">
          <div className="join-code-display" aria-hidden="true">
            {DIGIT_SLOTS.map((slot) => (
              <span key={slot} className="join-code-digit">
                {roomCode[slot] ?? ''}
              </span>
            ))}
          </div>
          <input
            id={inputId}
            className="join-code-input"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={ROOM_CODE_LENGTH}
            aria-label="房间号（4位数字）"
            aria-invalid={error !== null}
            aria-describedby={error !== null ? errorId : undefined}
            value={roomCode}
            onChange={(event) =>
              updateRoomCode(event.target.value.replace(/\D/g, '').slice(0, ROOM_CODE_LENGTH))
            }
          />
        </div>
        {error !== null && (
          <p id={errorId} className="join-error" role="alert" data-testid={TESTIDS.joinRoomError}>
            {error}
          </p>
        )}
        <NumPad value={roomCode} onValueChange={updateRoomCode} maxLength={ROOM_CODE_LENGTH} />
        <div className="center-dialog-actions">
          <Button
            type="button"
            variant="secondary"
            onClick={close}
            data-testid={TESTIDS.joinRoomCancelButton}
          >
            取消
          </Button>
          <Button type="submit" data-testid={TESTIDS.joinRoomSubmitButton}>
            加入
          </Button>
        </div>
      </form>
    </CenterDialog>
  );
}
