/** Shared seat-press execution contracts; game rules remain in the supplied intent resolver. */

import type {
  RoomSeatTapIntent,
  RoomSeatTapResolverInput,
} from '@/features/room/model/RoomSeatTap';
import { showErrorAlert } from '@/utils/alertPresets';

import { createRoomSeatPressHandler } from '../createRoomSeatPressHandler';

jest.mock('@/utils/alertPresets', () => ({ showErrorAlert: jest.fn() }));

const state = { phase: 'lobby' };
const target = { seat: 2, userId: 'player' };
const resolveIntent = jest.fn<
  RoomSeatTapIntent<typeof target>,
  [RoomSeatTapResolverInput<typeof state>]
>();
const profile = { open: jest.fn() };
const seatController = { requestTakeSeat: jest.fn(), requestMoveSeat: jest.fn() };

function createHandler(isSetup: boolean) {
  return createRoomSeatPressHandler({
    isSetup,
    state,
    currentSeat: 0,
    resolveIntent,
    profile,
    seatController,
  });
}

beforeEach(() => jest.clearAllMocks());

describe('createRoomSeatPressHandler', () => {
  it('resolves setup taps with the current state and opens the resolved profile', () => {
    resolveIntent.mockReturnValue({ kind: 'profile', target });
    createHandler(true)(2);
    expect(resolveIntent).toHaveBeenCalledWith({
      state,
      seat: 2,
      currentSeat: 0,
      disabledReason: undefined,
    });
    expect(profile.open).toHaveBeenCalledWith(target);
    expect(seatController.requestTakeSeat).not.toHaveBeenCalled();
    expect(seatController.requestMoveSeat).not.toHaveBeenCalled();
  });

  it.each(['take', 'move'] as const)('executes the resolved %s destination', (kind) => {
    resolveIntent.mockReturnValue({ kind, seat: 3 });
    createHandler(true)(2);
    const expected =
      kind === 'take' ? seatController.requestTakeSeat : seatController.requestMoveSeat;
    const unexpected =
      kind === 'take' ? seatController.requestMoveSeat : seatController.requestTakeSeat;
    expect(expected).toHaveBeenCalledWith(3);
    expect(unexpected).not.toHaveBeenCalled();
    expect(profile.open).not.toHaveBeenCalled();
  });

  it('forwards the disabled reason and displays the setup rejection', () => {
    resolveIntent.mockReturnValue({ kind: 'blocked', reason: '不能入座' });
    createHandler(true)(2, '不能入座');
    expect(resolveIntent).toHaveBeenCalledWith({
      state,
      seat: 2,
      currentSeat: 0,
      disabledReason: '不能入座',
    });
    expect(showErrorAlert).toHaveBeenCalledWith('不可选择', '不能入座');
    expect(profile.open).not.toHaveBeenCalled();
    expect(seatController.requestTakeSeat).not.toHaveBeenCalled();
    expect(seatController.requestMoveSeat).not.toHaveBeenCalled();
  });

  it.each([undefined, '游戏进行中不能入座'])(
    'does not resolve or execute setup intents in-game (%s)',
    (disabledReason) => {
      createHandler(false)(2, disabledReason);
      expect(resolveIntent).not.toHaveBeenCalled();
      expect(profile.open).not.toHaveBeenCalled();
      expect(seatController.requestTakeSeat).not.toHaveBeenCalled();
      expect(seatController.requestMoveSeat).not.toHaveBeenCalled();
      if (disabledReason === undefined) {
        expect(showErrorAlert).not.toHaveBeenCalled();
      } else {
        expect(showErrorAlert).toHaveBeenCalledWith('不可选择', disabledReason);
      }
    },
  );
});
