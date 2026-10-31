/**
 * Contract test: ConfigScreen → GameRulesScreen handoff
 *
 * ConfigScreen validates the board, then hands validated roles + current rules to the Rules
 * step, which owns room creation. New rooms start from the remembered rule preferences;
 * edit mode starts from the room's own rules. Nominate mode submits directly.
 */

import type {
  GameRuleOverrides,
  GameState,
  RoleId,
  WerewolfPublicCommand,
} from '@game-judge/game-engine/games/werewolf/public';
import { PRESET_TEMPLATES } from '@game-judge/game-engine/games/werewolf/public';
import { createRoomSnapshot } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { useServices } from '@/contexts/ServiceContext';
import { SettingsService } from '@/features/settings/services/SettingsService';
import { ConfigScreen } from '@/games/werewolf/screens/ConfigScreen/ConfigScreen';
import {
  createFakeRoomLink,
  type FakeRoomLink,
  idleLinkSnapshot,
  readyLinkSnapshot,
} from '@/test-utils/linkSnapshot';
import { successfulRoomCommand } from '@/test-utils/roomCommand';
import { buildWerewolfTestState } from '@/test-utils/werewolfState';
import { TESTIDS } from '@/testids';

const mockUseServices = useServices as jest.Mock;

const mockNavigate = jest.fn<void, [string, unknown]>();
let mockSettingsService: SettingsService;
let mockRouteParams: {
  presetName?: string;
  existingRoomCode?: string;
  nominateMode?: { roomCode: string };
  updatedRules?: GameRuleOverrides;
} = {
  presetName: '预女猎白',
};
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: jest.fn(),
    addListener: jest.fn(() => jest.fn()),
  }),
  useRoute: () => ({
    params: mockRouteParams,
  }),
}));

jest.mock('@/services/infra/localStorage', () => ({
  storage: {
    getString: jest.fn(() => undefined),
    set: jest.fn(),
    remove: jest.fn(),
  },
}));

const createMockSession = (): FakeRoomLink<GameState, WerewolfPublicCommand> =>
  createFakeRoomLink<GameState, WerewolfPublicCommand>(idleLinkSnapshot<GameState>(), () =>
    Promise.resolve(successfulRoomCommand(buildWerewolfTestState())),
  );

const flowCallbacks = { onExitFlow: jest.fn(), onReturnToRoom: jest.fn() };
const BOARD: readonly RoleId[] = ['villager', 'villager', 'wolf', 'wolf', 'seer', 'witch'];

/** selectionToRoles re-derives order from the chip layout, so compare as a multiset. */
function sameRoles(roles: readonly RoleId[]): unknown {
  return expect.arrayContaining(roles);
}

function renderConfigScreen(session = createMockSession()) {
  return render(<ConfigScreen session={session} {...flowCallbacks} />);
}

function publishRoom(
  session: FakeRoomLink<GameState, WerewolfPublicCommand>,
  state: GameState,
  revision: number,
) {
  session.publish(
    readyLinkSnapshot<GameState>(
      {
        room: {
          roomCode: state.roomCode,
          roomId: 'room-id-1234',
          gameType: 'werewolf' as const,
          hostUserId: state.hostUserId,
          createdAt: new Date(),
        },
        userId: state.hostUserId,
      },
      createRoomSnapshot(state, revision),
    ),
  );
}

function mockReadyRoom(
  session: FakeRoomLink<GameState, WerewolfPublicCommand>,
  rules: GameRuleOverrides,
) {
  const state = buildWerewolfTestState({ rules, templateRoles: [...BOARD] });
  publishRoom(session, state, 1);
  return state;
}

