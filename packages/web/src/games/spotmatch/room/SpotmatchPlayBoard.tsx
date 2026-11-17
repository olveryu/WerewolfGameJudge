import {
  SPOTMATCH_SUCCESS_PAUSE_MS,
  type SpotmatchCard,
} from '@game-judge/game-engine/games/spotmatch/public';
import { useMemo } from 'react';

import type { RoomStageHudRenderer } from '@/features/room/components/RoomStageHud';
import { RoomStagePanel } from '@/features/room/components/RoomStagePanel';
import { usePrefersReducedMotion } from '@/scene/usePrefersReducedMotion';
import { TESTIDS } from '@/testids';

import { SPOTMATCH_SYMBOLS, spotmatchSymbolLayout } from '../model/symbols';
import { useSpotmatchCardFlight } from './hooks/useSpotmatchCardFlight';

interface SpotmatchBoardFeedback {
  readonly kind: 'idle' | 'success' | 'wrong' | 'notice';
  readonly title: string;
  readonly detail: string;
  readonly until: number;
}

interface SpotmatchPlayBoardProps {
  readonly hud?: RoomStageHudRenderer;
  readonly central: SpotmatchCard;
  readonly top: SpotmatchCard | null;
  readonly playedCard: SpotmatchCard | null;
  readonly isOwnSuccess: boolean;
  readonly feedback: SpotmatchBoardFeedback;
  readonly onSymbol: (symbolId: number) => void;
  readonly disabled: boolean;
  readonly wrongSymbol: number | null;
  readonly matchedSymbol: number | null;
}

/** Presentational board: animation follows the server pause, never delays the next legal claim. */
export function SpotmatchPlayBoard(props: SpotmatchPlayBoardProps) {
  const { central, top, playedCard, isOwnSuccess, feedback } = props;
  const reducedMotion = usePrefersReducedMotion();
  const until = feedback.kind === 'success' ? feedback.until : 0;
  const tone =
    feedback.kind === 'success' ? 'success' : feedback.kind === 'wrong' ? 'danger' : 'neutral';
  const { stage, centralPosition, ownPosition, flight, progress, stamp } = useSpotmatchCardFlight(
    until,
    isOwnSuccess,
    reducedMotion,
  );
  const feedbackContent = (
    <div className="spotmatch-feedback" key={`${feedback.kind}:${feedback.until}`}>
      <svg
        className="spotmatch-feedback-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <path
          d={
            feedback.kind === 'success'
              ? 'm6 12 4 4 8-8'
              : feedback.kind === 'wrong'
                ? 'm8 8 8 8m0-8-8 8'
                : 'M8 12h8m-4-4v8'
          }
        />
      </svg>
      <div className="spotmatch-feedback-copy" role="status" aria-live="polite" aria-atomic="true">
        <strong>{feedback.title}</strong>
        <span className={props.hud ? 'visually-hidden' : undefined}>{feedback.detail}</span>
      </div>
      {feedback.kind === 'success' && (
        <span className="spotmatch-pause-label" aria-hidden="true">
          {SPOTMATCH_SUCCESS_PAUSE_MS / 1000} 秒
        </span>
      )}
      {feedback.kind === 'success' && (
        <span className="spotmatch-pause-progress" ref={progress} aria-hidden="true" />
      )}
    </div>
  );
  return (
    <section
      ref={stage}
      className="spotmatch-stage"
      aria-label="一眼成对牌桌"
      data-feedback={feedback.kind}
    >
      <div className="spotmatch-feedback-panel" data-inline={props.hud !== undefined || undefined}>
        {props.hud ? (
          props.hud(feedbackContent, tone)
        ) : (
          <RoomStagePanel tone={tone}>{feedbackContent}</RoomStagePanel>
        )}
      </div>
      <h2 className="spotmatch-card-heading">桌面公共牌</h2>
      <div className="spotmatch-card-position" ref={centralPosition}>
        <SymbolCard
          card={central}
          kind="central"
          onSymbol={top === null ? null : props.onSymbol}
          disabled={props.disabled}
          wrongSymbol={props.wrongSymbol}
          matchedSymbol={props.matchedSymbol}
        />
        {playedCard !== null && (
          <span className="spotmatch-play-stamp" ref={stamp} aria-hidden="true">
            出牌成功
          </span>
        )}
      </div>
      <h2 className="spotmatch-card-heading">你的手牌</h2>
      <div className="spotmatch-card-position" ref={ownPosition}>
        {top === null ? (
          isOwnSuccess ? (
            <div className="spotmatch-card spotmatch-empty-card">手牌已出完</div>
          ) : (
            <p>你没有本局手牌</p>
          )
        ) : (
          <SymbolCard
            card={top}
            kind="own"
            onSymbol={props.onSymbol}
            disabled={props.disabled}
            wrongSymbol={props.wrongSymbol}
            matchedSymbol={null}
          />
        )}
      </div>
      {playedCard !== null && !reducedMotion && (
        <div className="spotmatch-played-card" ref={flight} aria-hidden="true">
          <SymbolCard
            card={playedCard}
            kind="effect"
            onSymbol={null}
            disabled
            wrongSymbol={null}
            matchedSymbol={props.matchedSymbol}
          />
        </div>
      )}
    </section>
  );
}

