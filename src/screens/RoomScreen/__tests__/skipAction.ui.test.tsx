import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ChooseSeatSchema } from '@werewolf/game-engine/models/roles/spec/schema.types';

import { RoomScreen } from '@/screens/RoomScreen/RoomScreen';
import { showAlert } from '@/utils/alert';

jest.mock('../../../utils/alert', () => ({
  ...jest.requireActual('../../../utils/alert'),
  showAlert: jest.fn(),
}));

// Mock navigation
const mockNavigation = {
  navigate: jest.fn(),
  replace: jest.fn(),
  goBack: jest.fn(),
  setOptions: jest.fn(),
};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
}));

const mockSubmitAction = jest.fn();

let mockedCanSkip = true;
let mockedSchemaId: ChooseSeatSchema['id'] = 'seerCheck';

const getChooseSeatSchema = (schemaId: ChooseSeatSchema['id']): ChooseSeatSchema => {
  // Use the real schema as source-of-truth, then override the one test-specific knob.
  const { getSchema } = require('@werewolf/game-engine/models/roles/spec/schemas');
  const schema = getSchema(schemaId);
  if (schema.kind !== 'chooseSeat') {
    throw new Error(`Expected chooseSeat schema for ${schemaId}`);
  }
  return {
    ...schema,
    canSkip: mockedCanSkip,
  };
};

// Minimal RoomScreen runtime: we only care that pressing "不用技能" triggers submitAction(null)
jest.mock('../../../hooks/useGameRoom', () => {
  const { GameStatus } = require('@werewolf/game-engine');
  return {
    useGameRoom: () => {
      const gameState = {
        status: GameStatus.Ongoing,
        template: {
          numberOfPlayers: 12,
          roles: Array.from({ length: 12 }).map(() => 'villager'),
          actionOrder: ['seer'],
        },
        players: new Map(
          Array.from({ length: 12 }).map((_, i) => [
            i,
            {
              userId: `p${i}`,
              seatNumber: i,
              displayName: `P${i + 1}`,
              avatarUrl: undefined,
              role: i === 0 ? 'seer' : 'villager',
              hasViewedRole: true,
            },
          ]),
        ),
        actions: new Map(),
        wolfVotes: new Map(),
        currentStepIndex: 0,
        isAudioPlaying: false,
        lastNightDeaths: [],
        nightmareBlockedSeat: null,
        currentNightResults: {},
        templateRoles: [],
        hostUserId: 'host',
        roomCode: '1234',
      };
      return {
        facade: { getState: () => gameState },
        gameState,

        connectionStatus: require('@/services/types/IGameFacade').ConnectionStatus.Live,

        isHost: false,
        roomStatus: require('@werewolf/game-engine/models/GameStatus').GameStatus.Ongoing,

        currentActionRole: 'seer',
        currentSchema: getChooseSeatSchema(mockedSchemaId),

        isAudioPlaying: false,

        mySeatNumber: 0,
        myRole: 'seer',
        myUserId: 'p0',

        // Debug mode fields
        isDebugMode: false,
        controlledSeat: null,
        effectiveSeat: 0,
        effectiveRole: 'seer',
        fillWithBots: jest.fn(),
        markAllBotsViewed: jest.fn(),
        markAllBotsGroupConfirmed: jest.fn(),
        setControlledSeat: jest.fn(),

        joinRoom: jest.fn().mockResolvedValue(true),
        takeSeat: jest.fn(),
        leaveSeat: jest.fn(),
        assignRoles: jest.fn(),
        startGame: jest.fn(),
        restartGame: jest.fn(),

        submitAction: mockSubmitAction,

        hasWolfVoted: () => false,
        requestSnapshot: jest.fn(),
        viewedRole: jest.fn(),

        lastSeatError: null,
        clearLastSeatError: jest.fn(),

        getLastNightInfo: jest.fn().mockReturnValue(''),

        submitRevealAck: jest.fn(),

        isBgmEnabled: true,
        isBgmPlaying: false,
        toggleBgm: jest.fn(),
        playBgm: jest.fn(),
        stopBgm: jest.fn(),
      };
    },
  };
});

jest.mock('../hooks/useActionerState', () => ({
  useActionerState: () => ({
    imActioner: true,
    showWolves: false,
  }),
}));

// Keep other dialog hooks simple
jest.mock('../useRoomHostDialogs', () => ({
  useRoomHostDialogs: () => ({
    showPrepareToFlipDialog: jest.fn(),
    showStartGameDialog: jest.fn(),
    showRestartDialog: jest.fn(),
    handleSettingsPress: jest.fn(),
  }),
}));

jest.mock('../useRoomSeatDialogs', () => ({
  useRoomSeatDialogs: () => ({
    showEnterSeatDialog: jest.fn(),
    showLeaveSeatDialog: jest.fn(),
    handleConfirmSeat: jest.fn(),
    handleCancelSeat: jest.fn(),
    handleConfirmLeave: jest.fn(),
    handleLeaveRoom: jest.fn(),
  }),
}));

describe('RoomScreen skip action UI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedCanSkip = true;
    mockedSchemaId = 'seerCheck';
  });

  it('schema.canSkip=false (chooseSeat) -> does not render bottom skip button', async () => {
    mockedCanSkip = false;
    mockedSchemaId = 'psychicCheck';
    const skipText = getChooseSeatSchema(mockedSchemaId).ui?.bottomActionText;
    if (!skipText) {
      throw new Error(`[TEST] Missing ${mockedSchemaId}.ui.bottomActionText`);
    }

    const props: any = {
      navigation: mockNavigation,
      route: {
        params: {
          roomCode: '1234',
          isHost: false,
          template: '噩梦之影守卫',
        },
      },
    };

    const { queryByText } = render(<RoomScreen {...props} />);

    // chooseSeat + canSkip=false => no bottom skip button
    await waitFor(() => {
      expect(queryByText(skipText)).toBeNull();
    });
  });

  it('press "不用技能" -> confirm -> submitAction(null)', async () => {
    mockedCanSkip = true;
    mockedSchemaId = 'seerCheck';
    const skipText = getChooseSeatSchema(mockedSchemaId).ui?.bottomActionText;
    if (!skipText) {
      throw new Error(`[TEST] Missing ${mockedSchemaId}.ui.bottomActionText`);
    }
    const props: any = {
      navigation: mockNavigation,
      route: {
        params: {
          roomCode: '1234',
          isHost: false,
          template: '噩梦之影守卫',
        },
      },
    };

    const { findByText } = render(<RoomScreen {...props} />);

    const skipButton = await findByText(skipText);
    fireEvent.press(skipButton);

    await waitFor(() => {
      expect(showAlert).toHaveBeenCalled();
    });

    // Confirm the *skip confirm* alert (auto-intent prompts may also call showAlert)
    const skipCall = (showAlert as jest.Mock).mock.calls.find((c) => c[0] === '跳过本次行动？');
    expect(skipCall).toBeDefined();

    const buttons = skipCall[2] as Array<{ text: string; onPress?: () => void }>;
    const confirmBtn = buttons.find((b) => b.text === '确定');
    expect(confirmBtn).toBeDefined();

    await act(async () => {
      confirmBtn?.onPress?.();
    });

    expect(mockSubmitAction).toHaveBeenCalledWith(null);
  });
});
