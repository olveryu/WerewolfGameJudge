/**
 * RoomSeatTile — one game-neutral seat: avatar, highlight ring, badges, name and indicators.
 * Reports presses through callbacks; no service calls or game rules. Looping seat decorations
 * (avatar frames, flairs, pets) and the seat's entrance animation are drawn by the scene layer
 * over the tile, not in the DOM; an entrance moves the DOM avatar inside its stage, which then
 * clips it to the tile's border box. A framed seat drops its border and background, and its
 * avatar fills the border box under the frame, as in the previous client.
 */
import { lazy, memo, type RefObject, Suspense, useRef } from 'react';

import { Avatar } from '@/components/avatar/Avatar';
import { NameStyleText } from '@/components/nameStyles/NameStyleText';
import { useLongPress } from '@/features/room/hooks/useLongPress';
import { getRoomOccupantAvatarSeed } from '@/features/room/model/RoomOccupant';
import {
  formatRoomSeat,
  type RoomSeatIndicators,
  type RoomSeatViewModel,
} from '@/features/room/model/RoomSeatDataSource';
import type { ResidentDecorations } from '@/scene/residentDecorations';
import { TESTIDS } from '@/testids';
import IconChatbubbleEllipsesOutline from '~icons/ion/chatbubble-ellipses-outline';
import IconCheckmarkCircle from '~icons/ion/checkmark-circle';

const RoomSeatResidents = lazy(() =>
  import('./RoomSeatScene').then((module) => ({ default: module.RoomSeatResidents })),
);

function describeSeat(model: RoomSeatViewModel): string {
  const { seat, player, indicators } = model;
  const parts = [
    player === null
      ? `${formatRoomSeat(seat)}座位`
      : `${formatRoomSeat(seat)}座位 ${player.displayName}`,
    ...(indicators === null
      ? []
      : [
          ...indicators.markers.map((marker) => marker.label),
          indicators.selection?.label,
          indicators.progressLabel,
        ]),
  ];
  return parts.filter(Boolean).join('，');
}

function SeatMarkers({ seat, indicators }: { seat: number; indicators: RoomSeatIndicators }) {
  if (indicators.markers.length === 0) return null;
  return (
    <span className="seat-markers" aria-hidden>
      {indicators.markers.map((marker) => (
        <span
          key={marker.key}
          className="seat-marker"
          data-tone={marker.tone}
          data-testid={TESTIDS.seatMarker(seat, marker.key)}
        >
          {marker.label}
        </span>
      ))}
    </span>
  );
}

function SeatProgress({ seat, indicators }: { seat: number; indicators: RoomSeatIndicators }) {
  if (indicators.selection === null && indicators.progressLabel === null) return null;
  return (
    <div className="seat-progress" data-testid={TESTIDS.seatProgress(seat)}>
      {indicators.selection !== null && (
        <span className="seat-selection-label">{indicators.selection.label}</span>
      )}
      {indicators.progressLabel !== null && (
        <span className="seat-progress-label">{indicators.progressLabel}</span>
      )}
    </div>
  );
}

interface RoomSeatTileProps {
  readonly model: RoomSeatViewModel;
  /** The whole board is visually disabled (e.g. while a command is in flight). */
  readonly isBoardDisabled: boolean;
  readonly onPress: (seat: number, disabledReason?: string) => void;
  /** Long press on a bot seat (host takeover); null when not offered. */
  readonly onLongPress: ((seat: number) => void) | null;
  /** Resident decorations drawn on the board's scene layer; null when the seat shows none. */
  readonly residents: ResidentDecorations | null;
  /** The board's scene host; set whenever `residents` is. */
  readonly sceneHostRef: RefObject<HTMLElement | null>;
}