describe('ConfigScreen → Rules handoff contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouteParams = { presetName: '预女猎白' };
    mockSettingsService = new SettingsService();
    mockUseServices.mockReturnValue({ settingsService: mockSettingsService });
  });

  it('hands the validated preset roles and remembered rules to the Rules step for a new room', async () => {
    await mockSettingsService.setRememberedGameConfigField('werewolf', 'witchCanSelfHeal', true);
    const preset = PRESET_TEMPLATES.find((template) => template.name === '预女猎白');
    if (preset === undefined) throw new Error('Missing preset 预女猎白');
    const rendered = renderConfigScreen();

    fireEvent.press(rendered.getByTestId(TESTIDS.configNextButton));

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('Rules', {
      roles: sameRoles(preset.roles),
      rules: { isSheriffElectionEnabled: true, witchCanSelfHeal: true },
    });
  });

  it('carries rules edited on the Rules step back through updatedRules', () => {
    mockRouteParams = {
      presetName: '预女猎白',
      updatedRules: { isSheriffElectionEnabled: false, isPlagueMode: true },
    };
    const rendered = renderConfigScreen();

    fireEvent.press(rendered.getByTestId(TESTIDS.configNextButton));

    expect(mockNavigate).toHaveBeenCalledWith(
      'Rules',
      expect.objectContaining({ rules: { isSheriffElectionEnabled: false, isPlagueMode: true } }),
    );
  });

  it.each([true, false])(
    'uses the existing room sheriff setting %s instead of the remembered preference in edit mode',
    async (isSheriffElectionEnabled) => {
      await mockSettingsService.setRememberedGameConfigField(
        'werewolf',
        'isSheriffElectionEnabled',
        !isSheriffElectionEnabled,
      );
      const mockClient = createMockSession();
      const state = mockReadyRoom(mockClient, { isSheriffElectionEnabled });
      mockRouteParams = { existingRoomCode: state.roomCode };
      const rendered = renderConfigScreen(mockClient);

      await waitFor(() => expect(rendered.getByText('下一步：规则')).toBeTruthy());
      fireEvent.press(rendered.getByTestId(TESTIDS.configNextButton));

      expect(mockNavigate).toHaveBeenCalledWith('Rules', {
        roles: sameRoles(BOARD),
        rules: { isSheriffElectionEnabled },
        existingRoomCode: state.roomCode,
      });
      const handoff = mockNavigate.mock.calls[0]?.[1];
      expect(handoff).toHaveProperty('roles.length', BOARD.length);
    },
  );

  it('keeps the edited board when the room publishes a new revision', async () => {
    const mockClient = createMockSession();
    const state = mockReadyRoom(mockClient, {});
    mockRouteParams = { existingRoomCode: state.roomCode };
    const rendered = renderConfigScreen(mockClient);

    fireEvent.press(rendered.getByTestId(TESTIDS.configRoleChip('hunter')));
    // Another player takes a seat: the authoritative snapshot moves on.
    act(() => publishRoom(mockClient, { ...state }, 2));
    fireEvent.press(rendered.getByTestId(TESTIDS.configNextButton));

    expect(mockNavigate).toHaveBeenCalledWith(
      'Rules',
      expect.objectContaining({ roles: sameRoles([...BOARD, 'hunter']) }),
    );
    const handoff = mockNavigate.mock.calls[0]?.[1];
    expect(handoff).toHaveProperty('roles.length', BOARD.length + 1);
  });

  it('submits a board nomination directly without visiting the Rules step', async () => {
    const mockClient = createMockSession();
    const state = mockReadyRoom(mockClient, {});
    mockRouteParams = { nominateMode: { roomCode: state.roomCode } };
    const rendered = renderConfigScreen(mockClient);

    await waitFor(() => expect(rendered.getByText('提交建议')).toBeTruthy());
    fireEvent.press(rendered.getByTestId(TESTIDS.configNextButton));

    await waitFor(() => expect(flowCallbacks.onReturnToRoom).toHaveBeenCalledWith(state.roomCode));
    expect(mockClient.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'werewolf.board.nominate', roles: sameRoles(BOARD) }),
      expect.anything(),
    );
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
