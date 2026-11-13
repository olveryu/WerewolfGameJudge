import './GameStatsPanel.css';

import { type ReactNode, useEffect } from 'react';

import { Spinner } from './Spinner';

export interface GameStatsPanelProps {
  readonly gamesPlayed: number | undefined;
  readonly onGamesPlayedChange?: (gamesPlayed: number | null) => void;
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly loadingLabel: string;
  readonly errorLabel: string;
  readonly emptyTitle: string;
  readonly emptyDescription: string;
  readonly children: ReactNode;
}

export function GameStatsRow({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="game-stats-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function GameStatsGroup({ children }: { readonly children: ReactNode }) {
  return <div className="game-stats-group">{children}</div>;
}

export function GameStatsNote({ children }: { readonly children: ReactNode }) {
  return <p className="game-stats-note">{children}</p>;
}

export function GameStatsReactionIcon({ kind }: { readonly kind: 'flower' | 'egg' | 'tomato' }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {kind === 'flower' ? (
        <>
          <path d="M12 12v10m0-4c-4 0-6-2-6-4 4 0 6 2 6 4m0 1c4 0 6-2 6-4-4 0-6 2-6 4" />
          <path d="M12 3c2-3 6 0 4 3 4-1 5 4 1 5 2 3-3 6-5 3-2 3-7 0-5-3-4-1-3-6 1-5-2-3 2-6 4-3Z" />
          <circle cx="12" cy="8" r="2" />
        </>
      ) : kind === 'egg' ? (
        <>
          <path d="M12 2C8 2 4 11 4 15a8 7 0 0 0 16 0c0-4-4-13-8-13Z" />
          <path d="M8 15c0 3 2 4 4 4" />
        </>
      ) : (
        <>
          <path d="M12 7c-12-5-15 15 0 15S24 2 12 7Z" />
          <path d="m12 8-5-4 5 1 3-4v5l5 1-6 2-3 4" />
          <path d="M6 13c-1 3 0 4 1 5" />
        </>
      )}
    </svg>
  );
}

export function GameStatsBar({
  label,
  value,
  numerator,
  denominator,
  tone = 'default',
}: {
  readonly label: string;
  readonly value: string;
  readonly numerator: number;
  readonly denominator: number;
  readonly tone?: 'default' | 'good' | 'evil' | 'special';
}) {
  const percent = denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : 0;
  const percentLabel =
    denominator > 0 ? `${Number.isInteger(percent) ? percent : percent.toFixed(1)}%` : '—';

  return (
    <div className="game-stats-bar-row" data-tone={tone}>
      <span className="game-stats-bar-label">{label}</span>
      <span className="game-stats-bar-track" aria-hidden="true">
        <span className="game-stats-bar-fill" style={{ width: `${percent}%` }} />
      </span>
      <span className="game-stats-bar-value">{value}</span>
      <span className="game-stats-bar-share">{percentLabel}</span>
    </div>
  );
}

export function GameStatsPanel({
  gamesPlayed,
  onGamesPlayedChange,
  isLoading,
  isError,
  loadingLabel,
  errorLabel,
  emptyTitle,
  emptyDescription,
  children,
}: GameStatsPanelProps) {
  useEffect(() => {
    onGamesPlayedChange?.(isLoading || isError ? null : (gamesPlayed ?? 0));
  }, [gamesPlayed, isError, isLoading, onGamesPlayedChange]);

  return (
    <div className="game-stats-panel" data-state={isLoading ? 'pending' : 'ready'}>
      {isLoading ? (
        <Spinner label={loadingLabel} />
      ) : isError ? (
        <p className="game-stats-error" role="alert">
          {errorLabel}
        </p>
      ) : gamesPlayed === 0 ? (
        <div className="game-stats-empty">
          <h4>{emptyTitle}</h4>
          <p>{emptyDescription}</p>
        </div>
      ) : (
        children
      )}
    </div>
  );
}
