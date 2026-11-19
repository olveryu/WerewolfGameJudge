import { useCallback, useRef, useState } from 'react';

import { Button } from '@/components/Button';
import { IonIcon } from '@/components/icons/IonIcon';
import type { RoomHostManagementAction } from '@/features/room/model/RoomHostManagement';
import { TESTIDS } from '@/testids';
import IconArrowBack from '~icons/ion/arrow-back';
import IconBookOutline from '~icons/ion/book-outline';

import { RoomActionHand } from './RoomActionHand';

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
    <RoomActionHand
      className="room-stage-menu"
      label={isManual ? '手册' : '菜单'}
      testId={TESTIDS.roomStageMenuPanel}
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
        <IconArrowBack aria-hidden />
        <span>返回</span>
      </Button>
      {isManual ? (
        <Button
          key="guide"
          variant="secondary"
          data-card-category="resource"
          aria-haspopup="dialog"
          onClick={model.onOpenGuide}
          data-testid={TESTIDS.roomStageGuideButton}
        >
          <IconBookOutline aria-hidden />
          <span>玩法</span>
        </Button>
      ) : (
        [
          <Button
            key="manual"
            ref={focusManual}
            variant="secondary"
            data-card-category="resource"
            onClick={() => {
              setIsManual(true);
              backButtonRef.current?.focus({ preventScroll: true });
            }}
            data-testid={TESTIDS.roomManualButton}
          >
            <IconBookOutline aria-hidden />
            <span>手册</span>
          </Button>,
          <Button
            key="configuration"
            variant="secondary"
            data-card-category="resource"
            aria-haspopup="dialog"
            onClick={model.onOpenConfiguration}
            data-testid={TESTIDS.roomStageConfigurationButton}
          >
            <IconBookOutline aria-hidden />
            <span>本局配置</span>
          </Button>,
          abortAction !== undefined && (
            <Button
              key="abort"
              variant={abortAction.variant}
              disabled={!abortAction.isEnabled || abortAction.isLoading}
              data-testid={abortAction.testID}
              onClick={() => {
                if (!abortAction.isEnabled) return;
                onClose();
                abortAction.onPress();
              }}
            >
              <IonIcon name={abortAction.icon} />
              <span>{abortAction.label}</span>
            </Button>
          ),
        ]
      )}
    </RoomActionHand>
  );
}
