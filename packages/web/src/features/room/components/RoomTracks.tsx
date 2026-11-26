import './RoomTrack.css';

import { useState } from 'react';

import { Button } from '@/components/Button';
import type { RoomTrack, RoomTrackCell } from '@/features/room/model/RoomBoardStatus';

import { RoomDialog } from './RoomDialog';

function RoomTrackCellContent({ cell }: { readonly cell: RoomTrackCell }) {
  return (
    <>
      {cell.title !== null && <strong>{cell.title}</strong>}
      {cell.lines.map((line) => (
        <span key={line}>{line}</span>
      ))}
    </>
  );
}

/** Public tracks drawn from data; a cell with a detail opens its read-only rule explanation. */
export function RoomTracks({ tracks }: { readonly tracks: readonly RoomTrack[] }) {
  const [openDetail, setOpenDetail] = useState<NonNullable<RoomTrackCell['detail']> | null>(null);
  return (
    <>
      <div className="room-track-group">
        {tracks.map((track) => (
          <div className="room-track" key={track.key}>
            <p className="room-track-heading">{track.heading}</p>
            <ol className="room-track-cells" aria-label={track.accessibleLabel}>
              {track.cells.map((cell) => {
                const detail = cell.detail;
                return (
                  <li key={cell.key}>
                    {detail === undefined ? (
                      <span className="room-track-cell" data-state={cell.state}>
                        <RoomTrackCellContent cell={cell} />
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="room-track-cell"
                        data-state={cell.state}
                        aria-label={detail.accessibleLabel}
                        onClick={() => setOpenDetail(detail)}
                      >
                        <RoomTrackCellContent cell={cell} />
                      </button>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </div>
      {openDetail !== null && (
        <RoomDialog
          title={openDetail.title}
          onClose={() => setOpenDetail(null)}
          dismissOnEscape
          footer={
            <Button variant="secondary" onClick={() => setOpenDetail(null)}>
              关闭
            </Button>
          }
        >
          <p>{openDetail.body}</p>
        </RoomDialog>
      )}
    </>
  );
}
