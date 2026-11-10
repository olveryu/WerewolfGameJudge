/** RoomStageHud: chips, countdown, controlled-seat chip, and the roster sheet with bot takeover. */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { RoomCapability } from '@/features/room/model/RoomCapabilities';
import type { RoomControlledSeatModel } from '@/features/room/model/RoomShellModel';
import type { RoomStageHudModel, RoomStageRosterModel } from '@/features/room/model/RoomStage';
import { seatSource, seatViewModel } from '@/test-utils/roomSeat';
import { TESTIDS } from '@/testids';

import { RoomStageHud } from '../RoomStageHud';

const ROSTER: RoomStageRosterModel = {
  chipLabel: '已完成 1/3',
  title: '作答进度',
  groupTitles: { acting: '正在画', pending: '作答中', done: '已完成' },
  actingSeat: null,
  pendingLabel: '作答中',
  isUrgent: false,
};

const SEATS = seatSource([
  seatViewModel(0, { isSelf: true, statusBadge: { label: '已完成', tone: 'success' } }),
  seatViewModel(1, { isBot: true }),
  seatViewModel(2, { isBot: true, statusBadge: { label: '已完成', tone: 'success' } }),
  seatViewModel(3, { player: null }),
  seatViewModel(4),
]);

function renderHud({
  hud = {},
  canTakeOverBots = { isAllowed: false, reason: null },
  controlledSeat = null,
}: {
  readonly hud?: Partial<RoomStageHudModel>;
  readonly canTakeOverBots?: RoomCapability<readonly [seat: number]>;
  readonly controlledSeat?: RoomControlledSeatModel | null;
} = {}) {
  return render(
    <RoomStageHud
      hud={{ chips: [], roster: ROSTER, timer: null, ...hud }}
      seats={SEATS}
      canTakeOverBots={canTakeOverBots}
      controlledSeat={controlledSeat}
    />,
  );
}

describe('RoomStageHud', () => {
  it('renders the game chips in order with their detail', () => {
    renderHud({
      hud: {
        chips: [
          { key: 'round', label: '1/12 轮', detail: null, tone: 'neutral' },
          { key: 'word', label: 'P _ _', detail: '3 字', tone: 'accent' },
        ],
      },
    });
    const hud = screen.getByTestId(TESTIDS.roomStageHud);
    expect(hud).toHaveTextContent(/^1\/12 轮P _ _3 字已完成 1\/3$/);
  });

  it('formats the countdown, turns red at ten seconds and draws the remaining share', () => {
    const { rerender } = renderHud({
      hud: { timer: { label: '作答', remainingSeconds: 76, totalSeconds: 152 } },
    });
    const timer = screen.getByTestId(TESTIDS.roomStageTimer);
    expect(timer).toHaveTextContent('1:16');
    expect(timer).toHaveAccessibleName('作答剩余 76 秒');
    expect(timer).not.toHaveAttribute('data-urgent');
    expect(document.querySelector('.room-stage-timer-bar-fill')).toHaveStyle({ width: '50%' });

    rerender(
      <RoomStageHud
        hud={{
          chips: [],
          roster: null,
          timer: { label: '作答', remainingSeconds: 10, totalSeconds: 152 },
        }}
        seats={SEATS}
        canTakeOverBots={{ isAllowed: false, reason: null }}
        controlledSeat={null}
      />,
    );
    expect(screen.getByTestId(TESTIDS.roomStageTimer)).toHaveAttribute('data-urgent');
  });

  it('reads 不限时 without a bar for an unlimited phase', () => {
    renderHud({ hud: { timer: { label: '作答', remainingSeconds: null, totalSeconds: null } } });
    expect(screen.getByTestId(TESTIDS.roomStageTimer)).toHaveTextContent('不限时');
    expect(document.querySelector('.room-stage-timer-bar')).toBeNull();
  });

  it('opens the roster grouped by status with tags for bots and the viewer', async () => {
    const user = userEvent.setup();
    renderHud();
    await user.click(screen.getByTestId(TESTIDS.roomStageRosterChip));

    const sheet = await screen.findByTestId(TESTIDS.roomStageRosterSheet);
    expect(within(sheet).getByRole('heading', { name: '作答中 · 2' })).toBeInTheDocument();
    expect(within(sheet).getByRole('heading', { name: '已完成 · 2' })).toBeInTheDocument();
    expect(within(sheet).queryByRole('heading', { name: /正在画/ })).not.toBeInTheDocument();
    expect(within(sheet).getByTestId(TESTIDS.roomStageRosterRow(0))).toHaveTextContent(
      '玩家1你已完成',
    );
    expect(within(sheet).getByTestId(TESTIDS.roomStageRosterRow(1))).toHaveTextContent(
      '玩家2机器人作答中',
    );
    expect(within(sheet).queryByTestId(TESTIDS.roomStageRosterRow(3))).not.toBeInTheDocument();
    expect(within(sheet).queryByRole('button', { name: /接管/ })).not.toBeInTheDocument();
  });

  it('lets the host take over an unfinished bot from the roster and closes the sheet', async () => {
    const user = userEvent.setup();
    const execute = vi.fn();
    renderHud({ canTakeOverBots: { isAllowed: true, execute } });
    await user.click(screen.getByTestId(TESTIDS.roomStageRosterChip));

    const sheet = await screen.findByTestId(TESTIDS.roomStageRosterSheet);
    expect(within(sheet).queryByTestId(TESTIDS.roomStageTakeOverButton(2))).not.toBeInTheDocument();
    await user.click(within(sheet).getByTestId(TESTIDS.roomStageTakeOverButton(1)));

    expect(execute).toHaveBeenCalledWith(1);
    await waitFor(() =>
      expect(screen.queryByTestId(TESTIDS.roomStageRosterSheet)).not.toBeInTheDocument(),
    );
  });

  it('offers no takeover while a seat is already controlled and tags the controlled seat', async () => {
    const user = userEvent.setup();
    const onRelease = vi.fn();
    renderHud({
      canTakeOverBots: { isAllowed: true, execute: vi.fn() },
      controlledSeat: { seat: 1, displayName: '玩家2', onRelease },
    });

    const chip = screen.getByTestId(TESTIDS.controlledSeatBanner);
    expect(chip).toHaveAccessibleName('正在操控 2 号位（玩家2）');
    expect(chip).toHaveTextContent('代 2 号');
    await user.click(screen.getByTestId(TESTIDS.controlledSeatReleaseButton));
    expect(onRelease).toHaveBeenCalledTimes(1);

    await user.click(screen.getByTestId(TESTIDS.roomStageRosterChip));
    const sheet = await screen.findByTestId(TESTIDS.roomStageRosterSheet);
    expect(within(sheet).getByTestId(TESTIDS.roomStageRosterRow(1))).toHaveTextContent('你在代');
    expect(within(sheet).queryByRole('button', { name: /^接管/ })).not.toBeInTheDocument();
  });

  it('marks the roster chip when a bot must be taken over soon', () => {
    renderHud({ hud: { roster: { ...ROSTER, isUrgent: true } } });
    const chip = screen.getByTestId(TESTIDS.roomStageRosterChip);
    expect(chip).toHaveAttribute('data-urgent');
    expect(chip).toHaveAccessibleName('已完成 1/3，有机器人等待接管');
  });
});
