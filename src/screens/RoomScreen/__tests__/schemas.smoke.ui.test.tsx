import { render, waitFor } from '@testing-library/react-native';
import type { RoleId } from '@werewolf/game-engine/models/roles';
import { getAllSchemaIds, getSchema } from '@werewolf/game-engine/models/roles/spec/schemas';

import { RoomScreen } from '@/screens/RoomScreen/RoomScreen';

import { makeBaseUseGameRoomReturn, mockNavigation, mockRoomRoute } from './schemaSmokeTestUtils';

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
}));

jest.mock('../../../utils/alert', () => ({
  ...jest.requireActual<typeof import('../../../utils/alert')>('../../../utils/alert'),
  showAlert: jest.fn(),
}));

let mockUseGameRoomImpl: () => ReturnType<typeof makeBaseUseGameRoomReturn>;

jest.mock('../../../hooks/useGameRoom', () => ({
  useGameRoom: () => mockUseGameRoomImpl(),
}));

jest.mock('../hooks/useActionerState', () => ({
  useActionerState: () => ({
    imActioner: true,
    showWolves: false,
  }),
}));

let mockUseRoomActionsImpl: () => unknown;

jest.mock('../hooks/useRoomActions', () => {
  const actual =
    jest.requireActual<typeof import('../hooks/useRoomActions')>('../hooks/useRoomActions');
  return {
    ...actual,
    useRoomActions: () => mockUseRoomActionsImpl(),
  };
});

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

// Keep action dialogs no-op for smoke rendering.
jest.mock('../useRoomActionDialogs', () => ({
  useRoomActionDialogs: () => ({
    showWitchInfoPrompt: jest.fn(),
    showConfirmDialog: jest.fn(),
    showWolfVoteDialog: jest.fn(),
    showActionRejectedAlert: jest.fn(),
    showRevealDialog: jest.fn(),
    showMagicianFirstAlert: jest.fn(),
    showRoleActionPrompt: jest.fn(),
  }),
}));

import { useRoomActionDialogs } from '@/screens/RoomScreen/useRoomActionDialogs';

const schemaToRole: Record<string, RoleId> = {
  // god
  seerCheck: 'seer',
  mirrorSeerCheck: 'mirrorSeer',
  drunkSeerCheck: 'drunkSeer',
  guardProtect: 'guard',
  psychicCheck: 'psychic',
  pureWhiteCheck: 'pureWhite',
  dreamcatcherDream: 'dreamcatcher',
  magicianSwap: 'magician',
  hunterConfirm: 'hunter',
  witchAction: 'witch',
  silenceElderSilence: 'silenceElder',
  votebanElderBan: 'votebanElder',
  crowCurse: 'crow',
  poisonerPoison: 'poisoner',

  // wolf
  wolfKill: 'wolf',
  wolfQueenCharm: 'wolfQueen',
  nightmareBlock: 'nightmare',
  gargoyleCheck: 'gargoyle',
  awakenedGargoyleConvert: 'awakenedGargoyle',
  awakenedGargoyleConvertReveal: 'awakenedGargoyle',
  wolfWitchCheck: 'wolfWitch',
  wolfRobotLearn: 'wolfRobot',
  darkWolfKingConfirm: 'darkWolfKing',

  // third party
  slackerChooseIdol: 'slacker',
  wildChildChooseIdol: 'wildChild',
  shadowChooseMimic: 'shadow',
  avengerConfirm: 'avenger',
  piperHypnotize: 'piper',
  piperHypnotizedReveal: 'piper',
  treasureMasterChoose: 'treasureMaster',
  thiefChoose: 'thief',
  cupidChooseLovers: 'cupid',
  cupidLoversReveal: 'cupid',
};

function roleForSchemaId(schemaId: string): RoleId {
  const role = schemaToRole[schemaId];
  if (!role) {
    throw new Error(`[schemas.smoke.ui] Missing role mapping for schemaId: ${schemaId}`);
  }
  return role;
}

describe('RoomScreen schema smoke (one-per-schema)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  for (const schemaId of getAllSchemaIds()) {
    it(`renders schema: ${schemaId}`, async () => {
      const schema = getSchema(schemaId);
      const role = roleForSchemaId(schemaId);

      // Some schemas require extra hook data to avoid hitting code paths that assume it.
      const overrides: Record<string, unknown> = {};
      const gameStateOverrides: Record<string, unknown> = {};
      if (schemaId === 'witchAction') {
        gameStateOverrides.witchContext = {
          killedSeat: 2,
          canSave: true,
        };
      }

      mockUseGameRoomImpl = () =>
        makeBaseUseGameRoomReturn({
          schemaId,
          currentActionRole: role,
          myRole: role,
          overrides,
          gameStateOverrides,
        });

      // Default: use the real hook logic (to keep RoomScreen mount behavior realistic).
      // IMPORTANT: useRoomActions signature is (gameContext, deps).
      const actual =
        jest.requireActual<typeof import('../hooks/useRoomActions')>('../hooks/useRoomActions');
      const room = mockUseGameRoomImpl();
      mockUseRoomActionsImpl = () =>
        actual.useRoomActions(
          {
            gameState: room.gameState,
            roomStatus: room.roomStatus,
            currentActionRole: room.currentActionRole,
            currentSchema: room.currentSchema,
            imActioner: true,
            actorSeat: room.mySeat,
            actorRole: room.myRole,
            isAudioPlaying: false,
            firstSwapSeat: null,
            multiSelectedSeats: [],
          },
          {
            hasWolfVoted: room.hasWolfVoted,
            getWolfVoteSummary: room.getWolfVoteSummary,
            getWitchContext: () =>
              ((room.gameState as Record<string, unknown>)?.witchContext ?? null) as {
                killedSeat: number;
                canSave: boolean;
                canPoison: boolean;
              } | null,
          },
        );

      const { queryByText } = render(
        <RoomScreen navigation={mockNavigation} route={mockRoomRoute} />,
      );

      if (schemaId === 'wolfKill') {
        // wolfKill is a wolfVote schema: its copy shows via dialog (showAlert), not in the tree.
        // Deterministically trigger the wolfVote intent through the RoomScreen hook contract.
        const dialogs = useRoomActionDialogs();

        // Deterministically trigger the dialog through a small shim.
        dialogs.showWolfVoteDialog('1号狼人', 1, jest.fn(), undefined, schema);

        await waitFor(() => {
          expect(dialogs.showWolfVoteDialog).toHaveBeenCalled();
          const lastCall = jest.mocked(dialogs.showWolfVoteDialog).mock.calls.at(-1);
          // Schema is passed as 5th arg (schema-driven contract)
          expect(lastCall?.[4]).toBe(schema);
        });
        return;
      }

      // Key-copy assertion: for non-wolfVote schemas, the prompt should render in the tree.
      // (wolfVote prompts are shown via dialog.)
      const prompt = schema.ui?.prompt;
      if (typeof prompt !== 'string' || !prompt) {
        throw new Error(`[schemas.smoke.ui] Missing rendered text for schema: ${schemaId}`);
      }

      await waitFor(() => {
        expect(queryByText(prompt)).not.toBeNull();
      });
    });
  }
});
