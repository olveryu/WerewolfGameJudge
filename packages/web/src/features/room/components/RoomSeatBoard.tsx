/** Paged seat board used by every game room; a page holds 12 rows. */
import './RoomSeatBoard.css';

import {
  memo,
  type ReactNode,
  Suspense,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import { IconButton } from '@/components/IconButton';
import { useSeatDecorationsPreference } from '@/features/product/hooks/useSeatDecorationsPreference';
import { useViewportWidth } from '@/features/room/hooks/useViewportWidth';
import type { RoomSeatBoardModel } from '@/features/room/model/RoomShellModel';
import { displaySettings } from '@/features/settings/displaySettings';
import { resolveResidentDecorations } from '@/scene/residentDecorations';
import { TESTIDS } from '@/testids';
import IconChevronBack from '~icons/ion/chevron-back';
import IconChevronForward from '~icons/ion/chevron-forward';

import { RoomSeatSceneCanvas } from './RoomSeatScene';
import { RoomSeatTile } from './RoomSeatTile';

const ROWS_PER_PAGE = 12;

/** Adaptive column count for the viewport width (tablet-friendly). */
function getSeatGridColumns(viewportWidth: number): number {
  if (viewportWidth >= 768) return 6;
  if (viewportWidth >= 600) return 5;
  return 4;
}

function SeatPagination({
  page,
  pageCount,
  onPageChange,
}: {
  readonly page: number;
  readonly pageCount: number;
  readonly onPageChange: (page: number) => void;
}) {
  const errorId = useId();
  const [draft, setDraft] = useState<{ readonly page: number; readonly text: string } | null>(null);
  const [errorPage, setErrorPage] = useState<number | null>(null);
  const text = draft !== null && draft.page === page ? draft.text : String(page);
  const requested = /^\d+$/.test(text) ? Number(text) : Number.NaN;
  const isInvalid = !(Number.isSafeInteger(requested) && requested >= 1 && requested <= pageCount);
  const showsError = isInvalid && errorPage === page;
  return (
    <nav className="seat-pagination" aria-label="座位分页" data-testid={TESTIDS.roomSeatPagination}>
      <IconButton
        label="上一页座位"
        icon={<IconChevronBack aria-hidden />}
        disabled={page === 1}
        onClick={() => onPageChange(page - 1)}
        data-testid={TESTIDS.roomSeatPreviousPage}
      />
      <div className="seat-pagination-control">
        <form
          className="seat-pagination-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (isInvalid) {
              setErrorPage(page);
              return;
            }
            setErrorPage(null);
            onPageChange(requested);
          }}
        >
          <span>第</span>
          <input
            className="seat-pagination-input"
            inputMode="numeric"
            enterKeyHint="go"
            maxLength={String(pageCount).length}
            value={text}
            aria-invalid={showsError}
            aria-describedby={showsError ? errorId : undefined}
            aria-label="座位页码"
            data-testid={TESTIDS.roomSeatPageInput}
            onFocus={(event) => event.currentTarget.select()}
            onBlur={() => setErrorPage(isInvalid ? page : null)}
            onChange={(event) => {
              setDraft({ page, text: event.currentTarget.value });
              setErrorPage(null);
            }}
          />
          <span>/ {pageCount} 页</span>
        </form>
        {showsError && (
          <span id={errorId} className="seat-pagination-error" aria-live="polite">
            请输入 1 至 {pageCount} 之间的页码
          </span>
        )}
      </div>
      <IconButton
        label="下一页座位"
        icon={<IconChevronForward aria-hidden />}
        disabled={page === pageCount}
        onClick={() => onPageChange(page + 1)}
        data-testid={TESTIDS.roomSeatNextPage}
      />
    </nav>
  );
}

function RoomSeatBoardComponent({
  model,
  header,
  footer,
}: {
  readonly model: RoomSeatBoardModel;
  readonly header: ReactNode;
  readonly footer: ReactNode;
}) {
  const columns = getSeatGridColumns(useViewportWidth());
  const seatsPerPage = columns * ROWS_PER_PAGE;
  const pageCount = Math.max(1, Math.ceil(model.source.count / seatsPerPage));
  const [requestedPage, setRequestedPage] = useState(1);
  const page = Math.min(requestedPage, pageCount);
  const firstSeat = (page - 1) * seatsPerPage;
  const visibleSeatCount = Math.min(seatsPerPage, model.source.count - firstSeat);
  const display = useSyncExternalStore(displaySettings.subscribe, displaySettings.getSnapshot);
  const showsResidents = useSeatDecorationsPreference();
  const sceneHostRef = useRef<HTMLDivElement>(null);

  // Resident decorations only while the user wants them, motion is allowed and the game allows
  // them for the seat; the scene layer loads only when some visible seat has one.
  const seats = Array.from({ length: visibleSeatCount }, (_, offset) => {
    const seatModel = model.source.getSeat(firstSeat + offset);
    const residents =
      showsResidents && seatModel.decorationsEnabled && seatModel.player !== null
        ? resolveResidentDecorations(seatModel.player)
        : null;
    return { seatModel, residents };
  });
  const isSceneActive = seats.some(({ residents }) => residents !== null);

  const goToPage = (nextPage: number) => {
    if (!Number.isSafeInteger(nextPage) || nextPage < 1 || nextPage > pageCount) {
      throw new Error(`Room seat page is out of range: ${nextPage}`);
    }
    setRequestedPage(nextPage);
  };

  return (
    <>
      {header}
      {pageCount > 1 && (
        <SeatPagination page={page} pageCount={pageCount} onPageChange={goToPage} />
      )}
      <div
        className="seat-grid"
        style={{ '--seat-columns': columns }}
        data-disabled={model.visuallyDisabled}
      >
        {seats.map(({ seatModel, residents }) => (
          <RoomSeatTile
            key={seatModel.seat}
            model={seatModel}
            isBoardDisabled={model.visuallyDisabled}
            onPress={model.onSeatPress}
            onLongPress={model.onBotSeatLongPress}
            residents={residents}
            sceneHostRef={sceneHostRef}
          />
        ))}
        {isSceneActive && (
          <div ref={sceneHostRef} className="seat-scene-host" aria-hidden>
            <Suspense fallback={null}>
              <RoomSeatSceneCanvas hostRef={sceneHostRef} frameRate={display.sceneFrameRate} />
            </Suspense>
          </div>
        )}
      </div>
      {footer}
    </>
  );
}

export const RoomSeatBoard = memo(RoomSeatBoardComponent);
