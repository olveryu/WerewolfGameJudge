import { useState } from 'react';

import { Button } from '@/components/Button';
import type { RoomHostManagementAction } from '@/features/room/model/RoomHostManagement';
import { TESTIDS } from '@/testids';

import { RoomDialog } from './RoomDialog';

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
  const back = () => {
    if (isManual) setIsManual(false);
    else onClose();
  };
  return (
    <RoomDialog
      title={isManual ? '手册' : '菜单'}
      showClose={false}
      allowEscape
      onClose={back}
      footer={null}
      testId={TESTIDS.roomStageMenuPanel}
    >
      <div className="room-action-hand">
        <Button variant="secondary" onClick={back} data-testid={TESTIDS.roomStageMenuBackButton}>
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
              variant="secondary"
              onClick={() => setIsManual(true)}
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
    </RoomDialog>
  );
}
