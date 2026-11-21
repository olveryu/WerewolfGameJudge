import { type Ref, useId } from 'react';

import { IonIcon } from '@/components/icons/IonIcon';
import { Spinner } from '@/components/Spinner';
import type { RoomHandCard } from '@/features/room/model/RoomHand';

/** Renders one actionable card, including its accessible state and explanation. */
export function RoomHandCardButton({
  card,
  onBlocked,
  ref,
}: {
  readonly card: RoomHandCard;
  readonly onBlocked: (reason: string) => void;
  readonly ref?: Ref<HTMLButtonElement>;
}) {
  const descriptionId = useId();
  const reason = card.state.kind === 'blocked' ? (card.state.reason ?? '当前暂不可用') : null;
  const description = [card.isPending ? '有待处理操作' : '', reason ?? '']
    .filter(Boolean)
    .join('；');
  return (
    <button
      ref={ref}
      type="button"
      className="room-hand-card"
      data-card-category={card.category}
      data-testid={card.testID}
      data-player-action-ids={
        card.containedActionTestIDs.length > 0 ? card.containedActionTestIDs.join(' ') : undefined
      }
      disabled={card.state.kind === 'busy'}
      aria-busy={card.state.kind === 'busy'}
      aria-disabled={reason === null ? undefined : true}
      aria-haspopup={card.opensDialog ? 'dialog' : undefined}
      aria-label={
        card.accessibleLabel ?? (reason !== null || card.isPending ? card.label : undefined)
      }
      aria-describedby={description.length > 0 ? descriptionId : undefined}
      onClick={() => {
        if (card.state.kind === 'ready') card.state.onPress();
        else if (reason !== null) onBlocked(reason);
      }}
    >
      {card.state.kind === 'busy' ? (
        <Spinner label="提交中" />
      ) : (
        <IonIcon name={reason === null ? card.icon : 'lock-closed-outline'} />
      )}
      <span>{card.label}</span>
      {card.isPending && (
        <span className="bottom-action-pending" aria-hidden>
          待行动
        </span>
      )}
      {description.length > 0 && (
        <span id={descriptionId} className="visually-hidden">
          {description}
        </span>
      )}
    </button>
  );
}
