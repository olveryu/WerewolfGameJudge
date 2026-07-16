import type { ChooseSeatSchema } from '@game-judge/game-engine/games/werewolf/public';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import type React from 'react';

import { WerewolfRoomScreen } from '@/games/werewolf/room/__tests__/harness/ReadyWerewolfRoomScreen';
import { showAlert } from '@/utils/alert';

jest.mock('@/utils/alert', () => ({
  ...jest.requireActual<typeof import('@/utils/alert')>('@/utils/alert'),
  showAlert: jest.fn(),
}));

// Mock navigation
const mockNavigation = {
  navigate: jest.fn(),
  replace: jest.fn(),
  goBack: jest.fn(),
  setOptions: jest.fn(),
};

const mockRoom: React.ComponentProps<typeof WerewolfRoomScreen>['room'] = {
  roomCode: '1234',
  roomId: 'room-id-1234',
  gameType: 'werewolf',
  hostUserId: 'host-uid',
  createdAt: new Date(0),
};

const mockSubmitAction = jest.fn();

let mockedCanSkip = true;
let mockedSchemaId: ChooseSeatSchema['id'] = 'seerCheck';

const getChooseSeatSchema = (schemaId: ChooseSeatSchema['id']): ChooseSeatSchema => {
  // Use the real schema as source-of-truth, then override the one test-specific knob.
  const { getSchema } =
    require('@game-judge/game-engine/games/werewolf/public') as typeof import('@game-judge/game-engine/games/werewolf/public');
  const schema = getSchema(schemaId);
  if (schema.kind !== 'chooseSeat') {
    throw new Error(`Expected chooseSeat schema for ${schemaId}`);
  }
  return {
    ...schema,
    canSkip: mockedCanSkip,
  };
};

// Minimal WerewolfRoomScreen runtime: pressing "不用技能" submits a null target input.
jest.mock('@/games/werewolf/hooks/useWerewolfRoom', () => {
  const { GameStatus } =
    require('@game-judge/game-engine/games/werewolf/public') as typeof import('@game-judge/game-engine/games/werewolf/public');
  return {
    useWerewolfRoom: () => {
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
              seat: i,
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
        gameState,

        connectionStatus: 'live',

        isHost: false,
        roomStatus: (
          require('@game-judge/game-engine/games/werewolf/public') as typeof import('@game-judge/game-engine/games/werewolf/public')
        ).GameStatus.Ongoing,

        currentActionRole: 'seer',
        currentSchema: getChooseSeatSchema(mockedSchemaId),

        isAudioPlaying: false,

        mySeat: 0,
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
        takeOverBot: jest.fn(),
        releaseBot: jest.fn(),

        takeSeat: jest.fn(),
        leaveSeat: jest.fn(),
        assignRoles: jest.fn(),
        startGame: jest.fn(),
        restartGame: jest.fn(),

        submitAction: mockSubmitAction,

        hasWolfVoted: () => false,
        viewedRole: jest.fn(),

        getLastNightInfo: jest.fn().mockReturnValue(''),

        submitRevealAck: jest.fn().mockResolvedValue({ success: true }),

        isBgmPlaying: false,
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

describe('WerewolfRoomScreen skip action UI', () => {
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

    const nav = mockNavigation as unknown as React.ComponentProps<
      typeof WerewolfRoomScreen
    >['navigation'];

    const { queryByText } = render(
      <WerewolfRoomScreen navigation={nav} room={mockRoom} entryReason={null} />,
    );

    // chooseSeat + canSkip=false => no bottom skip button
    await waitFor(() => {
      expect(queryByText(skipText)).toBeNull();
    });
  });

  it('press "不用技能" -> confirm -> submits the canonical skip input', async () => {
    mockedCanSkip = true;
    mockedSchemaId = 'seerCheck';
    const skipText = getChooseSeatSchema(mockedSchemaId).ui?.bottomActionText;
    if (!skipText) {
      throw new Error(`[TEST] Missing ${mockedSchemaId}.ui.bottomActionText`);
    }
    const nav = mockNavigation as unknown as React.ComponentProps<
      typeof WerewolfRoomScreen
    >['navigation'];

    const { findByText } = render(
      <WerewolfRoomScreen navigation={nav} room={mockRoom} entryReason={null} />,
    );

    const skipButton = await findByText(skipText);
    fireEvent.press(skipButton);

    await waitFor(() => {
      expect(showAlert).toHaveBeenCalled();
    });

    // Confirm the *skip confirm* alert (auto-intent prompts may also call showAlert)
    const skipCall = jest.mocked(showAlert).mock.calls.find((c) => c[0] === '跳过本次行动？');
    expect(skipCall).toBeDefined();

    const buttons = skipCall![2] as Array<{ text: string; onPress?: () => void }>;
    const confirmBtn = buttons.find((b) => b.text === '确定');
    expect(confirmBtn).toBeDefined();

    await act(async () => {
      confirmBtn?.onPress?.();
    });

    expect(mockSubmitAction).toHaveBeenCalledWith({ kind: 'skip' });
  });
});
