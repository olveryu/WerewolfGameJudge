/** The werewolf config flow host: step history, kept-alive ConfigScreen, and the room boundary. */
import type {
  GameState,
  WerewolfPublicCommand,
} from '@game-judge/game-engine/games/werewolf/public';
import { act, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { createMemoryRouter, RouterProvider, useParams } from 'react-router';

import type { WerewolfConfigParams, WerewolfRulesParams } from '@/games/werewolf/navigation/types';
import { WerewolfConfigFlowScreen } from '@/games/werewolf/navigation/WerewolfConfigFlowScreen';
import { createFakeRoomLink, idleLinkSnapshot } from '@/test-utils/linkSnapshot';

interface BoardPickerProbeProps {
  readonly exitPath: string;
  readonly onSelect: (presetName: string) => void;
  readonly onCustom: () => void;
}

interface ConfigProbeProps {
  readonly params: WerewolfConfigParams;
  readonly onPickBoard: () => void;
  readonly onContinue: (params: WerewolfRulesParams) => void;
  readonly onReturnToRoom: (roomCode: string) => void;
}

interface RulesProbeProps {
  readonly params: WerewolfRulesParams;
  readonly onRulesChange: (rules: WerewolfRulesParams['rules']) => void;
}

interface Probes {
  board: BoardPickerProbeProps | null;
  config: ConfigProbeProps | null;
  rules: RulesProbeProps | null;
  configMounts: number;
}

const probes = vi.hoisted(
  (): Probes => ({ board: null, config: null, rules: null, configMounts: 0 }),
);

vi.mock('@/games/werewolf/screens/BoardPickerScreen/BoardPickerScreen', () => ({
  BoardPickerScreen: (props: BoardPickerProbeProps) => {
    probes.board = props;
    return <p>board picker</p>;
  },
}));

vi.mock('@/games/werewolf/screens/ConfigScreen/ConfigScreen', () => ({
  ConfigScreen: function ConfigProbe(props: ConfigProbeProps) {
    probes.config = props;
    useEffect(() => {
      probes.configMounts += 1;
    }, []);
    return <p>config</p>;
  },
}));

vi.mock('@/games/werewolf/screens/GameRulesScreen/GameRulesScreen', () => ({
  GameRulesScreen: (props: RulesProbeProps) => {
    probes.rules = props;
    return <p>rules</p>;
  },
}));

function RoomProbe() {
  return <p>room {useParams().roomCode}</p>;
}

function renderFlow(initialEntries: string[]) {
  const session = createFakeRoomLink<GameState, WerewolfPublicCommand>(
    idleLinkSnapshot<GameState>(),
  );
  const router = createMemoryRouter(
    [
      { path: '/games', element: <p>games</p> },
      { path: '/room/:roomCode', element: <RoomProbe /> },
      {
        path: '/game/:gameType/config/:mode/:roomCode?',
        element: <WerewolfConfigFlowScreen session={session} />,
      },
    ],
    { initialEntries, initialIndex: initialEntries.length - 1 },
  );
  render(<RouterProvider router={router} />);
  return router;
}

function requireProbe<T>(probe: T | null): T {
  if (probe === null) throw new Error('probe screen has not rendered');
  return probe;
}

describe('WerewolfConfigFlowScreen', () => {
  beforeEach(() => {
    probes.board = null;
    probes.config = null;
    probes.rules = null;
    probes.configMounts = 0;
  });

  it('picks a board onto the role config and Back returns to the picker', async () => {
    const router = renderFlow(['/games', '/game/werewolf/config/create']);
    expect(requireProbe(probes.board).exitPath).toBe('/games');

    act(() => requireProbe(probes.board).onSelect('预女猎白'));

    expect(screen.getByText('config')).toBeVisible();
    expect(requireProbe(probes.config).params).toEqual({ presetName: '预女猎白' });
    expect(router.state.location.search).toBe('?step=Config');

    await act(() => router.navigate(-1));
    expect(screen.getByText('board picker')).toBeVisible();
    expect(screen.queryByText('config')).not.toBeInTheDocument();
  });

  it('keeps the role config mounted under a picker it opened and pops back with the new board', async () => {
    const router = renderFlow(['/games', '/game/werewolf/config/create']);
    act(() => requireProbe(probes.board).onSelect('预女猎白'));

    act(() => requireProbe(probes.config).onPickBoard());
    expect(screen.getByText('board picker')).toBeVisible();
    expect(screen.getByText('config')).not.toBeVisible();

    await act(async () => requireProbe(probes.board).onSelect('狼美守卫'));
    expect(screen.getByText('config')).toBeVisible();
    expect(requireProbe(probes.config).params).toEqual({ presetName: '狼美守卫' });
    expect(probes.configMounts).toBe(1);

    await act(() => router.navigate(-1));
    expect(screen.getByText('board picker')).toBeVisible();
  });

  it('hands rules edited on the Rules step back to the role config', async () => {
    const router = renderFlow(['/games', '/game/werewolf/config/create']);
    act(() => requireProbe(probes.board).onSelect('预女猎白'));
    act(() => requireProbe(probes.config).onContinue({ roles: ['wolf', 'seer'], rules: {} }));
    expect(screen.getByText('rules')).toBeVisible();
    expect(router.state.location.search).toBe('?step=Rules');

    act(() => requireProbe(probes.rules).onRulesChange({ witchCanSelfHeal: true }));
    await act(() => router.navigate(-1));

    expect(screen.getByText('config')).toBeVisible();
    expect(requireProbe(probes.config).params).toEqual({
      presetName: '预女猎白',
      updatedRules: { witchCanSelfHeal: true },
    });
  });

  it('replaces the first-page picker of a nomination so Back from the role config leaves for the room', async () => {
    const router = renderFlow(['/room/5678', '/game/werewolf/config/nominate/5678']);
    expect(requireProbe(probes.board).exitPath).toBe('/room/5678');

    act(() => requireProbe(probes.board).onSelect('预女猎白'));
    expect(requireProbe(probes.config).params).toEqual({
      presetName: '预女猎白',
      nominateMode: { roomCode: '5678' },
    });

    await act(() => router.navigate(-1));
    expect(screen.getByText('room 5678')).toBeInTheDocument();
  });

  it('starts an edit at the role config and returns to its room', () => {
    renderFlow(['/room/2468', '/game/werewolf/config/edit/2468']);
    expect(requireProbe(probes.config).params).toEqual({ existingRoomCode: '2468' });

    act(() => requireProbe(probes.config).onReturnToRoom('2468'));

    expect(screen.getByText('room 2468')).toBeInTheDocument();
  });

  it('restarts a flow that lands mid-flow without its steps', () => {
    const router = renderFlow(['/game/werewolf/config/create?step=Rules']);

    expect(screen.getByText('board picker')).toBeVisible();
    expect(router.state.location.search).toBe('');
  });
});
