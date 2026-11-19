import {
  getSecrethitlerViewModel,
  secrethitlerEngine,
} from '@game-judge/game-engine/games/secrethitler/public';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  buildSecrethitlerPhaseStates,
  buildSecrethitlerTestLobby,
  startSecrethitlerTestGame,
} from '@/test-utils/secrethitlerState';

import { createSecrethitlerHostManagement } from '../secrethitlerRoomAdapter';
import { SecrethitlerBoardHeader, SecrethitlerBoardInfo } from '../SecrethitlerRoomScreen';

it('allows assigning roles when every occupied seat is a bot', () => {
  const initial = secrethitlerEngine.createInitialState(
    { numberOfPlayers: 5, voteMode: 'public' },
    { roomCode: '1234', hostUserId: 'host', nowMs: 1000, commandId: 'create' },
  );
  const decision = secrethitlerEngine.decide(
    initial,
    { type: 'room.seat.fillBots' },
    {
      actor: { kind: 'user', userId: 'host' },
      controlledSeat: null,
      nowMs: 1000,
      commandId: 'fill',
      randomSeed: 'all-bots',
    },
  );
  if (decision.kind === 'reject') throw new Error(decision.reason);
  const state = decision.events.reduce(secrethitlerEngine.evolve, initial);
  const denied = { isAllowed: false, reason: null } as const;
  const panel = createSecrethitlerHostManagement({
    state,
    isSubmitting: false,
    submit: vi.fn(async () => true),
    review: null,
    onMusicSettings: vi.fn(),
    capabilities: {
      canConfigureGame: denied,
      canFillBots: denied,
      canClearSeats: denied,
      canShareRoom: denied,
    },
  });
  const assignAction = panel.sections
    .flatMap((section) => section.actions)
    .find((action) => action.label === '分配角色');
  expect(assignAction?.isEnabled).toBe(true);
});

it.each(['lobby', 'viewing'] as const)('hides the match summary during %s', (phase) => {
  const state = buildSecrethitlerPhaseStates().get(phase);
  if (state === undefined) throw new Error(`Missing ${phase} fixture`);
  const { container } = render(
    <SecrethitlerBoardHeader
      screen={{ state, viewModel: getSecrethitlerViewModel(state, 0), mySeat: 0 }}
    />,
  );
  expect(container).toBeEmptyDOMElement();
});

