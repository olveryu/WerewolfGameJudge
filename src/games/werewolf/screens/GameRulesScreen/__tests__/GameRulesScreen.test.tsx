/**
 * GameRulesScreen contract: remembered rules persist on toggle (plague never does),
 * back carries edited rules to Config, and the final button creates/saves with roles + rules.
 */

import type {
  GameState,
  WerewolfPublicCommand,
} from '@game-judge/game-engine/games/werewolf/public';
import {
  type GameRuleOverrides,
  type RoleId,
  WEREWOLF_RULES_SCHEMA,
} from '@game-judge/game-engine/games/werewolf/public';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { useServices } from '@/contexts/ServiceContext';
import type { RoomCreationRequest, RoomRecord } from '@/features/room/model/RoomDirectory';
import { SettingsService } from '@/features/settings/services/SettingsService';
import type { WerewolfRoomSession } from '@/games/werewolf/model/WerewolfRoomSession';
import { GameRulesScreen } from '@/games/werewolf/screens/GameRulesScreen/GameRulesScreen';
import { storage } from '@/services/infra/localStorage';
import { createFakeRoomLink, idleLinkSnapshot } from '@/test-utils/linkSnapshot';
import { successfulRoomCommand } from '@/test-utils/roomCommand';
import { buildWerewolfTestState } from '@/test-utils/werewolfState';
import { TESTIDS } from '@/testids';
import { showAlert } from '@/utils/alert';

const mockUseServices = useServices as jest.Mock;
const mockCreateRoom = jest.fn<Promise<RoomRecord>, [RoomCreationRequest]>();
jest.mock('@/features/room/controllers/useRoomCreationController', () => ({
  useRoomCreationController: () => ({ createRoom: mockCreateRoom, isCreating: false }),
}));

const mockPopTo = jest.fn();
let mockRouteParams: {
  roles: readonly RoleId[];
  rules: GameRuleOverrides;
  existingRoomCode?: string;
};
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ popTo: mockPopTo }),
  useRoute: () => ({ params: mockRouteParams }),
}));

jest.mock('@/services/infra/localStorage', () => ({
  storage: { getString: jest.fn(() => undefined), set: jest.fn(), remove: jest.fn() },
}));

jest.mock('@/utils/alert', () => ({
  ...jest.requireActual<typeof import('@/utils/alert')>('@/utils/alert'),
  showAlert: jest.fn(),
}));

const ROLES: readonly RoleId[] = ['wolf', 'seer', 'villager'];
const flowCallbacks = { onExitFlow: jest.fn(), onRoomCreated: jest.fn() };
let settingsService: SettingsService;

const createMockSession = (): WerewolfRoomSession =>
  createFakeRoomLink<GameState, WerewolfPublicCommand>(idleLinkSnapshot<GameState>(), () =>
    Promise.resolve(successfulRoomCommand(buildWerewolfTestState())),
  );

function renderRules(session = createMockSession()) {
  return render(<GameRulesScreen session={session} {...flowCallbacks} />);
}

