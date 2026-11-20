import {
  getSecrethitlerViewModel,
  type SecrethitlerCommand,
  secrethitlerEngine,
  type SecrethitlerState,
} from '@game-judge/game-engine/games/secrethitler/public';
import { createRoomSnapshot } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';

import { createFakeBgm } from '@/test-utils/fakeBgm';
import { createFakeRoomLink, readyLinkSnapshot, testIdentity } from '@/test-utils/linkSnapshot';
import {
  buildSecrethitlerPhaseStates,
  buildSecrethitlerTestLobby,
  startSecrethitlerTestGame,
} from '@/test-utils/secrethitlerState';
import { TESTIDS } from '@/testids';
import * as alertPresets from '@/utils/alertPresets';

import { secrethitlerReview } from '../../review/secrethitlerReview';
import { createSecrethitlerHostManagement } from '../secrethitlerRoomAdapter';
import {
  SecrethitlerBoardHeader,
  SecrethitlerBoardInfo,
  SecrethitlerHistoryDialog,
  SecrethitlerInvestigationResult,
  SecrethitlerPublicResult,
  SecrethitlerRoomScreen,
} from '../SecrethitlerRoomScreen';

vi.mock('@/contexts/AuthContext', () => ({
  useAuthContext: () => ({
    user: { id: 'host', avatarUrl: null, equippedEffect: null },
    loading: false,
  }),
}));
vi.mock('@/features/gacha/queries/useGachaQuery', () => ({
  useGachaStatusQuery: () => ({ data: undefined }),
}));
vi.mock('@/features/room/services/recentRooms', () => ({ addRecentRoom: vi.fn() }));

it('shows public vote results without allowing dismissal or confirmation', () => {
  const state = buildSecrethitlerPhaseStates().get('publicResult');
  if (
    state === undefined ||
    state.phase.kind !== 'publicResult' ||
    state.phase.previous.kind !== 'voting'
  )
    throw new Error('Missing vote result fixture');
  const submit = vi.fn(async () => false);
  const props = {
    state,
    viewModel: getSecrethitlerViewModel(state, 0),
    effectiveSeat: 0,
    controlledSeat: null,
    isSubmitting: false,
    submit,
  };
  render(<SecrethitlerPublicResult screen={props} />);
  expect(screen.getByRole('dialog', { name: '公共结果' })).toBeVisible();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.getByRole('dialog', { name: '公共结果' })).toBeVisible();
  expect(screen.queryByRole('button', { name: '知道了' })).not.toBeInTheDocument();
  expect(submit).not.toHaveBeenCalled();
});

it('shows a pending private investigation only to its president until explicit acknowledgement', () => {
  const state = buildSecrethitlerPhaseStates().get('investigationResult');
  if (state === undefined || state.phase.kind !== 'investigationResult')
    throw new Error('Missing investigation result fixture');
  const submit = vi.fn(async () => false);
  const seat = state.phase.presidentSeat;
  const props = {
    viewModel: getSecrethitlerViewModel(state, seat),
    controlledSeat: seat,
    isSubmitting: false,
    submit,
  };
  const { rerender } = render(<SecrethitlerInvestigationResult screen={props} />);
  expect(screen.getByRole('dialog', { name: '私密调查结果' })).toBeVisible();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(submit).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '知道了' }));
  expect(submit).toHaveBeenCalledWith(
    '确认调查结果',
    { type: 'secrethitler.action.acknowledgeInvestigation' },
    { controlledSeat: seat },
  );
  expect(screen.getByRole('dialog', { name: '私密调查结果' })).toBeVisible();
  rerender(
    <SecrethitlerInvestigationResult
      screen={{ ...props, viewModel: getSecrethitlerViewModel(state, null) }}
    />,
  );
  expect(screen.queryByRole('dialog', { name: '私密调查结果' })).not.toBeInTheDocument();
});

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
  expect(screen.getByText('自由派 0/5 · 法西斯 0/6 · 选举失败 0/3')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '对局记录' })).not.toBeInTheDocument();
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
    '重新开始',
  ]);
});