function SymbolCard({
  card,
  onSymbol,
  disabled,
  kind,
  wrongSymbol,
  matchedSymbol,
}: {
  readonly card: SpotmatchCard;
  readonly onSymbol: ((symbolId: number) => void) | null;
  readonly disabled: boolean;
  readonly kind: 'central' | 'own' | 'effect';
  readonly wrongSymbol: number | null;
  readonly matchedSymbol: number | null;
}) {
  const layouts = useMemo(() => spotmatchSymbolLayout(card.layoutSeed), [card.layoutSeed]);
  return (
    <div
      className="spotmatch-card"
      role="group"
      aria-label={kind === 'central' ? '桌面公共牌' : kind === 'own' ? '你的手牌' : undefined}
      data-testid={
        kind === 'central'
          ? TESTIDS.spotmatchCentralCard
          : kind === 'own'
            ? TESTIDS.spotmatchOwnCard
            : undefined
      }
      data-instance-id={card.instanceId}
    >
      {card.symbols
        .map((symbolId, index) => ({
          symbolId,
          layout: layouts[index],
        }))
        .map(({ symbolId, layout }) => {
          if (layout === undefined) throw new Error('Missing Spotmatch symbol layout');
          return { symbolId, layout };
        })
        .sort((a, b) => a.layout.y - b.layout.y || a.layout.x - b.layout.x)
        .map(({ symbolId, layout }) => {
          const symbol = SPOTMATCH_SYMBOLS[symbolId];
          if (symbol === undefined) throw new Error('Unknown Spotmatch symbol');
          const art = (
            <img
              src={symbol.url}
              alt={onSymbol === null ? symbol.name : ''}
              style={{ width: `${layout.scale}%`, transform: `rotate(${layout.rotation}deg)` }}
              draggable={false}
            />
          );
          const style = {
            left: `${layout.x}%`,
            top: `${layout.y}%`,
          };
          const className = `spotmatch-symbol${wrongSymbol === symbolId ? ' spotmatch-symbol--wrong' : ''}${matchedSymbol === symbolId ? ' spotmatch-symbol--matched' : ''}`;
          return onSymbol === null ? (
            <span key={symbolId} className={className} style={style} data-symbol-id={symbolId}>
              {art}
            </span>
          ) : (
            <button
              key={symbolId}
              type="button"
              className={className}
              style={style}
              data-testid={TESTIDS.spotmatchSymbol(symbolId)}
              aria-label={symbol.name}
              data-symbol-id={symbolId}
              disabled={disabled}
              onClick={() => onSymbol(symbolId)}
            >
              {art}
            </button>
          );
        })}
    </div>
  );
}
