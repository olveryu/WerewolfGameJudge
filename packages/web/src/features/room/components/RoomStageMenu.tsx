import { useCallback, useRef, useState } from 'react';

import { IonIcon } from '@/components/icons/IonIcon';
import type { RoomHostManagementAction } from '@/features/room/model/RoomHostManagement';
import { TESTIDS } from '@/testids';
import IconArrowBack from '~icons/ion/arrow-back';
import IconBookOutline from '~icons/ion/book-outline';

import { RoomActionHand, type RoomHandCard } from './RoomActionHand';
import { RoomHandButton } from './RoomHandButton';

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
  const abortReason =
    abortAction !== undefined && !abortAction.isEnabled && abortAction.isLoading !== true
      ? abortAction.disabledReason || '当前暂不可用'
      : null;
  const cards: RoomHandCard[] = [
    {
      id: 'stage-menu:back',
      category: 'back',
      content: (
        <RoomHandButton
          ref={focusBack}
          model={{
            label: '返回',
            category: 'back',
            variant: 'secondary',
            isEnabled: true,
            onPress: back,
            icon: <IconArrowBack aria-hidden />,
            testId: TESTIDS.roomStageMenuBackButton,
          }}
        />
      ),
    },
  ];
  if (isManual) {
    cards.push({
      id: 'stage-menu:guide',
      category: 'resource',
      content: (
        <RoomHandButton
          model={{
            label: '玩法',
            category: 'resource',
            variant: 'secondary',
            isEnabled: true,
            onPress: model.onOpenGuide,
            icon: <IconBookOutline aria-hidden />,
            testId: TESTIDS.roomStageGuideButton,
            ariaHasPopup: 'dialog',
          }}
        />
      ),
    });
  } else {
    cards.push(
      {
        id: 'stage-menu:manual',
        category: 'resource',
        content: (
          <RoomHandButton
            ref={focusManual}
            model={{
              label: '手册',
              category: 'resource',
              variant: 'secondary',
              isEnabled: true,
              onPress: () => {
                setIsManual(true);
                backButtonRef.current?.focus({ preventScroll: true });
              },
              icon: <IconBookOutline aria-hidden />,
              testId: TESTIDS.roomManualButton,
            }}
          />
        ),
      },
      {
        id: 'stage-menu:configuration',
        category: 'resource',
        content: (
          <RoomHandButton
            model={{
              label: '本局配置',
              category: 'resource',
              variant: 'secondary',
              isEnabled: true,
              onPress: model.onOpenConfiguration,
              icon: <IconBookOutline aria-hidden />,
              testId: TESTIDS.roomStageConfigurationButton,
              ariaHasPopup: 'dialog',
            }}
          />
        ),
      },
    );
    if (abortAction !== undefined) {
      cards.push({
        id: 'stage-menu:abort',
        category: abortAction.variant === 'danger' ? 'danger' : 'host',
        unavailable: !abortAction.isEnabled || abortAction.isLoading === true,
        content: (
          <RoomHandButton
            model={{
              label: abortAction.label,
              category: abortAction.category ?? 'host',
              variant: abortAction.variant,
              isEnabled: abortAction.isEnabled,
              onPress: abortAction.isEnabled ? abortAction.onPress : undefined,
              disabledReason: abortReason,
              isLoading: abortAction.isLoading === true,
              icon: <IonIcon name={abortAction.icon} />,
              testId: abortAction.testID,
            }}
          />
        ),
      });
    }
  }
  return (
    <RoomActionHand
      cards={cards}
      className="room-stage-menu"
      label={isManual ? '手册' : '菜单'}
      testId={TESTIDS.roomStageMenuPanel}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          back();
        }
      }}
    />
  );
}
