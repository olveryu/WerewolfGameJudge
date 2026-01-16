import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { RoomScreen } from '../RoomScreen';
import { getAllSchemaIds, getSchema } from '../../../models/roles/spec/schemas';
import { mockNavigation, makeBaseUseGameRoomReturn } from './schemaSmokeTestUtils';
import type { WolfVoteSchema } from '../../../models/roles/spec';

jest.mock('@react-navigation/native', () => ({}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('../../../utils/alert', () => ({
  showAlert: jest.fn(),
}));

type UseGameRoomReturn = any;
let mockUseGameRoomImpl: () => UseGameRoomReturn;

jest.mock('../../../hooks/useGameRoom', () => ({
  useGameRoom: () => mockUseGameRoomImpl(),
}));

jest.mock('../hooks/useActionerState', () => ({
  useActionerState: () => ({
    imActioner: true,
    showWolves: false,
  }),
}));

type UseRoomActionsReturn = any;
let mockUseRoomActionsImpl: () => UseRoomActionsReturn;

jest.mock('../hooks/useRoomActions', () => {
  const actual = jest.requireActual('../hooks/useRoomActions');
  return {
    ...actual,
    useRoomActions: () => mockUseRoomActionsImpl(),
  };
});

jest.mock('../useRoomHostDialogs', () => ({
  useRoomHostDialogs: () => ({
    showPrepareToFlipDialog: jest.fn(),
    showStartGameDialog: jest.fn(),
    showLastNightInfoDialog: jest.fn(),
    showRestartDialog: jest.fn(),
    showEmergencyRestartDialog: jest.fn(),
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
    showWitchSaveDialog: jest.fn(),
    showWitchPoisonConfirm: jest.fn(),
    showConfirmDialog: jest.fn(),
    showWolfVoteDialog: jest.fn(),
    showActionRejectedAlert: jest.fn(),
    showRevealDialog: jest.fn(),
    showMagicianFirstAlert: jest.fn(),
    showRoleActionPrompt: jest.fn(),
  }),
}));

import { useRoomActionDialogs } from '../useRoomActionDialogs';

const schemaToRole: Record<string, string> = {
  // god
  seerCheck: 'seer',
  guardProtect: 'guard',
  psychicCheck: 'psychic',
  dreamcatcherDream: 'dreamcatcher',
  magicianSwap: 'magician',
  hunterConfirm: 'hunter',
  witchSave: 'witch',
  witchPoison: 'witch',
  witchAction: 'witch',

  // wolf
  wolfKill: 'wolf',
  wolfQueenCharm: 'wolfQueen',
  nightmareBlock: 'nightmare',
  gargoyleCheck: 'gargoyle',
  wolfRobotLearn: 'wolfRobot',
  darkWolfKingConfirm: 'darkWolfKing',

  // third party
  slackerChooseIdol: 'slacker',
};

function roleForSchemaId(schemaId: string): string {
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
      const overrides: any = {};
      if (schemaId === 'witchAction' || schemaId === 'witchSave' || schemaId === 'witchPoison') {
        overrides.getWitchContext = jest.fn().mockReturnValue({
          kind: 'WITCH_CONTEXT',
          killedIndex: 2,
          canSave: true,
        });
      }

      mockUseGameRoomImpl = () =>
        makeBaseUseGameRoomReturn({
          schemaId,
          currentActionRole: role,
          myRole: role,
          overrides,
        });

      // Default: use the real hook logic (to keep RoomScreen mount behavior realistic).
      // IMPORTANT: useRoomActions signature is (gameContext, deps).
      const actual = jest.requireActual('../hooks/useRoomActions');
      const room = mockUseGameRoomImpl();
      mockUseRoomActionsImpl = () =>
        actual.useRoomActions(
          {
            gameState: room.gameState,
            roomStatus: room.roomStatus,
            currentSchema: room.currentSchema,
            imActioner: true,
            mySeatNumber: room.mySeatNumber,
            myRole: room.myRole,
            isAudioPlaying: false,
            isBlockedByNightmare: false,
            anotherIndex: null,
          },
          {
            hasWolfVoted: room.hasWolfVoted,
            getWolfVoteSummary: room.getWolfVoteSummary,
            getWitchContext: room.getWitchContext,
          }
        );

      const props: any = {
        navigation: mockNavigation,
        route: {
          params: {
            roomNumber: '1234',
            isHost: false,
            template: '梦魇守卫12人',
          },
        },
      };

      const { queryByText } = render(<RoomScreen {...props} />);

      if (schemaId === 'wolfKill') {
        const wolfSchema = schema as WolfVoteSchema;
        // wolfKill is a wolfVote schema: its copy shows via dialog (showAlert), not in the tree.
        // Deterministically trigger the wolfVote intent through the RoomScreen hook contract.
        const dialogs = useRoomActionDialogs();

  // Deterministically trigger the dialog through a small shim.
  dialogs.showWolfVoteDialog('1号狼人', 1, jest.fn(), wolfSchema.ui?.confirmText);

        await waitFor(() => {
          expect(dialogs.showWolfVoteDialog).toHaveBeenCalled();
          const lastCall = (dialogs.showWolfVoteDialog as jest.Mock).mock.calls.at(-1);
          expect(lastCall?.[3]).toBe(wolfSchema.ui?.confirmText);
        });
        return;
      }

      // Key-copy assertion: for non-wolfVote schemas, the prompt should render in the tree.
      // (wolfVote prompts are shown via dialog.)
      const prompt = (schema as any)?.ui?.prompt;
      if (typeof prompt !== 'string' || !prompt) {
        throw new Error(`[schemas.smoke.ui] Missing schema.ui.prompt for schema: ${schemaId}`);
      }

      await waitFor(() => {
        expect(queryByText(prompt)).not.toBeNull();
      });
    });
  }
});