it('keeps terminal details behind the shared record dialog and preserves results and labels', async () => {
  const user = userEvent.setup();
  const state = buildSecrethitlerPhaseStates().get('ended');
  if (state === undefined || state.phase.kind !== 'ended') throw new Error('Missing ended fixture');
  const view = getSecrethitlerViewModel(state, null);
  if (view === null) throw new Error('Missing ended view');
  const { rerender } = render(
    <SecrethitlerBoardHeader screen={{ state, viewModel: view, mySeat: 0 }} />,
  );
  expect(screen.getByText(/获胜/)).toBeInTheDocument();
  expect(screen.queryByText('1 号 · 房主（你）')).not.toBeInTheDocument();
  const onClose = vi.fn();
  rerender(<SecrethitlerHistoryDialog state={state} view={view} mySeat={0} onClose={onClose} />);
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
  expect(onClose).toHaveBeenCalledOnce();
});

it('opens the match record from a green hand card only when public records are available', () => {
  const states = buildSecrethitlerPhaseStates();
  const viewing = states.get('viewing');
  const election = states.get('election');
  if (viewing === undefined || election === undefined) throw new Error('Missing phase fixture');
  const identity = testIdentity('secrethitler');
  const session = createFakeRoomLink<SecrethitlerState, SecrethitlerCommand>(
    readyLinkSnapshot(identity, createRoomSnapshot(viewing, 1)),
  );
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  Object.defineProperty(document.documentElement, 'clientWidth', {
    configurable: true,
    value: 390,
  });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <SecrethitlerRoomScreen
          room={identity.room}
          entryReason={null}
          onOpenMusicSettings={vi.fn()}
          onOpenRoomSettings={vi.fn()}
          onOpenUserSettings={vi.fn()}
          session={session}
          review={secrethitlerReview}
          audio={{
            ...createFakeBgm(),
            preload: vi.fn(),
            playEffect: vi.fn(async () => undefined),
            stopNarration: vi.fn(),
            setBgmVolume: vi.fn(),
            setGameAudioVolume: vi.fn(),
          }}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  expect(screen.queryByRole('button', { name: '对局记录' })).not.toBeInTheDocument();
  act(() => session.publishRoom(createRoomSnapshot(election, 2)));
  const record = screen.getByRole('button', { name: '对局记录' });
  expect(record).toHaveAttribute('data-card-category', 'resource');
  fireEvent.click(record);
  expect(screen.getByRole('dialog', { name: '对局记录' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: '关闭详情' }));
  expect(screen.queryByRole('dialog', { name: '对局记录' })).not.toBeInTheDocument();
});

it('automatically opens the acting president hand when reconnecting', () => {
  const state = buildSecrethitlerPhaseStates().get('legislativePresident');
  if (state === undefined || state.phase.kind !== 'legislativePresident')
    throw new Error('Missing president hand fixture');
  const presidentState: SecrethitlerState = {
    ...state,
    phase: { ...state.phase, presidentSeat: 0 },
  };
  const identity = testIdentity('secrethitler');
  const session = createFakeRoomLink<SecrethitlerState, SecrethitlerCommand>(
    readyLinkSnapshot(identity, createRoomSnapshot(presidentState, 1)),
  );
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <SecrethitlerRoomScreen
          room={identity.room}
          entryReason={null}
          onOpenMusicSettings={vi.fn()}
          onOpenRoomSettings={vi.fn()}
          onOpenUserSettings={vi.fn()}
          session={session}
          review={secrethitlerReview}
          audio={{
            ...createFakeBgm(),
            preload: vi.fn(),
            playEffect: vi.fn(async () => undefined),
            stopNarration: vi.fn(),
            setBgmVolume: vi.fn(),
            setGameAudioVolume: vi.fn(),
          }}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  expect(screen.getByRole('dialog', { name: '查看并弃牌' })).toBeVisible();
  expect(screen.queryByRole('button', { name: '关闭' })).not.toBeInTheDocument();
});

