import './RoomActionHand.css';

import {
  type CSSProperties,
  type KeyboardEventHandler,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';

import { TESTIDS } from '@/testids';

type HandStyle = CSSProperties & {
  '--hand-card-count': number;
};

type CardStyle = CSSProperties & {
  '--hand-card-angle': string;
  '--hand-card-drop': string;
  '--hand-card-order': number;
};

export type RoomHandCardCategory = 'back' | 'player' | 'neutral' | 'host' | 'resource' | 'danger';

export interface RoomHandCard {
  readonly id: string;
  readonly category: RoomHandCardCategory;
  readonly unavailable?: boolean;
  readonly content: ReactNode;
}

const CARD_CATEGORY_ORDER: Readonly<Record<RoomHandCardCategory, number>> = {
  back: 0,
  player: 1,
  neutral: 2,
  resource: 3,
  host: 4,
  danger: 5,
};

/** Arranges independent action targets over the overlapping card faces. */
export function RoomActionHand({
  cards,
  label,
  className,
  onKeyDown,
  testId,
}: {
  readonly cards: readonly RoomHandCard[];
  readonly label: string;
  readonly className?: string;
  readonly onKeyDown?: KeyboardEventHandler<HTMLDivElement>;
  readonly testId?: string;
}) {
  const [reason, setReason] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );
  const orderedCards = [...cards].toSorted(
    (left, right) =>
      CARD_CATEGORY_ORDER[left.category] - CARD_CATEGORY_ORDER[right.category] ||
      Number(left.unavailable === true) - Number(right.unavailable === true),
  );
  const style: HandStyle = { '--hand-card-count': orderedCards.length };
  return (
    <div
      className={['room-action-hand', className].filter(Boolean).join(' ')}
      role="group"
      aria-label={label}
      data-testid={testId}
      onKeyDown={onKeyDown}
      onClickCapture={(event) => {
        if (!(event.target instanceof Element)) return;
        const button = event.target.closest('button[aria-disabled="true"]');
        if (button === null || !event.currentTarget.contains(button)) return;
        event.preventDefault();
        event.stopPropagation();
        if (timer.current !== null) clearTimeout(timer.current);
        setReason(button.getAttribute('data-disabled-reason') ?? '当前暂不可用');
        timer.current = setTimeout(() => setReason(''), 5000);
      }}
      style={style}
    >
      <div
        className="room-hand-reason"
        role="status"
        data-testid={TESTIDS.roomHandUnavailableReason}
      >
        {reason}
      </div>
      {orderedCards.map((card, index) => {
        const distance = index - (orderedCards.length - 1) / 2;
        const cardStyle: CardStyle = {
          '--hand-card-angle': `${distance * 1.5}deg`,
          '--hand-card-drop': `${Math.abs(distance) * 4}px`,
          '--hand-card-order': index + 1,
        };
        return (
          <div className="room-action-card-cell" style={cardStyle} key={card.id}>
            {card.content}
          </div>
        );
      })}
    </div>
  );
}
