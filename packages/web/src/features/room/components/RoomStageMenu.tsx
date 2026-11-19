import { useCallback, useId, useRef, useState } from 'react';

import { Button } from '@/components/Button';
import { IonIcon } from '@/components/icons/IonIcon';
import type { RoomHostManagementAction } from '@/features/room/model/RoomHostManagement';
import { TESTIDS } from '@/testids';
import { showAlert } from '@/utils/alert';
import IconArrowBack from '~icons/ion/arrow-back';
import IconBookOutline from '~icons/ion/book-outline';
import IconPersonCircleOutline from '~icons/ion/person-circle-outline';

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
  onOpenUserSettings,
}: {
  readonly model: RoomStageMenuModel;
  readonly abortAction: RoomHostManagementAction | undefined;
  readonly onClose: () => void;
  readonly onOpenUserSettings?: () => void;
}) {
  const reasonId = useId();
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
          onOpenUserSettings !== undefined && (
            <Button
              key="user-settings"
              variant="secondary"
              aria-haspopup="dialog"
              onClick={onOpenUserSettings}
              data-testid={TESTIDS.roomUserSettingsCard}
            >
              <IconPersonCircleOutline aria-hidden />
              <span>用户设置</span>
            </Button>
          ),
          abortAction !== undefined && (
            <Button
              key="abort"
              variant={abortAction.variant}
              disabled={
                abortAction.isLoading ||
                (!abortAction.isEnabled && abortAction.disabledReason === null)
              }
              aria-disabled={!abortAction.isEnabled ? true : undefined}
              aria-label={!abortAction.isEnabled ? abortAction.label : undefined}
              aria-describedby={
                !abortAction.isEnabled && abortAction.disabledReason !== null ? reasonId : undefined
              }
              data-testid={abortAction.testID}
              onClick={() => {
                if (!abortAction.isEnabled) {
                  if (abortAction.disabledReason !== null)
                    showAlert('暂不可用', abortAction.disabledReason);
                  return;
                }
                abortAction.onPress();
              }}
            >
              <IonIcon name={abortAction.icon} />
              <span>{abortAction.label}</span>
              {!abortAction.isEnabled && abortAction.disabledReason !== null && (
                <span id={reasonId} className="visually-hidden">
                  {abortAction.disabledReason}
                </span>
              )}
            </Button>
          ),
        ]
      )}
    </RoomActionHand>
  );
}