it.each([
  ['investigate', '调查阵营', 'secrethitler.action.investigate'],
  ['specialElection', '特别选举', 'secrethitler.action.specialElection'],
  ['execute', '处决玩家', 'secrethitler.action.execute'],
] as const)(
  'picks the %s target on the seat board before confirming',
  async (power, action, type) => {
    const states = buildSecrethitlerPhaseStates();
    const base = states.get('executive');
    if (base === undefined) throw new Error('Missing president fixture');
    const state: SecrethitlerState = {
      ...base,
      isAudioPlaying: false,
      lastChancellorSeat: null,
      lastPresidentSeat: null,
      investigatedSeats: [],
      phase: { kind: 'executive', presidentSeat: 0, returnToSeat: null, power, preview: [] },
    };
    const confirmation = vi
      .spyOn(alertPresets, 'showConfirmAlert')
      .mockImplementation(() => undefined);
    const error = vi.spyOn(alertPresets, 'showErrorAlert').mockImplementation(() => undefined);
    const identity = testIdentity('secrethitler');
    const session = createFakeRoomLink<SecrethitlerState, SecrethitlerCommand>(
      readyLinkSnapshot(identity, createRoomSnapshot(state, 1)),
    );
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <SecrethitlerRoomScreen
            room={identity.room}
            entryReason={null}
            onOpenMusicSettings={vi.fn()}
            onOpenRoomSettings={vi.fn()}
            onOpenUserSettings={vi.fn()}
            session={session}
            review={secrethitlerReview}
            audio={{
              ...createFakeBgm(),
              preload: vi.fn(),
              playEffect: vi.fn(async () => undefined),
              stopNarration: vi.fn(),
              setBgmVolume: vi.fn(),
              setGameAudioVolume: vi.fn(),
            }}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: action }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId(TESTIDS.seatTilePressable(0)));
    expect(confirmation).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId(TESTIDS.seatTilePressable(1)));
    expect(confirmation).toHaveBeenCalledWith(
      '确认选择？',
      expect.stringContaining('2 号'),
      expect.any(Function),
    );
    expect(session.dispatch).not.toHaveBeenCalled();
    session.dispatch.mockResolvedValueOnce({
      kind: 'undelivered',
      commandId: 'target',
      cause: 'network',
    });
    await act(async () => confirmation.mock.calls[0]?.[2]());
    expect(session.dispatch).toHaveBeenCalledWith({ type, targetSeatId: 1 }, expect.anything());
    fireEvent.click(screen.getByRole('button', { name: '取消选座' }));
    await act(async () => confirmation.mock.calls[0]?.[2]());
    expect(session.dispatch).toHaveBeenCalledOnce();
    expect(error).toHaveBeenCalledWith('选择已失效', '当前行动已改变，请重新选择。');
    error.mockRestore();
    confirmation.mockRestore();
  },
);

it('asks before showing private night recognition information', () => {
  const night = buildSecrethitlerPhaseStates().get('night');
  if (night === undefined) throw new Error('Missing night fixture');
  const fascistSeat = Object.entries(night.identities).find(([, role]) => role === 'fascist')?.[0];
  if (fascistSeat === undefined) throw new Error('Missing fascist');
  const originalRole = night.identities[0];
  if (originalRole === undefined) throw new Error('Missing host identity');
  const state: SecrethitlerState = {
    ...night,
    isAudioPlaying: false,
    identities: { ...night.identities, 0: 'fascist', [fascistSeat]: originalRole },
  };
  const confirmation = vi
    .spyOn(alertPresets, 'showConfirmAlert')
    .mockImplementation(() => undefined);
  const identity = testIdentity('secrethitler');
  const session = createFakeRoomLink<SecrethitlerState, SecrethitlerCommand>(
    readyLinkSnapshot(identity, createRoomSnapshot(state, 1)),
  );
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <SecrethitlerRoomScreen
          room={identity.room}
          entryReason={null}
          onOpenMusicSettings={vi.fn()}
          onOpenRoomSettings={vi.fn()}
          onOpenUserSettings={vi.fn()}
          session={session}
          review={secrethitlerReview}
          audio={{
            ...createFakeBgm(),
            preload: vi.fn(),
            playEffect: vi.fn(async () => undefined),
            stopNarration: vi.fn(),
            setBgmVolume: vi.fn(),
            setGameAudioVolume: vi.fn(),
          }}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: '确认信息' }));
  expect(confirmation).toHaveBeenCalledWith(
    '查看信息？',
    expect.any(String),
    expect.any(Function),
    { confirmText: '查看' },
  );
  expect(screen.queryByRole('dialog', { name: '确认信息' })).not.toBeInTheDocument();
  act(() => {
    void confirmation.mock.calls[0]?.[2]();
  });
  expect(screen.getByRole('dialog', { name: '确认信息' })).toBeVisible();
  confirmation.mockRestore();
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
