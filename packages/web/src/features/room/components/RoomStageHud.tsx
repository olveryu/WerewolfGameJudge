/**
 * Stage information bar (docs/room-stage-layout-design.md): one row of chips — the game's
 * information chips, the roster chip, the host's controlled-seat chip and the countdown — over a
 * thin countdown bar. The roster chip opens the roster sheet, which also carries the host's bot
 * takeover. Pure presentation over the shell model and the game's stage model.
 */
import './RoomStageHud.css';

import { useState } from 'react';

import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import { formatCountdownSeconds } from '@/features/room/model/formatCountdown';
import type { RoomCapability } from '@/features/room/model/RoomCapabilities';
import type { RoomSeatDataSource } from '@/features/room/model/RoomSeatDataSource';
import type { RoomControlledSeatModel } from '@/features/room/model/RoomShellModel';
import {
  groupRoomStageRoster,
  ROOM_STAGE_URGENT_SECONDS,
  type RoomStageChip,
  type RoomStageHudModel,
  type RoomStageRosterEntry,
  type RoomStageRosterGroup,
  type RoomStageRosterModel,
  type RoomStageTimerModel,
} from '@/features/room/model/RoomStage';
import { TESTIDS } from '@/testids';
import IconChevronForward from '~icons/ion/chevron-forward';
import IconClose from '~icons/ion/close';
import IconGameControllerOutline from '~icons/ion/game-controller-outline';

function StageChip({ chip }: { readonly chip: RoomStageChip }) {
  return (
    <span
      className="room-stage-chip"
      data-tone={chip.tone}
      data-testid={TESTIDS.roomStageChip(chip.key)}
    >
      {chip.label}
      {chip.detail !== null && <small className="room-stage-chip-detail">{chip.detail}</small>}
    </span>
  );
}

function TimerChip({ timer }: { readonly timer: RoomStageTimerModel }) {
  const remaining = timer.remainingSeconds;
  const isUrgent = remaining !== null && remaining <= ROOM_STAGE_URGENT_SECONDS;
  return (
    <span
      className="room-stage-chip room-stage-timer"
      role="timer"
      aria-label={
        remaining === null ? `${timer.label}不限时` : `${timer.label}剩余 ${remaining} 秒`
      }
      data-urgent={isUrgent || undefined}
      data-testid={TESTIDS.roomStageTimer}
    >
      {remaining === null ? '不限时' : formatCountdownSeconds(remaining)}
    </span>
  );
}

/** Elapsed share of the phase as a bar; nothing when the phase is unlimited or its length unknown. */
function TimerBar({ timer }: { readonly timer: RoomStageTimerModel | null }) {
  if (timer === null || timer.remainingSeconds === null || timer.totalSeconds === null) {
    return null;
  }
  const remainingRatio = Math.min(1, timer.remainingSeconds / timer.totalSeconds);
  return (
    <div className="room-stage-timer-bar" aria-hidden>
      <span
        className="room-stage-timer-bar-fill"
        data-urgent={timer.remainingSeconds <= ROOM_STAGE_URGENT_SECONDS || undefined}
        style={{ width: `${remainingRatio * 100}%` }}
      />
    </div>
  );
}

function ControlledSeatChip({ model }: { readonly model: RoomControlledSeatModel }) {
  return (
    <span
      className="room-stage-chip room-stage-controlled"
      role="group"
      aria-label={`正在操控 ${model.seat + 1} 号位（${model.displayName}）`}
      data-testid={TESTIDS.controlledSeatBanner}
    >
      <IconGameControllerOutline aria-hidden />
      {`代 ${model.seat + 1} 号`}
      <button
        type="button"
        className="room-stage-controlled-release"
        onClick={model.onRelease}
        aria-label="退出机器人接管"
        data-testid={TESTIDS.controlledSeatReleaseButton}
      >
        退出
      </button>
    </span>
  );
}

function RosterRow({
  entry,
  controlledSeat,
  takeOver,
}: {
  readonly entry: RoomStageRosterEntry;
  readonly controlledSeat: number | null;
  /** Present when the viewer may take this bot over now. */
  readonly takeOver: (() => void) | null;
}) {
  return (
    <li className="room-stage-roster-row" data-testid={TESTIDS.roomStageRosterRow(entry.seat)}>
      <span className="room-stage-roster-seat" aria-hidden>
        {entry.seat + 1}
      </span>
      <span className="room-stage-roster-who">
        <span className="visually-hidden">{`${entry.seat + 1}号位 `}</span>
        <span className="room-stage-roster-name">{entry.displayName}</span>
        {entry.isBot && <span className="room-stage-roster-tag">机器人</span>}
        {entry.isSelf && (
          <span className="room-stage-roster-tag" data-kind="self">
            你
          </span>
        )}
        {entry.seat === controlledSeat && (
          <span className="room-stage-roster-tag" data-kind="controlled">
            你在代
          </span>
        )}
      </span>
      <span className="room-stage-roster-status" data-tone={entry.statusTone}>
        {entry.statusLabel}
      </span>
      {takeOver !== null && (
        <Button
          variant="secondary"
          onClick={takeOver}
          aria-label={`接管 ${entry.seat + 1} 号位（${entry.displayName}）`}
          data-testid={TESTIDS.roomStageTakeOverButton(entry.seat)}
        >
          接管
        </Button>
      )}
    </li>
  );
}

