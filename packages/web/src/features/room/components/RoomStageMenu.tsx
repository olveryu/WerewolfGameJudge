import { useCallback, useId, useRef, useState } from 'react';

import { Button } from '@/components/Button';
import { IonIcon } from '@/components/icons/IonIcon';
import { Spinner } from '@/components/Spinner';
import type { RoomHostManagementAction } from '@/features/room/model/RoomHostManagement';
import { TESTIDS } from '@/testids';
import IconArrowBack from '~icons/ion/arrow-back';
import IconBookOutline from '~icons/ion/book-outline';
import IconLockClosedOutline from '~icons/ion/lock-closed-outline';

import { RoomActionHand, RoomHandCard } from './RoomActionHand';

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
  const abortReason =
    abortAction !== undefined && !abortAction.isEnabled && abortAction.isLoading !== true
      ? abortAction.disabledReason || '当前暂不可用'
      : null;
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
      <RoomHandCard category="back">
        <Button
          ref={focusBack}
          variant="secondary"
          onClick={back}
          data-testid={TESTIDS.roomStageMenuBackButton}
        >
          <IconArrowBack aria-hidden />
          <span>返回</span>
        </Button>
      </RoomHandCard>
      {isManual ? (
        <RoomHandCard category="resource">
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
        </RoomHandCard>
      ) : (
        [
          <RoomHandCard key="manual" category="resource">
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
            </Button>
          </RoomHandCard>,
          <RoomHandCard key="configuration" category="resource">
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
            </Button>
          </RoomHandCard>,
          abortAction !== undefined && (
            <RoomHandCard
              key="abort"
              category={abortAction.variant === 'danger' ? 'danger' : 'host'}
              unavailable={!abortAction.isEnabled || abortAction.isLoading === true}
            >
              <Button
                key="abort"
                variant={abortAction.variant}
                loading={abortAction.isLoading === true}
                data-disabled-reason={abortReason ?? undefined}
                aria-disabled={abortReason !== null ? true : undefined}
                aria-label={!abortAction.isEnabled ? abortAction.label : undefined}
                aria-describedby={abortReason !== null ? reasonId : undefined}
                data-testid={abortAction.testID}
                onClick={() => {
                  if (!abortAction.isEnabled) return;
                  abortAction.onPress();
                }}
              >
                {abortAction.isLoading === true ? (
                  <Spinner label="提交中" />
                ) : abortReason !== null ? (
                  <IconLockClosedOutline aria-hidden />
                ) : (
                  <IonIcon name={abortAction.icon} />
                )}
                <span>{abortAction.label}</span>
                {abortReason !== null && (
                  <span id={reasonId} className="visually-hidden">
                    {abortReason}
                  </span>
                )}
              </Button>
            </RoomHandCard>
          ),
        ]
      )}
    </RoomActionHand>
  );
}