it('keeps the match summary hidden until first-night narration finishes', () => {
  const states = buildSecrethitlerPhaseStates();
  const night = states.get('night');
  const election = states.get('election');
  if (night === undefined || election === undefined)
    throw new Error('Missing first-night transition fixtures');
  const { container, rerender } = render(
    <SecrethitlerBoardHeader
      screen={{ state: night, viewModel: getSecrethitlerViewModel(night, 0), mySeat: 0 }}
    />,
  );
  expect(container).toBeEmptyDOMElement();
  startSecrethitlerTestGame(buildSecrethitlerTestLobby(), (state) => {
    if (state.phase.kind !== 'election' || !state.isAudioPlaying) return;
    rerender(
      <SecrethitlerBoardHeader
        screen={{ state, viewModel: getSecrethitlerViewModel(state, 0), mySeat: 0 }}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
  rerender(
    <SecrethitlerBoardHeader
      screen={{ state: election, viewModel: getSecrethitlerViewModel(election, 0), mySeat: 0 }}
    />,
  );
  expect(screen.getByRole('button', { name: '对局记录' })).toHaveTextContent(
    '自由派 0/5 · 法西斯 0/6 · 选举失败 0/3',
  );
});

it('uses electronic first-night guidance without a reading script or manual progression controls', () => {
  const state = buildSecrethitlerPhaseStates().get('night');
  if (state === undefined) throw new Error('Missing night fixture');
  render(
    <SecrethitlerBoardHeader
      screen={{
        state,
        viewModel: getSecrethitlerViewModel(state, 0),
        mySeat: 0,
      }}
    />,
  );
  expect(screen.queryByRole('button', { name: '对局记录' })).not.toBeInTheDocument();
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  expect(screen.queryByText(/电子主持进行中/)).not.toBeInTheDocument();
  expect(screen.queryByText('所有玩家请闭上眼睛。')).not.toBeInTheDocument();
  expect(screen.queryByText(/朗读/)).not.toBeInTheDocument();
  const denied = { isAllowed: false, reason: null } as const;
  const panel = createSecrethitlerHostManagement({
    state,
    isSubmitting: false,
    submit: vi.fn(async () => true),
    review: null,
    onMusicSettings: vi.fn(),
    capabilities: {
      canConfigureGame: denied,
      canFillBots: denied,
      canClearSeats: denied,
      canShareRoom: denied,
    },
  });
  expect(panel.task).toBeNull();
  const actions = panel.sections.flatMap((section) => section.actions);
  expect(actions.map((action) => action.label)).toEqual([
    '重播当前语音',
    '标记机器人已确认',
    '中止本局',
  ]);
});

it('keeps terminal details behind the shared record dialog and preserves results and labels', async () => {
  const user = userEvent.setup();
  const state = buildSecrethitlerPhaseStates().get('ended');
  if (state === undefined || state.phase.kind !== 'ended') throw new Error('Missing ended fixture');
  render(
    <SecrethitlerBoardHeader
      screen={{
        state,
        viewModel: getSecrethitlerViewModel(state, null),
        mySeat: 0,
      }}
    />,
  );
  expect(screen.getByRole('button', { name: '对局记录' })).toHaveTextContent(/获胜/);
  expect(screen.queryByText('1 号 · 房主（你）')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '对局记录' }));
  expect(screen.getByRole('dialog', { name: '对局记录' })).toBeInTheDocument();
  expect(screen.getByText('1 号 · 房主（你）')).toBeInTheDocument();
  expect(screen.getAllByText(/（机器人）/)).toHaveLength(6);
  expect(screen.getByText(/至少 5 名真人.*注册玩家获得 33 经验/)).toBeInTheDocument();
  expect(screen.getByRole('progressbar', { name: '自由派政策' })).toHaveAttribute(
    'value',
    String(state.liberalPolicies),
  );
  expect(screen.getByRole('progressbar', { name: '法西斯政策' })).toHaveAttribute(
    'value',
    String(state.fascistPolicies),
  );
  expect(screen.getByText('公开对局记录')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '关闭详情' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('shows public composition in the room dialog without revealing seat identities', async () => {
  const user = userEvent.setup();
  const state = buildSecrethitlerPhaseStates().get('viewing');
  if (state === undefined) throw new Error('Missing viewing fixture');
  render(<SecrethitlerBoardInfo state={state} embedded />);
  expect(screen.getByText('秘密希特勒（8人）')).toBeVisible();
  expect(screen.queryByRole('button', { name: '展开配置' })).not.toBeInTheDocument();
  expect(screen.getByText('投票方式').nextElementSibling).toHaveTextContent('公投');
  expect(screen.getByText('自由派×5')).toBeInTheDocument();
  expect(screen.getByText('法西斯×2')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /^希特勒/ }));
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(screen.getByText('胜利条件')).toBeInTheDocument();
  expect(screen.queryByText(/号 ·/)).not.toBeInTheDocument();
});

it('shows the configured Secret Hitler ballot mode in the room configuration', () => {
  const state = buildSecrethitlerPhaseStates().get('viewing');
  if (state === undefined) throw new Error('Missing viewing fixture');
  render(
    <SecrethitlerBoardInfo
      state={{ ...state, config: { ...state.config, voteMode: 'secret' } }}
      embedded
    />,
  );

  expect(screen.getByText('投票方式').nextElementSibling).toHaveTextContent('暗投');
});
