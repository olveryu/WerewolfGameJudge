import './RoomActionHand.css';

import {
  Children,
  type CSSProperties,
  isValidElement,
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

interface RoomHandCardProps {
  readonly category: RoomHandCardCategory;
  readonly unavailable?: boolean;
  readonly children: ReactNode;
}

const CARD_CATEGORY_ORDER: Readonly<Record<RoomHandCardCategory, number>> = {
  back: 0,
  player: 1,
  neutral: 2,
  resource: 3,
  host: 4,
  danger: 5,
};

/** Carries the action's semantic category independently of its disabled appearance. */
export function RoomHandCard({ children }: RoomHandCardProps) {
  return children;
}

/** Marks a card whose action still needs attention. */
export function PendingActionMarker() {
  return (
    <span className="bottom-action-pending" aria-hidden>
      待行动
    </span>
  );
}

function cardCategory(card: ReactNode): RoomHandCardCategory | null {
  if (!isValidElement(card) || typeof card.props !== 'object' || card.props === null) return null;
  if (!('category' in card.props)) return null;
  switch (card.props.category) {
    case 'back':
    case 'player':
    case 'neutral':
    case 'host':
    case 'resource':
    case 'danger':
      return card.props.category;
    default:
      return null;
  }
}

function cardOrder(card: ReactNode): number {
  return CARD_CATEGORY_ORDER[cardCategory(card) ?? 'neutral'];
}

function cardUnavailable(card: ReactNode): boolean {
  return (
    cardCategory(card) !== null &&
    isValidElement(card) &&
    typeof card.props === 'object' &&
    card.props !== null &&
    'unavailable' in card.props &&
    card.props.unavailable === true
  );
}

/** Arranges independent action targets over the overlapping card faces. */
export function RoomActionHand({
  children,
  label,
  className,
  onKeyDown,
  testId,
}: {
  readonly children: ReactNode;
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
  const cards = Children.toArray(children).toSorted(
    (left, right) =>
      cardOrder(left) - cardOrder(right) ||
      Number(cardUnavailable(left)) - Number(cardUnavailable(right)),
  );
  const style: HandStyle = { '--hand-card-count': cards.length };
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
      {cards.map((card, index) => {
        const distance = index - (cards.length - 1) / 2;
        const cardStyle: CardStyle = {
          '--hand-card-angle': `${distance * 1.5}deg`,
          '--hand-card-drop': `${Math.abs(distance) * 4}px`,
          '--hand-card-order': index + 1,
        };
        return (
          <div
            className="room-action-card-cell"
            style={cardStyle}
            key={isValidElement(card) ? card.key : index}
          >
            {card}
          </div>
        );
      })}
    </div>
  );
}