function RoomSeatTileComponent({
  model,
  isBoardDisabled,
  onPress,
  onLongPress,
  residents,
  sceneHostRef,
}: RoomSeatTileProps) {
  const { seat, player, indicators, statusBadge } = model;
  const isBot = player?.occupant.kind === 'bot';
  const longPress = useLongPress(isBot && onLongPress !== null ? () => onLongPress(seat) : null);
  const isMySeat = model.isSelf && player !== null;
  const tileRef = useRef<HTMLButtonElement>(null);
  const avatarRef = useRef<HTMLSpanElement>(null);
  const ghostHostRef = useRef<HTMLSpanElement>(null);
  const hasEntrance = residents !== null && residents.entranceId !== null;

  return (
    <div className="seat-tile" data-testid={TESTIDS.seatTile(seat)}>
      <button
        ref={tileRef}
        type="button"
        className="seat-tile-button"
        data-testid={TESTIDS.seatTilePressable(seat)}
        data-empty={player === null}
        data-framed={residents !== null && residents.frameId !== null}
        data-highlight={model.highlight}
        data-inert={isBoardDisabled || model.disabledReason !== undefined}
        aria-label={describeSeat(model)}
        aria-pressed={
          indicators?.selection === undefined || indicators.selection === null
            ? undefined
            : indicators.selection.kind === 'selected'
        }
        onPointerDown={longPress.onPointerDown}
        onPointerUp={longPress.onPointerUp}
        onPointerLeave={longPress.onPointerLeave}
        onPointerCancel={longPress.onPointerCancel}
        onContextMenu={longPress.onContextMenu}
        onClick={() => {
          if (longPress.consumeLongPress()) return;
          onPress(seat, model.disabledReason);
        }}
      >
        {player === null ? (
          <span className="seat-empty-mark" aria-hidden>
            +
          </span>
        ) : (
          <span className="seat-avatar-stage" data-entrance={hasEntrance} aria-hidden>
            {hasEntrance && <span ref={ghostHostRef} className="seat-avatar-ghosts" />}
            <span ref={avatarRef} className="seat-avatar">
              <Avatar
                userId={getRoomOccupantAvatarSeed(player.occupant)}
                avatarUrl={player.avatarUrl ?? null}
                size="fill"
              />
            </span>
          </span>
        )}
        {model.isStatusEmphasized && player !== null && (
          <span className="seat-status-emphasis" aria-hidden />
        )}
        {model.showReadyBadge && player !== null && (
          <span className="seat-ready-badge" aria-hidden>
            <IconCheckmarkCircle />
          </span>
        )}
        {indicators !== null && player !== null && (
          <SeatMarkers seat={seat} indicators={indicators} />
        )}
        {statusBadge !== null && player !== null && (
          <span
            className="seat-status-badge"
            data-tone={statusBadge.tone}
            data-testid={TESTIDS.seatStatusBadge(seat)}
          >
            {statusBadge.label}
          </span>
        )}
        {model.showLevel && player?.level !== undefined && model.secondaryLabel === null && (
          <span className="seat-level-badge">Lv{player.level}</span>
        )}
      </button>
      <span
        className="seat-number-badge"
        data-mine={isMySeat}
        data-testid={isMySeat ? TESTIDS.mySeatBadge : TESTIDS.seatNumberBadge(seat)}
        aria-hidden
      >
        {seat + 1}
      </span>
      {player === null ? (
        <div className="seat-name-placeholder" />
      ) : (
        <>
          <div
            className="seat-name-row"
            data-anonymous={player.isAnonymous}
            data-testid={TESTIDS.seatNameRow(seat)}
          >
            {isBot && <IconChatbubbleEllipsesOutline className="seat-bot-icon" aria-hidden />}
            <NameStyleText styleId={player.nameStyle} className="seat-name">
              {player.displayName}
            </NameStyleText>
          </div>
          {indicators !== null && <SeatProgress seat={seat} indicators={indicators} />}
          {model.secondaryLabel !== null && (
            <div className="seat-secondary-label">{model.secondaryLabel}</div>
          )}
        </>
      )}
      {residents !== null && (
        <Suspense fallback={null}>
          <RoomSeatResidents
            residents={residents}
            tileRef={tileRef}
            hostRef={sceneHostRef}
            avatarRef={avatarRef}
            ghostHostRef={ghostHostRef}
          />
        </Suspense>
      )}
    </div>
  );
}

export const RoomSeatTile = memo(RoomSeatTileComponent);
