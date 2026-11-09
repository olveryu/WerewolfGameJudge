/**
 * Shared answering top bar (v3): a white capsule with a countdown ring,
 * a stack of seat avatars showing who has submitted, and a status line.
 *
 * Story Relay and Pictionary render the identical bar — same ring, same
 * avatars, same wording ("作答中 / 已提交"). The bar reads only
 * remaining/total seconds and the seat list the caller derived; it never
 * reads game state.
 *
 * Ring boundary states (plan §14): no limit shows "不限时" with no arc,
 * 0 seconds shows "0秒" with an empty arc, 10 seconds or less turns the
 * arc red.
 */

import './AnsweringTopBar.css';

import { colors } from '@/theme/colors';
import IconCheckmark from '~icons/ion/checkmark';

import {
  ANSWERING_TOP_BAR_OVERFLOW_COLOR,
  type AnsweringTopBarSeat,
} from '../model/answeringTopBarSeats';

/** v3 ring colours: track, arc, and the green that marks a submitted seat. */
const RING_TRACK_COLOR = '#EDEDF3';
const RING_ARC_COLOR = '#6366F1';
const READY_GREEN = '#22C55E';

const RING_SIZE = 36;
const RING_RADIUS = 15;
const RING_STROKE_WIDTH = 4;
/** 2π × 15, the mock's dasharray. */
const RING_CIRCUMFERENCE = 94.2;
const MAX_VISIBLE_SEATS = 8;
const URGENT_SECONDS = 10;

interface AnsweringTopBarProps {
  /** Null means the stage has no time limit. */
  readonly remainingSeconds: number | null;
  /** Null means the stage has no time limit. */
  readonly totalSeconds: number | null;
  readonly seats: readonly AnsweringTopBarSeat[];
}

/** Renders the countdown ring, submitted avatars and answering counts for a writing stage. */
export function AnsweringTopBar({ remainingSeconds, totalSeconds, seats }: AnsweringTopBarProps) {
  const submittedCount = seats.filter((seat) => seat.submitted).length;
  const answeringCount = seats.length - submittedCount;
  const visibleSeats = seats.slice(0, MAX_VISIBLE_SEATS);
  const overflowCount = seats.length - visibleSeats.length;
  const isUnlimited = remainingSeconds === null || totalSeconds === null;
  const isUrgent =
    remainingSeconds !== null && remainingSeconds > 0 && remainingSeconds <= URGENT_SECONDS;
  const arcColor = isUrgent ? colors.error : RING_ARC_COLOR;
  const dashOffset =
    remainingSeconds === null || totalSeconds === null || totalSeconds === 0
      ? RING_CIRCUMFERENCE
      : RING_CIRCUMFERENCE * (1 - remainingSeconds / totalSeconds);
  const center = RING_SIZE / 2;
  return (
    <div
      className="answering-top-bar"
      data-testid="answering-top-bar"
      role="group"
      aria-label={`作答进度：${answeringCount}人作答中，${submittedCount}人已提交`}
    >
      <div
        className="answering-top-bar-ring"
        data-testid="answering-top-bar-ring"
        role="img"
        aria-label={isUnlimited ? '本阶段不限时' : `剩余 ${remainingSeconds} 秒`}
      >
        <svg
          width={RING_SIZE}
          height={RING_SIZE}
          viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
          aria-hidden
        >
          <circle
            cx={center}
            cy={center}
            r={RING_RADIUS}
            fill="none"
            stroke={RING_TRACK_COLOR}
            strokeWidth={RING_STROKE_WIDTH}
          />
          {!isUnlimited && (
            <circle
              cx={center}
              cy={center}
              r={RING_RADIUS}
              fill="none"
              stroke={arcColor}
              strokeWidth={RING_STROKE_WIDTH}
              strokeLinecap="round"
              strokeDasharray={String(RING_CIRCUMFERENCE)}
              strokeDashoffset={dashOffset}
              transform={`rotate(-90 ${center} ${center})`}
              data-testid="answering-top-bar-ring-arc"
            />
          )}
        </svg>
        <div className="answering-top-bar-ring-center" aria-hidden>
          {isUnlimited ? (
            <span className="answering-top-bar-ring-unlimited">不限时</span>
          ) : (
            <>
              <span className="answering-top-bar-ring-number">{remainingSeconds}</span>
              <span className="answering-top-bar-ring-unit">秒</span>
            </>
          )}
        </div>
      </div>
      <ul className="answering-top-bar-avatars">
        {visibleSeats.map((seat) => (
          <li
            key={seat.seat}
            data-testid={`answering-top-bar-avatar-${seat.seat}`}
            className="answering-top-bar-avatar"
            style={{ backgroundColor: seat.color }}
            aria-label={`${seat.displayName}：${seat.submitted ? '已提交' : '作答中'}`}
          >
            {seat.submitted && (
              <span
                data-testid="answering-top-bar-ready-ring"
                className="answering-top-bar-ready-ring"
                style={{ borderColor: READY_GREEN }}
              />
            )}
            <span className="answering-top-bar-avatar-initial" aria-hidden>
              {seat.initial}
            </span>
            <span
              data-testid={`answering-top-bar-dot-${seat.seat}`}
              className="answering-top-bar-dot"
              style={{ backgroundColor: seat.submitted ? READY_GREEN : RING_ARC_COLOR }}
            >
              {seat.submitted && <IconCheckmark aria-hidden />}
            </span>
          </li>
        ))}
        {overflowCount > 0 && (
          <li
            data-testid="answering-top-bar-overflow"
            className="answering-top-bar-avatar"
            style={{ backgroundColor: ANSWERING_TOP_BAR_OVERFLOW_COLOR }}
            aria-label={`还有 ${overflowCount} 人`}
          >
            <span className="answering-top-bar-avatar-initial" aria-hidden>
              +{overflowCount}
            </span>
          </li>
        )}
      </ul>
      <p className="answering-top-bar-status" aria-hidden>
        <span className="answering-top-bar-status-answering">{answeringCount}人作答中</span>
        <span className="answering-top-bar-status-submitted"> · {submittedCount}已提交</span>
      </p>
    </div>
  );
}
