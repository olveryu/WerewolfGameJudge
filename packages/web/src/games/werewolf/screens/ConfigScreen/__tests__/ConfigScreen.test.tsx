/**
 * ConfigScreen: rendering, and the handoff to the Rules step — validated roles plus the current
 * rules (remembered for a new room, the room's own when editing, Rules-step edits when handed
 * back). Nominate mode submits directly.
 */
import type {
  GameRuleOverrides,
  GameState,
  RoleId,
  WerewolfPublicCommand,
} from '@game-judge/game-engine/games/werewolf/public';
import { PRESET_TEMPLATES } from '@game-judge/game-engine/games/werewolf/public';
import { createRoomSnapshot } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { useAuthContext } from '@/contexts/AuthContext';
import { setRememberedGameConfigField } from '@/features/settings/rememberedGameConfigs';
import type { WerewolfConfigParams, WerewolfRulesParams } from '@/games/werewolf/navigation/types';
import { ConfigScreen } from '@/games/werewolf/screens/ConfigScreen/ConfigScreen';
import {
  createFakeRoomLink,
  type FakeRoomLink,
  idleLinkSnapshot,
  readyLinkSnapshot,
  testIdentity,
} from '@/test-utils/linkSnapshot';
import { successfulRoomCommand } from '@/test-utils/roomCommand';
import { buildWerewolfTestState } from '@/test-utils/werewolfState';
import { TESTIDS } from '@/testids';

vi.mock('@/contexts/AuthContext', () => ({ useAuthContext: vi.fn() }));

type WerewolfFakeLink = FakeRoomLink<GameState, WerewolfPublicCommand>;

const BOARD: readonly RoleId[] = ['villager', 'villager', 'wolf', 'wolf', 'seer', 'witch'];

function createSession(): WerewolfFakeLink {
  return createFakeRoomLink<GameState, WerewolfPublicCommand>(idleLinkSnapshot<GameState>(), () =>
    Promise.resolve(successfulRoomCommand(buildWerewolfTestState())),
  );
}

function publishRoom(session: WerewolfFakeLink, state: GameState, revision: number) {
  session.publish(
    readyLinkSnapshot<GameState>(
      testIdentity('werewolf', { roomCode: state.roomCode, hostUserId: state.hostUserId }),
      createRoomSnapshot(state, revision),
    ),
  );
}

function readyRoom(session: WerewolfFakeLink, rules: GameRuleOverrides): GameState {
  const state = buildWerewolfTestState({ rules, templateRoles: [...BOARD] });
  publishRoom(session, state, 1);
  return state;
}

function renderConfigScreen(params: WerewolfConfigParams, session = createSession()) {
  const callbacks = {
    onPickBoard: vi.fn<() => void>(),
    onContinue: vi.fn<(rulesParams: WerewolfRulesParams) => void>(),
    onReturnToRoom: vi.fn<(roomCode: string) => void>(),
  };
  const router = createMemoryRouter([
    { path: '/games', element: <p>games</p> },
    {
      path: '/',
      element: <ConfigScreen session={session} params={params} exitPath="/games" {...callbacks} />,
    },
  ]);
  render(<RouterProvider router={router} />);
  return { callbacks, router };
}

/** selectionToRoles re-derives order from the chip layout, so compare as a multiset. */
function sortedRoles(roles: readonly RoleId[]): RoleId[] {
  return [...roles].sort();
}

function lastHandoff(onContinue: ReturnType<typeof renderConfigScreen>['callbacks']['onContinue']) {
  const handoff = onContinue.mock.lastCall?.[0];
  if (handoff === undefined) throw new Error('ConfigScreen did not hand off to the Rules step');
  return handoff;
}

beforeEach(() => {
  localStorage.clear();
  vi.mocked(useAuthContext).mockReturnValue({
    user: { id: 'host', displayName: '房主' },
  } as ReturnType<typeof useAuthContext>);
});