describe('GameRulesScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    settingsService = new SettingsService();
    mockUseServices.mockReturnValue({ settingsService });
    mockRouteParams = { roles: ROLES, rules: { isSheriffElectionEnabled: true } };
    mockCreateRoom.mockResolvedValue({
      roomCode: '7777',
      roomId: 'room-id-7777',
      gameType: 'werewolf',
      hostUserId: 'test-uid',
      createdAt: new Date(),
    });
  });

  it('remembers sheriff and witch toggles immediately but never plague mode', async () => {
    const screen = renderRules();

    fireEvent(
      screen.getByTestId(TESTIDS.gameRuleSwitch('isSheriffElectionEnabled')),
      'valueChange',
      false,
    );
    fireEvent(screen.getByTestId(TESTIDS.gameRuleSwitch('witchCanSelfHeal')), 'valueChange', true);
    await waitFor(() =>
      expect(settingsService.getRememberedGameConfig('werewolf', WEREWOLF_RULES_SCHEMA)).toEqual({
        isSheriffElectionEnabled: false,
        witchCanSelfHeal: true,
      }),
    );

    fireEvent(screen.getByTestId(TESTIDS.gameRuleSwitch('isPlagueMode')), 'valueChange', true);
    const confirmButtons = jest.mocked(showAlert).mock.calls.at(-1)?.[2];
    const confirmButton = confirmButtons?.find((button) => button.text === '确认开启');
    if (confirmButton?.onPress === undefined) throw new Error('Missing plague confirm button');
    void confirmButton.onPress();
    await waitFor(() =>
      expect(screen.getByTestId(TESTIDS.gameRuleSwitch('isPlagueMode')).props.value).toBe(true),
    );
    expect(storage.set).toHaveBeenCalledTimes(2);
    expect(settingsService.getRememberedGameConfig('werewolf', WEREWOLF_RULES_SCHEMA)).toEqual({
      isSheriffElectionEnabled: false,
      witchCanSelfHeal: true,
    });
  });

  it('reverts the toggle and alerts when the preference cannot be stored', async () => {
    const error = new Error('Storage disabled');
    error.name = 'SecurityError';
    jest.mocked(storage.set).mockImplementationOnce(() => {
      throw error;
    });
    const screen = renderRules();

    fireEvent(
      screen.getByTestId(TESTIDS.gameRuleSwitch('isSheriffElectionEnabled')),
      'valueChange',
      false,
    );

    await waitFor(() =>
      expect(showAlert).toHaveBeenCalledWith('保存规则偏好失败', expect.any(String)),
    );
    expect(screen.getByTestId(TESTIDS.gameRuleSwitch('isSheriffElectionEnabled')).props.value).toBe(
      true,
    );
    expect(
      settingsService.getRememberedGameConfig('werewolf', WEREWOLF_RULES_SCHEMA)
        .isSheriffElectionEnabled,
    ).toBe(true);
  });

  it('returns edited rules to Config on back without dropping its params', () => {
    const screen = renderRules();
    fireEvent(screen.getByTestId(TESTIDS.gameRuleSwitch('witchCanSelfHeal')), 'valueChange', true);

    fireEvent.press(screen.getByLabelText('返回'));

    expect(mockPopTo).toHaveBeenCalledWith(
      'Config',
      { updatedRules: { isSheriffElectionEnabled: true, witchCanSelfHeal: true } },
      { merge: true },
    );
  });

  it('creates the room with the configured roles and rules, then hands over the server roomCode', async () => {
    const screen = renderRules();
    fireEvent(
      screen.getByTestId(TESTIDS.gameRuleSwitch('isSheriffElectionEnabled')),
      'valueChange',
      false,
    );

    fireEvent.press(screen.getByTestId(TESTIDS.gameRulesSubmitButton));

    await waitFor(() => expect(flowCallbacks.onRoomCreated).toHaveBeenCalledWith('7777'));
    expect(mockCreateRoom).toHaveBeenCalledWith({
      expectedHostUserId: 'test-uid',
      gameType: 'werewolf',
      config: { templateRoles: ROLES, rules: { isSheriffElectionEnabled: false } },
    });
  });

  it('does not leave the flow when room creation fails', async () => {
    mockCreateRoom.mockRejectedValueOnce(new Error('服务未配置'));
    const screen = renderRules();

    fireEvent.press(screen.getByTestId(TESTIDS.gameRulesSubmitButton));

    await waitFor(() => expect(showAlert).toHaveBeenCalledWith('创建房间失败', expect.any(String)));
    expect(flowCallbacks.onRoomCreated).not.toHaveBeenCalled();
  });

  it('saves an edited template through the session and exits the flow', async () => {
    mockRouteParams = { roles: ROLES, rules: {}, existingRoomCode: '2468' };
    const session = createMockSession();
    const screen = renderRules(session);

    expect(screen.getByText('保存配置')).toBeTruthy();
    fireEvent.press(screen.getByTestId(TESTIDS.gameRulesSubmitButton));

    await waitFor(() => expect(flowCallbacks.onExitFlow).toHaveBeenCalledTimes(1));
    const command = jest.mocked(session.dispatch).mock.calls[0]?.[0];
    expect(command).toEqual({
      type: 'werewolf.config.update',
      templateRoles: ROLES,
      rules: undefined,
    });
    expect(mockCreateRoom).not.toHaveBeenCalled();
  });
});
