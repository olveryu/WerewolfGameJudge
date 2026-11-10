/**
 * GameRulesScreen: remembered rules persist on toggle (plague never does), every edit reaches
 * the flow, and the final button creates or saves with the board's roles + rules.
 */
import type {
  GameRuleOverrides,
  GameState,
  RoleId,
  WerewolfPublicCommand,
} from '@game-judge/game-engine/games/werewolf/public';
import { WEREWOLF_RULES_SCHEMA } from '@game-judge/game-engine/games/werewolf/public';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { Mock } from 'vitest';

import { useAuthContext } from '@/contexts/AuthContext';
import { useServices } from '@/contexts/ServiceContext';
import type { RoomCreationRequest, RoomRecord } from '@/features/room/model/RoomDirectory';
import { getRememberedGameConfig } from '@/features/settings/rememberedGameConfigs';
import type { WerewolfRulesParams } from '@/games/werewolf/navigation/types';
import { GameRulesScreen } from '@/games/werewolf/screens/GameRulesScreen/GameRulesScreen';
import { storage } from '@/services/infra/localStorage';
import { createFakeRoomLink, idleLinkSnapshot } from '@/test-utils/linkSnapshot';
import { successfulRoomCommand } from '@/test-utils/roomCommand';
import { buildWerewolfTestState } from '@/test-utils/werewolfState';
import { TESTIDS } from '@/testids';
import { showAlert } from '@/utils/alert';

vi.mock('@/contexts/AuthContext', () => ({ useAuthContext: vi.fn() }));
vi.mock('@/contexts/ServiceContext', () => ({ useServices: vi.fn() }));
vi.mock('@/utils/alert', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/utils/alert')>()),
  showAlert: vi.fn(),
}));

const ROLES: readonly RoleId[] = ['wolf', 'seer', 'villager'];

const createRoom: Mock<(request: RoomCreationRequest) => Promise<RoomRecord>> = vi.fn();

function createSession() {
  return createFakeRoomLink<GameState, WerewolfPublicCommand>(idleLinkSnapshot<GameState>(), () =>
    Promise.resolve(successfulRoomCommand(buildWerewolfTestState())),
  );
}

function renderRules(params: WerewolfRulesParams, session = createSession()) {
  const onRulesChange = vi.fn<(rules: GameRuleOverrides) => void>();
  const router = createMemoryRouter([
    { path: '/room/:roomCode', element: <p>room</p> },
    {
      path: '/',
      element: <GameRulesScreen session={session} params={params} onRulesChange={onRulesChange} />,
    },
  ]);
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { onRulesChange, router, session };
}

function ruleSwitch(rule: keyof GameRuleOverrides): HTMLElement {
  return screen.getByTestId(TESTIDS.gameRuleSwitch(rule));
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.mocked(useAuthContext).mockReturnValue({
    user: { id: 'test-uid' },
  } as ReturnType<typeof useAuthContext>);
  (useServices as Mock).mockReturnValue({ roomCreator: { createRoom } });
  createRoom.mockResolvedValue({
    roomCode: '7777',
    roomId: 'room-id-7777',
    gameType: 'werewolf',
    hostUserId: 'test-uid',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  });
});

describe('GameRulesScreen', () => {
  it('remembers sheriff and witch toggles immediately but never plague mode', async () => {
    const { onRulesChange } = renderRules({
      roles: ROLES,
      rules: { isSheriffElectionEnabled: true },
    });

    fireEvent.click(ruleSwitch('isSheriffElectionEnabled'));
    fireEvent.click(ruleSwitch('witchCanSelfHeal'));
    expect(getRememberedGameConfig('werewolf', WEREWOLF_RULES_SCHEMA)).toEqual({
      isSheriffElectionEnabled: false,
      witchCanSelfHeal: true,
    });

    fireEvent.click(ruleSwitch('isPlagueMode'));
    const buttons = vi.mocked(showAlert).mock.lastCall?.[2];
    const confirm = buttons?.find((button) => button.text === '确认开启');
    if (confirm?.onPress === undefined) throw new Error('Missing plague confirm button');
    void confirm.onPress();

    await waitFor(() => expect(ruleSwitch('isPlagueMode')).toBeChecked());
    expect(getRememberedGameConfig('werewolf', WEREWOLF_RULES_SCHEMA)).toEqual({
      isSheriffElectionEnabled: false,
      witchCanSelfHeal: true,
    });
    expect(onRulesChange).toHaveBeenLastCalledWith({
      isSheriffElectionEnabled: false,
      witchCanSelfHeal: true,
      isPlagueMode: true,
    });
  });

  it('reverts the toggle and alerts when the preference cannot be stored', async () => {
    const error = new Error('Storage disabled');
    error.name = 'SecurityError';
    vi.spyOn(storage, 'set').mockImplementationOnce(() => {
      throw error;
    });
    const { onRulesChange } = renderRules({
      roles: ROLES,
      rules: { isSheriffElectionEnabled: true },
    });

    fireEvent.click(ruleSwitch('isSheriffElectionEnabled'));

    await waitFor(() =>
      expect(showAlert).toHaveBeenCalledWith('保存规则偏好失败', expect.any(String)),
    );
    expect(ruleSwitch('isSheriffElectionEnabled')).toBeChecked();
    expect(onRulesChange).toHaveBeenLastCalledWith({ isSheriffElectionEnabled: true });
    expect(
      getRememberedGameConfig('werewolf', WEREWOLF_RULES_SCHEMA).isSheriffElectionEnabled,
    ).toBe(true);
  });

  it('creates the room with the configured roles and rules, then enters it', async () => {
    const { router } = renderRules({ roles: ROLES, rules: { isSheriffElectionEnabled: true } });
    fireEvent.click(ruleSwitch('isSheriffElectionEnabled'));

    fireEvent.click(screen.getByTestId(TESTIDS.gameRulesSubmitButton));

    await waitFor(() => expect(router.state.location.pathname).toBe('/room/7777'));
    expect(router.state.location.state).toEqual({ entryReason: 'created' });
    expect(createRoom).toHaveBeenCalledWith({
      expectedHostUserId: 'test-uid',
      gameType: 'werewolf',
      config: { templateRoles: ROLES, rules: { isSheriffElectionEnabled: false } },
    });
  });

  it('does not leave the flow when room creation fails', async () => {
    createRoom.mockRejectedValueOnce(new Error('服务未配置'));
    const { router } = renderRules({ roles: ROLES, rules: {} });

    fireEvent.click(screen.getByTestId(TESTIDS.gameRulesSubmitButton));

    await waitFor(() => expect(showAlert).toHaveBeenCalledWith('创建房间失败', expect.any(String)));
    expect(router.state.location.pathname).toBe('/');
  });

  it('saves an edited board through the session and returns to the room', async () => {
    const { router, session } = renderRules({ roles: ROLES, rules: {}, existingRoomCode: '2468' });

    expect(screen.getByTestId(TESTIDS.gameRulesSubmitButton)).toHaveTextContent('保存配置');
    fireEvent.click(screen.getByTestId(TESTIDS.gameRulesSubmitButton));

    await waitFor(() => expect(router.state.location.pathname).toBe('/room/2468'));
    expect(session.dispatch.mock.calls[0]?.[0]).toEqual({
      type: 'werewolf.config.update',
      templateRoles: ROLES,
      rules: undefined,
    });
    expect(createRoom).not.toHaveBeenCalled();
  });
});