describe('ConfigScreen rendering', () => {
  it('shows the preset pill, player count, faction tabs and the good-faction roles', () => {
    renderConfigScreen({ presetName: '预女猎白' });

    expect(screen.getByTestId(TESTIDS.configTemplatePill)).toHaveTextContent('预女猎白');
    expect(screen.getByText('12人')).toBeInTheDocument();
    expect(screen.getByTestId(TESTIDS.configFactionTab('Villager'))).toBeInTheDocument();
    expect(screen.getByTestId(TESTIDS.configFactionTab('Wolf'))).toBeInTheDocument();
    expect(screen.getByTestId(TESTIDS.configFactionTab('Special'))).toBeInTheDocument();
    expect(screen.getByText('神职')).toBeInTheDocument();
    expect(screen.getByText('女巫')).toBeInTheDocument();
    expect(screen.getByText('预言家')).toBeInTheDocument();
    expect(screen.getByTestId(TESTIDS.configStepperDec('villager'))).toBeInTheDocument();
    expect(screen.getByTestId(TESTIDS.configOverflowReset)).toBeInTheDocument();
    expect(screen.getByTestId(TESTIDS.configNextButton)).toHaveTextContent('下一步：规则');
  });

  it('switches faction tabs and steps bulk roles', async () => {
    renderConfigScreen({ presetName: '预女猎白' });

    fireEvent.click(screen.getByTestId(TESTIDS.configFactionTab('Wolf')));
    expect(await screen.findByTestId(TESTIDS.configStepperCount('wolf'))).toHaveTextContent('4');
    fireEvent.click(screen.getByTestId(TESTIDS.configStepperDec('wolf')));

    expect(screen.getByTestId(TESTIDS.configStepperCount('wolf'))).toHaveTextContent('3');
    expect(screen.getByText('11人')).toBeInTheDocument();
    expect(screen.getByTestId(TESTIDS.configTemplatePill)).toHaveTextContent('自定义');
  });

  it('navigates and activates faction tabs with horizontal keyboard keys', async () => {
    renderConfigScreen({ presetName: '预女猎白' });

    const villagerTab = screen.getByTestId(TESTIDS.configFactionTab('Villager'));
    const wolfTab = screen.getByTestId(TESTIDS.configFactionTab('Wolf'));
    const specialTab = screen.getByTestId(TESTIDS.configFactionTab('Special'));
    villagerTab.focus();

    fireEvent.keyDown(villagerTab, { key: 'ArrowRight' });
    await waitFor(() => {
      expect(wolfTab).toHaveFocus();
      expect(wolfTab).toHaveAttribute('aria-selected', 'true');
    });

    fireEvent.keyDown(wolfTab, { key: 'ArrowRight' });
    await waitFor(() => {
      expect(specialTab).toHaveFocus();
      expect(specialTab).toHaveAttribute('aria-selected', 'true');
    });

    fireEvent.keyDown(specialTab, { key: 'ArrowRight' });
    await waitFor(() => {
      expect(villagerTab).toHaveFocus();
      expect(villagerTab).toHaveAttribute('aria-selected', 'true');
    });

    fireEvent.keyDown(villagerTab, { key: 'ArrowLeft' });
    await waitFor(() => {
      expect(specialTab).toHaveFocus();
      expect(specialTab).toHaveAttribute('aria-selected', 'true');
    });

    fireEvent.keyDown(specialTab, { key: 'Home' });
    await waitFor(() => {
      expect(villagerTab).toHaveFocus();
      expect(villagerTab).toHaveAttribute('aria-selected', 'true');
    });
  });

  it('switches a variant from the role card opened by a long press', () => {
    vi.useFakeTimers();
    try {
      renderConfigScreen({ presetName: '预女猎白' });
      const witchChip = screen.getByTestId(TESTIDS.configRoleChip('witch'));

      fireEvent.pointerDown(witchChip);
      act(() => {
        vi.advanceTimersByTime(600);
      });
      fireEvent.pointerUp(witchChip);
      fireEvent.click(witchChip);
      fireEvent.click(screen.getByTestId(TESTIDS.configVariantOption('poisoner')));
    } finally {
      vi.useRealTimers();
    }

    expect(screen.getByTestId(TESTIDS.configRoleChip('witch'))).toHaveTextContent('毒师');
    expect(screen.getByTestId(TESTIDS.configRoleChip('witch'))).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('opens the board picker from the template pill', () => {
    const { callbacks } = renderConfigScreen({ presetName: '预女猎白' });

    fireEvent.click(screen.getByTestId(TESTIDS.configTemplatePill));

    expect(callbacks.onPickBoard).toHaveBeenCalledTimes(1);
  });

  it('leaves for the exit path when Back is pressed on a directly opened flow', async () => {
    const { router } = renderConfigScreen({ presetName: '预女猎白' });

    fireEvent.click(screen.getByTestId(TESTIDS.configBackButton));

    await waitFor(() => expect(router.state.location.pathname).toBe('/games'));
  });
});

describe('ConfigScreen → Rules handoff', () => {
  it('hands the validated preset roles and remembered rules to the Rules step for a new room', () => {
    setRememberedGameConfigField('werewolf', 'witchCanSelfHeal', true);
    const preset = PRESET_TEMPLATES.find((template) => template.name === '预女猎白');
    if (preset === undefined) throw new Error('Missing preset 预女猎白');
    const { callbacks } = renderConfigScreen({ presetName: '预女猎白' });

    fireEvent.click(screen.getByTestId(TESTIDS.configNextButton));

    expect(callbacks.onContinue).toHaveBeenCalledTimes(1);
    const handoff = lastHandoff(callbacks.onContinue);
    expect(sortedRoles(handoff.roles)).toEqual(sortedRoles(preset.roles));
    expect(handoff.rules).toEqual({ isSheriffElectionEnabled: true, witchCanSelfHeal: true });
    expect(handoff.existingRoomCode).toBeUndefined();
  });

  it('carries rules edited on the Rules step back through updatedRules', () => {
    const { callbacks } = renderConfigScreen({
      presetName: '预女猎白',
      updatedRules: { isSheriffElectionEnabled: false, isPlagueMode: true },
    });

    fireEvent.click(screen.getByTestId(TESTIDS.configNextButton));

    expect(lastHandoff(callbacks.onContinue).rules).toEqual({
      isSheriffElectionEnabled: false,
      isPlagueMode: true,
    });
  });

  it.each([true, false])(
    'uses the existing room sheriff setting %s instead of the remembered preference in edit mode',
    (isSheriffElectionEnabled) => {
      setRememberedGameConfigField(
        'werewolf',
        'isSheriffElectionEnabled',
        !isSheriffElectionEnabled,
      );
      const session = createSession();
      const state = readyRoom(session, { isSheriffElectionEnabled });
      const { callbacks } = renderConfigScreen({ existingRoomCode: state.roomCode }, session);

      fireEvent.click(screen.getByTestId(TESTIDS.configNextButton));

      const handoff = lastHandoff(callbacks.onContinue);
      expect(sortedRoles(handoff.roles)).toEqual(sortedRoles(BOARD));
      expect(handoff.rules).toEqual({ isSheriffElectionEnabled });
      expect(handoff.existingRoomCode).toBe(state.roomCode);
    },
  );

  it('keeps the edited board when the room publishes a new revision', () => {
    const session = createSession();
    const state = readyRoom(session, {});
    const { callbacks } = renderConfigScreen({ existingRoomCode: state.roomCode }, session);

    fireEvent.click(screen.getByTestId(TESTIDS.configRoleChip('hunter')));
    // Another player takes a seat: the authoritative snapshot moves on.
    act(() => publishRoom(session, { ...state }, 2));
    fireEvent.click(screen.getByTestId(TESTIDS.configNextButton));

    expect(sortedRoles(lastHandoff(callbacks.onContinue).roles)).toEqual(
      sortedRoles([...BOARD, 'hunter']),
    );
  });

  it('submits a board nomination directly without visiting the Rules step', async () => {
    const session = createSession();
    const state = readyRoom(session, {});
    const { callbacks } = renderConfigScreen(
      { nominateMode: { roomCode: state.roomCode } },
      session,
    );

    expect(screen.getByTestId(TESTIDS.configNextButton)).toHaveTextContent('提交建议');
    fireEvent.click(screen.getByTestId(TESTIDS.configNextButton));

    await waitFor(() => expect(callbacks.onReturnToRoom).toHaveBeenCalledWith(state.roomCode));
    const command = session.dispatch.mock.lastCall?.[0];
    expect(command).toMatchObject({ type: 'werewolf.board.nominate', displayName: '房主' });
    expect(command?.type === 'werewolf.board.nominate' && sortedRoles(command.roles)).toEqual(
      sortedRoles(BOARD),
    );
    expect(callbacks.onContinue).not.toHaveBeenCalled();
  });
});
