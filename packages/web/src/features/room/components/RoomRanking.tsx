import './RoomRanking.css';

import type { ReactNode } from 'react';

/** Already-ranked game facts; the shared view never invents scores or tie-breaking rules. */
export interface RoomRankingRow {
  readonly seat: number;
  readonly rank: number;
  readonly rankLabel?: ReactNode;
  readonly displayName: string;
  readonly isSelf: boolean;
  readonly detail?: ReactNode;
  readonly value: ReactNode;
}

/** Shared ranking presentation for live scoreboards and final results. */
export function RoomRanking({
  title,
  rows,
}: {
  readonly title: string;
  readonly rows: readonly RoomRankingRow[];
}) {
  return (
    <section className="room-ranking" aria-label={title}>
      <h3 className="room-ranking-title">{title}</h3>
      <ol className="room-ranking-list">
        {rows.map((row) => (
          <li key={row.seat} className="room-ranking-row">
            <span className="room-ranking-rank" aria-label={`第 ${row.rank} 名`}>
              {row.rankLabel ?? row.rank}
            </span>
            <span className="room-ranking-player">
              <span
                className="room-ranking-name"
                title={row.displayName}
                data-self={row.isSelf || undefined}
                aria-current={row.isSelf ? 'true' : undefined}
              >
                {row.displayName}
              </span>
              {row.detail != null && <span className="room-ranking-detail">{row.detail}</span>}
            </span>
            <span className="room-ranking-value">{row.value}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
