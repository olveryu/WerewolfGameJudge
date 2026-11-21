import { type CSSProperties, type ReactNode, type Ref, useId } from 'react';

import { Button } from '@/components/Button';
import { Spinner } from '@/components/Spinner';
import IconHandLeftOutline from '~icons/ion/hand-left-outline';
import IconLockClosedOutline from '~icons/ion/lock-closed-outline';

import type { RoomHandCardCategory } from './RoomActionHand';

export interface RoomHandButtonModel {
  readonly label: string;
  readonly category: RoomHandCardCategory;
  readonly variant: 'primary' | 'secondary' | 'ghost' | 'danger';
  readonly icon?: ReactNode;
  readonly isEnabled: boolean;
  readonly onPress?: () => void;
  readonly disabledReason?: string | null;
  readonly isLoading?: boolean;
  readonly isPending?: boolean;
  readonly size?: 'lg' | 'md';
  readonly testId?: string;
  readonly ariaHasPopup?: 'dialog';
  readonly ariaLabel?: string;
  readonly dataPlayerActionIds?: string;
  readonly style?: CSSProperties;
}

interface RoomHandButtonProps {
  readonly model: RoomHandButtonModel;
  readonly ref?: Ref<HTMLButtonElement>;
}

/** Renders a hand action with consistent loading, disabled, and pending states. */
export function RoomHandButton({ model, ref }: RoomHandButtonProps) {
  const reasonId = useId();
  const isLoading = model.isLoading === true;
  const isPending = model.isPending === true;
  const disabledReason =
    !model.isEnabled && !isLoading ? model.disabledReason || '当前暂不可用' : null;
  const description = [isPending ? '有待处理操作' : '', disabledReason ?? '']
    .filter(Boolean)
    .join('；');

  return (
    <Button
      ref={ref}
      variant={model.variant}
      size={model.size ?? 'md'}
      loading={isLoading}
      data-card-category={model.category}
      data-disabled-reason={disabledReason ?? undefined}
      data-testid={model.testId}
      data-player-action-ids={model.dataPlayerActionIds}
      aria-haspopup={model.ariaHasPopup}
      aria-disabled={disabledReason === null ? undefined : true}
      aria-label={
        model.ariaLabel ?? (disabledReason !== null || isPending ? model.label : undefined)
      }
      aria-describedby={description.length > 0 ? reasonId : undefined}
      style={model.style}
      onClick={model.isEnabled ? model.onPress : undefined}
    >
      {isLoading ? (
        <Spinner label="提交中" />
      ) : disabledReason !== null ? (
        <IconLockClosedOutline aria-hidden />
      ) : (
        (model.icon ?? <IconHandLeftOutline aria-hidden />)
      )}
      <span>{model.label}</span>
      {isPending && (
        <span className="bottom-action-pending" aria-hidden>
          待行动
        </span>
      )}
      {description.length > 0 && (
        <span id={reasonId} className="visually-hidden">
          {description}
        </span>
      )}
    </Button>
  );
}
