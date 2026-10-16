/**
 * Phase anchor contract for RoomShell.
 *
 * The shell header carries the model's phase verbatim as the DOM attribute
 * `data-phase` (react-native-web maps the `dataSet` prop to data-*
 * attributes; a direct data-* prop would be silently dropped on web).
 * This attribute is the machine-readable phase contract: e2e drivers wait
 * on it to detect phase transitions (e.g. a werewolf night ending)
 * instead of scanning display copy. Display copy may be redesigned
 * freely; this anchor must keep reflecting the game's current phase.
 */

import { render } from '@testing-library/react-native';
import { View } from 'react-native';

import { RoomShell } from '@/features/room/components/RoomShell';
import type { RoomCapabilities } from '@/features/room/model/RoomCapabilities';
import type { RoomShellModel } from '@/features/room/model/RoomShellModel';
import { TESTIDS } from '@/testids';

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

function buildModel(phase: string): RoomShellModel {
  return {
    roomCode: '1234',
    phase,
    capabilities: deniedCapabilities,
    header: {
      onBack: jest.fn(),
      onTitlePress: jest.fn(),
      onTitleLongPress: jest.fn(),
      userAction: null,
    },
    connection: { status: 'live', pendingCommandCount: 0, onManualReconnect: jest.fn() },
    seats: {
      source: {
        count: 0,
        revision: 0,
        getSeat: () => {
          throw new Error('no seats in the phase anchor stub');
        },
      },
      visuallyDisabled: false,
      onSeatPress: jest.fn(),
      onBotSeatLongPress: null,
    },
    seatConfirmation: null,
    profile: null,
    share: {
      isVisible: false,
      roomCode: '1234',
      roomUrl: 'https://example.invalid/room/1234',
      open: jest.fn(),
      close: jest.fn(),
      copyLink: jest.fn(async () => undefined),
      shareImage: jest.fn(async () => undefined),
    },
    bottomActions: { kind: 'info', message: null, progress: null, actions: [] },
    hostManagement: null,
    controlledSeat: null,
  };
}

function renderShell(phase: string) {
  return render(
    <RoomShell
      model={buildModel(phase)}
      content={{ kind: 'workspace', element: <View /> }}
      leadingExtraActions={null}
      trailingExtraActions={null}
      gameOverlays={null}
    />,
  );
}

describe('RoomShell phase anchor', () => {
  it('exposes the model phase verbatim on the shell header', () => {
    const screen = renderShell('Ongoing');
    expect(screen.getByTestId(TESTIDS.roomHeader).props.dataSet).toEqual({
      phase: 'Ongoing',
    });
  });

  it('tracks phase changes across re-renders', () => {
    const screen = renderShell('Ongoing');
    screen.rerender(
      <RoomShell
        model={buildModel('Ended')}
        content={{ kind: 'workspace', element: <View /> }}
        leadingExtraActions={null}
        trailingExtraActions={null}
        gameOverlays={null}
      />,
    );
    expect(screen.getByTestId(TESTIDS.roomHeader).props.dataSet).toEqual({
      phase: 'Ended',
    });
  });
});
