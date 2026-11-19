import { useCallback, useRef, useState } from 'react';

import { Button } from '@/components/Button';
import type { RoomHostManagementAction } from '@/features/room/model/RoomHostManagement';
import { TESTIDS } from '@/testids';

export interface RoomStageMenuModel {
  readonly onOpenGuide: () => void;
  readonly onOpenConfiguration: () => void;
}

/** Renders the stage menu outside the stage tree so editors and timers stay mounted. */
export function RoomStageMenu({
  model,
  abortAction,
  onClose,
}: {
  readonly model: RoomStageMenuModel;
  readonly abortAction: RoomHostManagementAction | undefined;
  readonly onClose: () => void;
}) {
  const [isManual, setIsManual] = useState(false);
  const restoreManualFocus = useRef(false);
  const backButtonRef = useRef<HTMLButtonElement | null>(null);
  const focusBack = useCallback((button: HTMLButtonElement | null) => {
    backButtonRef.current = button;
    button?.focus({ preventScroll: true });
  }, []);
  const focusManual = useCallback((button: HTMLButtonElement | null) => {
    if (button === null || !restoreManualFocus.current) return;
    restoreManualFocus.current = false;
    button.focus({ preventScroll: true });
  }, []);
  const back = () => {
    if (isManual) {
      restoreManualFocus.current = true;
      setIsManual(false);
    } else {
      onClose();
    }
  };
  return (
    <div
      className="room-action-hand room-stage-menu"
      role="group"
      aria-label={isManual ? '手册' : '菜单'}
      data-testid={TESTIDS.roomStageMenuPanel}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          back();
        }
      }}
    >
      <Button
        ref={focusBack}
        variant="secondary"
        onClick={back}
        data-testid={TESTIDS.roomStageMenuBackButton}
      >
        返回
      </Button>
      {isManual ? (
        <Button
          variant="secondary"
          aria-haspopup="dialog"
          onClick={model.onOpenGuide}
          data-testid={TESTIDS.roomStageGuideButton}
        >
          玩法
        </Button>
      ) : (
        <>
          <Button
            ref={focusManual}
            variant="secondary"
            onClick={() => {
              setIsManual(true);
              backButtonRef.current?.focus({ preventScroll: true });
            }}
            data-testid={TESTIDS.roomManualButton}
          >
            手册
          </Button>
          <Button
            variant="secondary"
            aria-haspopup="dialog"
            onClick={model.onOpenConfiguration}
            data-testid={TESTIDS.roomStageConfigurationButton}
          >
            本局配置
          </Button>
          {abortAction !== undefined && (
            <Button
              variant={abortAction.variant}
              disabled={!abortAction.isEnabled || abortAction.isLoading}
              data-testid={abortAction.testID}
              onClick={() => {
                if (!abortAction.isEnabled) return;
                onClose();
                abortAction.onPress();
              }}
            >
              {abortAction.label}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
