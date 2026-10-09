/**
 * Characterization tests for the WerewolfRoomScreen shell-model assembly.
 *
 * Pins the CURRENT RoomShellModel the Screen assembles from the room state
 * (bottom-action branching, seat gating, host-management presence, header
 * wiring) so the planned assembly refactor (moving assembly into the screen
 * state hook behind an explicit interface) cannot silently change behavior.
 * The RoomShell itself is replaced by a probe that captures the model.
 */

import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';
import { render } from '@testing-library/react-native';

import type { RoomShellModel } from '@/features/room/model/RoomShellModel';
import {
  createWerewolfRoomMock,
  mockNavigation,
  mockRoom,
  waitForRoomScreen,
} from '@/games/werewolf/room/__tests__/harness';
import { WerewolfRoomScreen } from '@/games/werewolf/room/__tests__/harness/ReadyWerewolfRoomScreen';

let mockUseWerewolfRoomReturn: ReturnType<typeof createWerewolfRoomMock>;
let mockCapturedShellModel: RoomShellModel | null = null;

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ fontScale: 1, height: 844, scale: 1, width: 390 }),
}));

jest.mock('@/games/werewolf/hooks/useWerewolfRoom', () => ({
  useWerewolfRoom: () => mockUseWerewolfRoomReturn,
}));

jest.mock('../useRoomHostDialogs', () => ({
  useRoomHostDialogs: () => ({
    showPrepareToFlipDialog: jest.fn(),
    showStartGameDialog: jest.fn(),
    showRestartDialog: jest.fn(),
    handleSettingsPress: jest.fn(),
  }),
}));

jest.mock('@/features/room/components/RoomShell', () => {
  const { View } = require('react-native') as typeof import('react-native');
  return {
    RoomShell: (props: { readonly model: RoomShellModel }) => {
      mockCapturedShellModel = props.model;
      return <View testID="room-screen-root" />;
    },
  };
});

function renderRoom() {
  return render(
    <WerewolfRoomScreen room={mockRoom} entryReason={null} navigation={mockNavigation} />,
  );
}

async function captureModel(screen: ReturnType<typeof renderRoom>): Promise<RoomShellModel> {
  await waitForRoomScreen(screen.getByTestId);
  if (mockCapturedShellModel === null) throw new Error('RoomShell model was not captured');
  return mockCapturedShellModel;
}

describe('WerewolfRoomScreen shell model assembly (characterization)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCapturedShellModel = null;
  });

  it('assembles the baseline model during a night action that is not mine', async () => {
    mockUseWerewolfRoomReturn = createWerewolfRoomMock({
      schemaId: 'seerCheck',
      currentActionRole: 'seer',
      myRole: 'villager',
      mySeat: 3,
      numberOfPlayers: 4,
    });

    const model = await captureModel(renderRoom());

    expect(model.roomCode).toBe('1234');
    expect(model.connection.status).toBe('live');
    expect(model.header.userAction).not.toBeNull();
    expect(model.header.userAction?.ticketCount).toBeNull();
    expect(model.seats.visuallyDisabled).toBe(false);
    expect(model.seats.onBotSeatLongPress).toBeNull();
    expect(model.bottomActions.kind).toBe('stacked');
    if (model.bottomActions.kind === 'stacked') {
      expect(model.bottomActions.message).toBeNull();
    }
    expect(model.hostManagement).toBeNull();
    expect(model.controlledSeat).toBeNull();
    expect(model.profile).toBeNull();
    expect(model.seatConfirmation).toBeNull();
  });

  it('surfaces the action message on the stacked dock when it is my action', async () => {
    mockUseWerewolfRoomReturn = createWerewolfRoomMock({
      schemaId: 'seerCheck',
      currentActionRole: 'seer',
      myRole: 'seer',
      mySeat: 0,
      numberOfPlayers: 4,
    });

    const model = await captureModel(renderRoom());

    expect(model.bottomActions.kind).toBe('stacked');
    if (model.bottomActions.kind === 'stacked') {
      expect(typeof model.bottomActions.message).toBe('string');
      expect(model.bottomActions.message).not.toBe('');
    }
  });

  it('disables seats and hides the action message while audio is playing', async () => {
    mockUseWerewolfRoomReturn = createWerewolfRoomMock({
      schemaId: 'seerCheck',
      currentActionRole: 'seer',
      myRole: 'seer',
      mySeat: 0,
      numberOfPlayers: 4,
      isAudioPlaying: true,
    });

    const model = await captureModel(renderRoom());

    expect(model.seats.visuallyDisabled).toBe(true);
    expect(model.bottomActions.kind).toBe('stacked');
    if (model.bottomActions.kind === 'stacked') {
      expect(model.bottomActions.message).toBeNull();
    }
  });

  it('includes host management only for the host', async () => {
    mockUseWerewolfRoomReturn = createWerewolfRoomMock({
      schemaId: 'seerCheck',
      currentActionRole: 'seer',
      myRole: 'villager',
      mySeat: 0,
      numberOfPlayers: 4,
      isHost: true,
    });

    const model = await captureModel(renderRoom());

    expect(model.hostManagement).not.toBeNull();
  });

  it('switches the bottom actions to the info form once the game has ended', async () => {
    mockUseWerewolfRoomReturn = createWerewolfRoomMock({
      schemaId: 'seerCheck',
      currentActionRole: 'seer',
      myRole: 'villager',
      mySeat: 3,
      numberOfPlayers: 4,
      gameStateOverrides: { status: GameStatus.Ended },
      hookOverrides: { roomStatus: GameStatus.Ended },
    });

    const model = await captureModel(renderRoom());

    expect(model.bottomActions.kind).toBe('info');
  });

  it('uses the sheriff-election dock model on the first day while the election runs', async () => {
    mockUseWerewolfRoomReturn = createWerewolfRoomMock({
      schemaId: 'seerCheck',
      currentActionRole: 'seer',
      myRole: 'villager',
      mySeat: 3,
      numberOfPlayers: 4,
      gameStateOverrides: {
        status: GameStatus.Day,
        rules: { isSheriffElectionEnabled: true },
        sheriffElection: {
          phase: 'registration',
          registeredSeats: [],
          withdrawnSeats: [],
          completedRounds: [],
        },
        nightReviewAllowedSeats: [],
      },
      hookOverrides: { roomStatus: GameStatus.Day },
    });

    const model = await captureModel(renderRoom());

    expect(model.bottomActions.kind).toBe('dock');
  });

  it('shows the plague-mode judge message to the host in the ready state', async () => {
    mockUseWerewolfRoomReturn = createWerewolfRoomMock({
      schemaId: 'seerCheck',
      currentActionRole: 'seer',
      myRole: 'villager',
      mySeat: 0,
      numberOfPlayers: 4,
      isHost: true,
      gameStateOverrides: {
        status: GameStatus.Ready,
        rules: { isPlagueMode: true },
      },
      hookOverrides: { roomStatus: GameStatus.Ready },
    });

    const model = await captureModel(renderRoom());

    expect(model.bottomActions.kind).toBe('stacked');
    if (model.bottomActions.kind === 'stacked') {
      expect(model.bottomActions.message).toBe(
        '黑死病模式 — 已发牌，请由房主担任真人法官主持后续流程',
      );
    }
  });
});