const ROSTER_GROUP_ORDER: readonly RoomStageRosterGroup[] = ['acting', 'pending', 'done'];

function RosterSheet({
  roster,
  seats,
  canTakeOverBots,
  controlledSeat,
  onClose,
}: {
  readonly roster: RoomStageRosterModel;
  readonly seats: RoomSeatDataSource;
  readonly canTakeOverBots: RoomCapability<readonly [seat: number]>;
  readonly controlledSeat: number | null;
  readonly onClose: () => void;
}) {
  const groups = groupRoomStageRoster(seats, roster);
  const takeOverFor = (entry: RoomStageRosterEntry): (() => void) | null =>
    canTakeOverBots.isAllowed && controlledSeat === null && entry.isBot && entry.group !== 'done'
      ? () => {
          onClose();
          canTakeOverBots.execute(entry.seat);
        }
      : null;
  return (
    <BottomSheet title={roster.title} onClose={onClose} testId={TESTIDS.roomStageRosterSheet}>
      <header className="room-stage-roster-header">
        <h2 className="room-stage-roster-title">{roster.title}</h2>
        <IconButton
          label={`关闭${roster.title}`}
          icon={<IconClose aria-hidden />}
          onClick={onClose}
        />
      </header>
      <div className="room-stage-roster-body">
        {ROSTER_GROUP_ORDER.filter((group) => groups[group].length > 0).map((group) => (
          <section key={group} className="room-stage-roster-group">
            <h3 className="room-stage-roster-group-title">
              {`${roster.groupTitles[group]} · ${groups[group].length}`}
            </h3>
            <ul className="room-stage-roster-list">
              {groups[group].map((entry) => (
                <RosterRow
                  key={entry.seat}
                  entry={entry}
                  controlledSeat={controlledSeat}
                  takeOver={takeOverFor(entry)}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </BottomSheet>
  );
}

/** Renders the stage information bar and owns the roster sheet's open state. */
export function RoomStageHud({
  hud,
  seats,
  canTakeOverBots,
  controlledSeat,
}: {
  readonly hud: RoomStageHudModel;
  readonly seats: RoomSeatDataSource;
  readonly canTakeOverBots: RoomCapability<readonly [seat: number]>;
  readonly controlledSeat: RoomControlledSeatModel | null;
}) {
  const [isRosterOpen, setIsRosterOpen] = useState(false);
  const roster = hud.roster;
  return (
    <div className="room-stage-hud" data-testid={TESTIDS.roomStageHud}>
      <div className="room-stage-hud-row">
        {hud.chips.map((chip) => (
          <StageChip key={chip.key} chip={chip} />
        ))}
        {roster !== null && (
          <button
            type="button"
            className="room-stage-chip room-stage-roster-chip"
            aria-haspopup="dialog"
            aria-label={roster.isUrgent ? `${roster.chipLabel}，有机器人等待接管` : undefined}
            data-urgent={roster.isUrgent || undefined}
            onClick={() => setIsRosterOpen(true)}
            data-testid={TESTIDS.roomStageRosterChip}
          >
            {roster.isUrgent && (
              <span className="room-stage-roster-alert" aria-hidden>
                !
              </span>
            )}
            {roster.chipLabel}
            <IconChevronForward aria-hidden />
          </button>
        )}
        <span className="room-stage-hud-spacer" />
        {hud.timer !== null && <TimerChip timer={hud.timer} />}
        {controlledSeat !== null && <ControlledSeatChip model={controlledSeat} />}
        {hud.secondaryChips.map((chip) => (
          <StageChip key={chip.key} chip={chip} />
        ))}
      </div>
      <TimerBar timer={hud.timer} />
      {isRosterOpen && roster !== null && (
        <RosterSheet
          roster={roster}
          seats={seats}
          canTakeOverBots={canTakeOverBots}
          controlledSeat={controlledSeat === null ? null : controlledSeat.seat}
          onClose={() => setIsRosterOpen(false)}
        />
      )}
    </div>
  );
}
