/**
 * RoomShell stage content (docs/room-stage-layout-design.md): host management opens from the
 * header, no bottom panel or takeover banner renders, and a stage shell model carrying bottom
 * content fails fast.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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

function renderStage(overrides: Partial<RoomShellModelInput> = {}) {
  return render(
    <RoomShell
      model={createRoomShellModel(shellInput(overrides))}
      content={{ kind: 'stage', hud: HUD, element: <p>舞台内容</p> }}
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
