/**
 * RoomShell stage content (docs/room-stage-layout-design.md): host management opens from the
 * header, no bottom panel or takeover banner renders, and a stage shell model carrying bottom
 * content fails fast.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';

import {
  createRoomShellModel,
  type RoomShellModelInput,
} from '@/features/room/model/createRoomShellModel';
import type { RoomBottomStackModel } from '@/features/room/model/RoomBottomActions';
import type { RoomCapabilities } from '@/features/room/model/RoomCapabilities';
import type { RoomStageHudModel } from '@/features/room/model/RoomStage';
import { seatSource, seatViewModel } from '@/test-utils/roomSeat';
import { viewerFor } from '@/test-utils/roomViewer';
import { TESTIDS } from '@/testids';

import { RoomShell } from '../RoomShell';

const deniedCapabilities: RoomCapabilities = {
  canTakeSeat: { isAllowed: false, reason: null },
  canMoveSeat: { isAllowed: false, reason: null },
  canLeaveSeat: { isAllowed: false, reason: null },
  canKickSeat: { isAllowed: false, reason: null },
  canClearSeats: { isAllowed: false, reason: null },
  canFillBots: { isAllowed: false, reason: null },
  canConfigureGame: { isAllowed: false, reason: null },
  canViewProfiles: { isAllowed: false, reason: null },
  canTakeOverBots: { isAllowed: false, reason: null },
  canShareRoom: { isAllowed: false, reason: null },
  shouldConfirmExit: false,
};

const EMPTY_STACK: RoomBottomStackModel = {
  kind: 'stacked',
  message: null,
  progress: null,
  layout: { primary: [], secondary: [], ghost: [] },
};

const HUD: RoomStageHudModel = {
  chips: [{ key: 'step', label: '第 2/5 棒', detail: null, tone: 'neutral' }],
  roster: null,
  timer: { label: '作答', remainingSeconds: 30, totalSeconds: 60 },
  secondaryChips: [],
};

function shellInput(overrides: Partial<RoomShellModelInput> = {}): RoomShellModelInput {
  const viewer = viewerFor('host');
  return {
    roomCode: '1234',
    viewer,
    phase: 'answering',
    step: null,
    isAudioPlaying: false,
    capabilities: deniedCapabilities,
    onBack: vi.fn(),
    onTitlePress: vi.fn(),
    onTitleLongPress: vi.fn(),
    user: null,
    gachaStatus: null,
    onUserActionPress: vi.fn(),
    connection: { status: { kind: 'live' }, pendingDurableCount: 0, onRetryNow: vi.fn() },
    seatSource: seatSource([seatViewModel(0, { isSelf: true }), seatViewModel(1, { isBot: true })]),
    seatsVisuallyDisabled: false,
    onSeatPress: vi.fn(),
    onBotSeatLongPress: null,
    seatConfirmation: null,
    profile: null,
    share: {
      isVisible: false,
      roomCode: '1234',
      roomUrl: 'https://example.test/1234',
      open: vi.fn(),
      close: vi.fn(),
      copyLink: vi.fn(async () => undefined),
      shareImage: vi.fn(async () => undefined),
    },
    bottomActions: EMPTY_STACK,
    buildHostManagement: () => ({
      task: null,
      sections: [
        {
          key: 'danger',
          title: '危险操作',
          actions: [
            {
              key: 'abort',
              label: '结束本局',
              icon: 'stop-circle-outline',
              variant: 'danger',
              isEnabled: true,
              onPress: vi.fn(),
            },
          ],
        },
      ],
    }),
    controlledSeat: null,
    ...overrides,
  };
}

function renderStage(overrides: Partial<RoomShellModelInput> = {}, hudAction?: ReactElement) {
  return render(
    <RoomShell
      model={createRoomShellModel(shellInput(overrides))}
      content={{
        kind: 'stage',
        hud: HUD,
        ...(hudAction === undefined ? {} : { hudAction }),
        element: <p>舞台内容</p>,
      }}
      leadingExtraActions={null}
      trailingExtraActions={null}
      gameOverlays={null}
    />,
  );
}

describe('RoomShell stage content', () => {
  beforeAll(() => {
    // jsdom reports a 0 layout width, which the room layout rejects; use a phone width.
    Object.defineProperty(document.documentElement, 'clientWidth', {
      configurable: true,
      value: 390,
    });
  });

  it('renders the information bar over the element with no bottom panel', () => {
    renderStage();
    expect(screen.getByTestId(TESTIDS.roomStageHud)).toHaveTextContent('第 2/5 棒');
    expect(screen.getByText('舞台内容')).toBeInTheDocument();
    expect(screen.queryByTestId(TESTIDS.bottomActionPanel)).not.toBeInTheDocument();
  });

  it('passes a game-owned ranking action into the information bar', () => {
    renderStage({}, <button type="button">总排名</button>);
    expect(screen.getByTestId(TESTIDS.roomStageHud)).toContainElement(
      screen.getByRole('button', { name: '总排名' }),
    );
  });

  it('embeds one shared HUD with working roster and takeover controls in a stage-owned panel', async () => {
    const user = userEvent.setup();
    const onRelease = vi.fn();
    render(
      <RoomShell
        model={createRoomShellModel(
          shellInput({
            controlledSeat: { seat: 1, displayName: '机器人2', onRelease },
          }),
        )}
        content={{
          kind: 'stage',
          hud: {
            ...HUD,
            rosterPlacement: 'primary',
            roster: {
              chipLabel: '名单 2 人',
              title: '本局玩家',
              groupTitles: { acting: '行动', pending: '等待', done: '完成' },
              actingSeat: null,
              pendingLabel: '等待',
              isUrgent: false,
            },
          },
          element: (renderHud) => (
            <section aria-label="信息与反馈">{renderHud(<p>当前操作提示</p>, 'success')}</section>
          ),
        }}
        leadingExtraActions={null}
        trailingExtraActions={null}
        gameOverlays={null}
      />,
    );
    const panel = screen.getByRole('region', { name: '信息与反馈' });
    expect(screen.getAllByTestId(TESTIDS.roomStageHud)).toHaveLength(1);
    expect(within(panel).getByTestId(TESTIDS.roomStageHud)).toHaveAttribute('data-embedded');
    expect(within(panel).getByTestId(TESTIDS.roomStageHud)).toHaveClass('room-stage-panel');
    expect(within(panel).getByTestId(TESTIDS.roomStageHud)).toHaveAttribute('data-tone', 'success');
    expect(panel.querySelectorAll('.room-stage-panel')).toHaveLength(1);
    await user.click(within(panel).getByTestId(TESTIDS.roomStageRosterChip));
    expect(screen.getByTestId(TESTIDS.roomStageRosterSheet)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '关闭本局玩家' }));
    await user.click(within(panel).getByTestId(TESTIDS.controlledSeatReleaseButton));
    expect(onRelease).toHaveBeenCalledOnce();
  });

  it('opens host management from the header', async () => {
    const user = userEvent.setup();
    renderStage();
    const entry = screen.getByTestId(TESTIDS.roomHostManagementButton);
    expect(screen.getByTestId(TESTIDS.roomHeader)).toContainElement(entry);

    await user.click(entry);
    expect(await screen.findByRole('button', { name: /结束本局/ })).toBeInTheDocument();
  });

  it('shows no host entry for a player', () => {
    renderStage({ viewer: viewerFor('seated') });
    expect(screen.queryByTestId(TESTIDS.roomHostManagementButton)).not.toBeInTheDocument();
  });

  it('reports a takeover as an information bar chip instead of the banner', () => {
    renderStage({ controlledSeat: { seat: 1, displayName: '机器人2', onRelease: vi.fn() } });
    expect(screen.getByTestId(TESTIDS.roomStageHud)).toContainElement(
      screen.getByTestId(TESTIDS.controlledSeatBanner),
    );
    expect(document.querySelector('.controlled-seat-banner')).toBeNull();
  });

  it('fails fast when the stage shell model still carries bottom content', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() =>
      renderStage({ bottomActions: { ...EMPTY_STACK, message: '等待本轮结算' } }),
    ).toThrow('Stage content cannot carry bottom actions');
  });
});
