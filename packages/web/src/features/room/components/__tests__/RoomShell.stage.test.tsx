/**
 * RoomShell stage content (docs/room-stage-layout-design.md): host management opens from the
 * header, no bottom panel or takeover banner renders, and a stage shell model carrying bottom
 * content fails fast.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';

import {
  createRoomShellModel,
  type RoomShellModelInput,
} from '@/features/room/model/createRoomShellModel';
import { HOST_ACTION_KEYS } from '@/features/room/model/hostManagementActions';
import type { RoomBottomStackModel } from '@/features/room/model/RoomBottomActions';
import type { RoomCapabilities } from '@/features/room/model/RoomCapabilities';
import type { RoomStageHudModel } from '@/features/room/model/RoomStage';
import { seatSource, seatViewModel } from '@/test-utils/roomSeat';
import { viewerFor } from '@/test-utils/roomViewer';
import { TESTIDS } from '@/testids';
import { alertStore } from '@/utils/alert';

import { RoomShell } from '../RoomShell';
import { RoomStageMenu } from '../RoomStageMenu';

it('explains an unavailable stage-menu action without closing the menu', () => {
  const onClose = vi.fn();
  render(
    <RoomStageMenu
      model={{ onOpenGuide: vi.fn(), onOpenConfiguration: vi.fn() }}
      abortAction={{
        key: 'abort-game',
        label: '中止本局',
        icon: 'close',
        variant: 'danger',
        isEnabled: false,
        disabledReason: '语音播报中，请稍候',
      }}
      onClose={onClose}
    />,
  );
  const action = screen.getByRole('button', { name: '中止本局' });
  expect(action).toHaveAttribute('aria-disabled', 'true');
  expect(action).toHaveAccessibleDescription('语音播报中，请稍候');
  fireEvent.click(action);
  expect(alertStore.getSnapshot()).toMatchObject({
    title: '暂不可用',
    message: '语音播报中，请稍候',
  });
  expect(onClose).not.toHaveBeenCalled();
});

it('keeps the stage menu open when an abort action requests confirmation', () => {
  const onClose = vi.fn();
  const onPress = vi.fn();
  render(
    <RoomStageMenu
      model={{ onOpenGuide: vi.fn(), onOpenConfiguration: vi.fn() }}
      abortAction={{
        key: 'abort-game',
        label: '中止本局',
        icon: 'close',
        variant: 'danger',
        isEnabled: true,
        onPress,
      }}
      onClose={onClose}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: '中止本局' }));
  expect(onPress).toHaveBeenCalledOnce();
  expect(onClose).not.toHaveBeenCalled();
});

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

  it.each(['host', 'seated'] as const)(
    'keeps room sharing in the %s hand, not beside the room code or in host management',
    (viewerRole) => {
      const shareRoom = vi.fn();
      render(
        <RoomShell
          model={createRoomShellModel(
            shellInput({
              viewer: viewerFor(viewerRole),
              capabilities: {
                ...deniedCapabilities,
                canShareRoom: { isAllowed: true, execute: shareRoom },
              },
              buildHostManagement: () => ({
                task: null,
                sections: [
                  {
                    key: 'room',
                    title: '房间',
                    actions: [
                      {
                        key: HOST_ACTION_KEYS.shareRoom,
                        label: '分享房间',
                        icon: 'share-social-outline',
                        variant: 'secondary',
                        isEnabled: true,
                        onPress: shareRoom,
                      },
                    ],
                  },
                ],
              }),
            }),
          )}
          content={{
            kind: 'seats',
            contextHeader: null,
            bottomSummary: null,
            beforeSeatBoard: <></>,
            afterSeatBoard: null,
            sideInspector: null,
          }}
          showPlayerHand
          leadingExtraActions={null}
          trailingExtraActions={null}
          gameOverlays={null}
        />,
      );
      expect(
        within(screen.getByTestId(TESTIDS.roomHeader)).queryByRole('button', {
          name: '分享房间',
        }),
      ).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: '分享房间' }));
      expect(shareRoom).toHaveBeenCalledOnce();
      if (viewerRole === 'host') {
        fireEvent.click(screen.getByTestId(TESTIDS.roomMoreActionsButton));
        expect(screen.queryByRole('button', { name: '分享房间' })).not.toBeInTheDocument();
      }
    },
  );

  it.each(['seat selection', 'stage'] as const)(
    'closes the host hand only when entering %s',
    (transition) => {
      const model = createRoomShellModel(shellInput());
      const room = (afterTransition: boolean) => (
        <RoomShell
          model={model}
          content={
            afterTransition && transition === 'stage'
              ? { kind: 'stage', hud: HUD, element: <p>舞台内容</p> }
              : {
                  kind: 'seats',
                  contextHeader: null,
                  bottomSummary: null,
                  beforeSeatBoard: <></>,
                  afterSeatBoard: null,
                  sideInspector: null,
                }
          }
          showPlayerHand
          isSelecting={afterTransition && transition === 'seat selection'}
          leadingExtraActions={null}
          trailingExtraActions={null}
          gameOverlays={null}
        />
      );
      const view = render(room(false));
      fireEvent.click(screen.getByTestId(TESTIDS.roomMoreActionsButton));
      expect(screen.getByTestId(TESTIDS.roomHostManagementPanel)).toBeInTheDocument();
      view.rerender(room(true));
      expect(screen.queryByTestId(TESTIDS.roomHostManagementPanel)).not.toBeInTheDocument();
    },
  );

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

  it('switches the stage hand without remounting the stage or trapping it in a dialog', async () => {
    const user = userEvent.setup();
    const onOpenGuide = vi.fn();
    const onOpenConfiguration = vi.fn();
    const stage = (
      <RoomShell
        model={createRoomShellModel(shellInput({ viewer: viewerFor('seated') }))}
        content={{
          kind: 'stage',
          hud: HUD,
          element: <input aria-label="舞台输入" />,
        }}
        leadingExtraActions={null}
        trailingExtraActions={null}
        stageMenu={{ onOpenGuide, onOpenConfiguration }}
        gameOverlays={null}
      />
    );
    const view = render(stage);
    const input = screen.getByRole('textbox', { name: '舞台输入' });
    await user.type(input, '草稿');
    const entry = screen.getByTestId(TESTIDS.roomStageMenuButton);
    await user.click(entry);

    const hand = screen.getByRole('group', { name: '菜单' });
    expect(hand).not.toHaveAttribute('role', 'dialog');
    expect(screen.getByTestId(TESTIDS.roomStageMenuBackButton)).toHaveFocus();
    expect(screen.queryByTestId(TESTIDS.abortGameButton)).not.toBeInTheDocument();
    await user.click(within(hand).getByTestId(TESTIDS.roomManualButton));
    expect(screen.getByTestId(TESTIDS.roomStageMenuBackButton)).toHaveFocus();
    await user.click(screen.getByTestId(TESTIDS.roomStageGuideButton));
    expect(onOpenGuide).toHaveBeenCalledOnce();
    await user.keyboard('{Escape}');
    expect(screen.getByTestId(TESTIDS.roomManualButton)).toHaveFocus();
    await user.click(screen.getByTestId(TESTIDS.roomStageConfigurationButton));
    expect(onOpenConfiguration).toHaveBeenCalledOnce();
    view.rerender(stage);
    await user.click(screen.getByTestId(TESTIDS.roomStageMenuBackButton));

    expect(entry).toHaveFocus();
    expect(screen.getByRole('textbox', { name: '舞台输入' })).toBe(input);
    expect(input).toHaveValue('草稿');
    expect(screen.queryByTestId(TESTIDS.roomStageMenuPanel)).not.toBeInTheDocument();
  });

  it('uses the current authorized host abort action from the stage hand', async () => {
    const user = userEvent.setup();
    const onAbort = vi.fn();
    render(
      <RoomShell
        model={createRoomShellModel(
          shellInput({
            buildHostManagement: () => ({
              task: null,
              sections: [
                {
                  key: 'danger',
                  title: '危险操作',
                  actions: [
                    {
                      key: HOST_ACTION_KEYS.abortGame,
                      label: '中止游戏',
                      icon: 'stop-circle-outline',
                      variant: 'danger',
                      isEnabled: true,
                      onPress: onAbort,
                      testID: TESTIDS.abortGameButton,
                    },
                  ],
                },
              ],
            }),
          }),
        )}
        content={{ kind: 'stage', hud: HUD, element: <p>舞台内容</p> }}
        leadingExtraActions={null}
        trailingExtraActions={null}
        stageMenu={{ onOpenGuide: vi.fn(), onOpenConfiguration: vi.fn() }}
        gameOverlays={null}
      />,
    );
    await user.click(screen.getByTestId(TESTIDS.roomStageMenuButton));
    await user.click(screen.getByTestId(TESTIDS.abortGameButton));
    expect(onAbort).toHaveBeenCalledOnce();
    expect(screen.getByTestId(TESTIDS.roomStageMenuPanel)).toBeInTheDocument();
  });

  it('does not reopen an obsolete panel when actions become available again', async () => {
    const user = userEvent.setup();
    const shell = (hasActions: boolean) => (
      <RoomShell
        model={createRoomShellModel(
          shellInput(hasActions ? {} : { buildHostManagement: () => null }),
        )}
        content={{ kind: 'stage', hud: HUD, element: <p>舞台内容</p> }}
        leadingExtraActions={null}
        trailingExtraActions={null}
        gameOverlays={null}
      />
    );
    const view = render(shell(true));
    await user.click(screen.getByTestId(TESTIDS.roomHostManagementButton));
    expect(screen.getByTestId(TESTIDS.roomHostManagementPanel)).toBeInTheDocument();

    view.rerender(shell(false));
    expect(screen.queryByTestId(TESTIDS.roomHostManagementPanel)).not.toBeInTheDocument();
    view.rerender(shell(true));

    expect(screen.getByTestId(TESTIDS.roomHostManagementButton)).toBeInTheDocument();
    expect(screen.queryByTestId(TESTIDS.roomHostManagementPanel)).not.toBeInTheDocument();
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
