import {
  getSpotmatchViewModel,
  SPOTMATCH_REASONS,
  SPOTMATCH_SUCCESS_PAUSE_MS,
  type SpotmatchCommand,
  spotmatchEngine,
  type SpotmatchState,
} from '@game-judge/game-engine/games/spotmatch/public';
import { act, fireEvent, render, screen, within } from '@testing-library/react';

import type { ReadyRoomSubmitOptions } from '@/features/room/controllers/useReadyRoomSession';
import { TESTIDS } from '@/testids';

import type { SpotmatchRoomScreenState } from '../hooks/useSpotmatchRoomState';
import { SpotmatchStageArea } from '../SpotmatchRoomScreen';

const originalAnimate = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'animate');
const animations: { readonly cancel: () => void; currentTime: number }[] = [];
const animate = vi.fn(
  (
    _frames: Keyframe[] | PropertyIndexedKeyframes | null,
    _options?: number | KeyframeAnimationOptions,
  ) => {
    const animation = { cancel: vi.fn(), currentTime: 0 };
    animations.push(animation);
    return animation;
  },
);
beforeEach(() => {
  animations.length = 0;
  animate.mockClear();
  Object.defineProperty(HTMLElement.prototype, 'animate', { configurable: true, value: animate });
});
afterAll(() => {
  if (originalAnimate) Object.defineProperty(HTMLElement.prototype, 'animate', originalAnimate);
  else Reflect.deleteProperty(HTMLElement.prototype, 'animate');
});

function fixture() {
  let state = spotmatchEngine.createInitialState(
    { numberOfPlayers: 2, cardsPerPlayer: 5 },
    { roomCode: '1234', hostUserId: 'host', nowMs: 1000, commandId: 'create' },
  );
  let serial = 0;
  const send = (command: SpotmatchCommand, userId = 'host', nowMs = 1000) => {
    const decision = spotmatchEngine.decide(state, command, {
      actor: { kind: 'user', userId },
      controlledSeat: null,
      nowMs,
      commandId: `c:${serial++}`,
      randomSeed: `seed:${serial}`,
    });
    if (decision.kind !== 'commit') throw new Error(decision.reason);
    state = decision.events.reduce(spotmatchEngine.evolve, state);
    return state;
  };
  send({ type: 'room.seat.take', seat: 0, profile: { displayName: '甲' } });
  send({ type: 'room.seat.take', seat: 1, profile: { displayName: '乙' } }, 'other');
  send({ type: 'spotmatch.game.begin' });
  const submit = vi.fn(
    async (_label: string, _command: SpotmatchCommand, _options?: ReadyRoomSubmitOptions) => true,
  );
  const model = (current: SpotmatchState = state, isSubmitting = false) =>
    ({
      state: current,
      viewModel: getSpotmatchViewModel(current, 0),
      effectiveSeat: 0,
      controlledSeat: null,
      submit,
      isSubmitting,
      shellModel: { connection: { status: { kind: 'live' } } },
    }) as unknown as SpotmatchRoomScreenState;
  const command = (wrongSide?: 'central' | 'own') => {
    const round = state.round!;
    const top = round.players[0]!.top!;
    const source = wrongSide === 'central' ? round.central : top;
    const other = wrongSide === 'central' ? top : round.central;
    const symbolId = source.symbols.find(
      (symbol) => other.symbols.includes(symbol) === (wrongSide === undefined),
    )!;
    return {
      type: 'spotmatch.card.claim' as const,
      roundId: round.roundId,
      centralInstanceId: round.central.instanceId,
      topInstanceId: top.instanceId,
      symbolId,
    };
  };
  return { send, model, command, submit };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it.each([TESTIDS.spotmatchCentralCard, TESTIDS.spotmatchOwnCard])(
  'submits the same identity-bound match from %s with immediate single flight',
  (id) => {
    const game = fixture();
    render(<SpotmatchStageArea screen={game.model()} assetsReady assetError={false} />);
    expect(screen.getByRole('heading', { name: '桌面公共牌' })).toBeVisible();
    expect(screen.getByRole('heading', { name: '你的手牌' })).toBeVisible();
    const command = game.command();
    const button = within(screen.getByTestId(id)).getByTestId(
      TESTIDS.spotmatchSymbol(command.symbolId),
    );
    fireEvent.click(button);
    fireEvent.click(
      within(
        screen.getByTestId(
          id === TESTIDS.spotmatchOwnCard ? TESTIDS.spotmatchCentralCard : TESTIDS.spotmatchOwnCard,
        ),
      ).getByTestId(TESTIDS.spotmatchSymbol(command.symbolId)),
    );
    expect(game.submit).toHaveBeenCalledTimes(1);
    expect(game.submit.mock.calls[0]?.[1]).toEqual(command);
  },
);

it.each(['central', 'own'] as const)(
  'shows server-confirmed red feedback and disables both cards on a %s mistake',
  async (side) => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    const game = fixture();
    const wrong = game.command(side);
    game.send(wrong);
    render(<SpotmatchStageArea screen={game.model()} assetsReady assetError={false} />);
    expect(screen.getByRole('status')).toHaveTextContent('锁定 1 秒');
    const card = screen.getByTestId(
      side === 'central' ? TESTIDS.spotmatchCentralCard : TESTIDS.spotmatchOwnCard,
    );
    expect(within(card).getByTestId(TESTIDS.spotmatchSymbol(wrong.symbolId))).toHaveClass(
      'spotmatch-symbol--wrong',
    );
    expect(screen.getAllByRole('button').every((button) => button.hasAttribute('disabled'))).toBe(
      true,
    );
    await act(() => vi.advanceTimersByTime(1000));
    expect(screen.getAllByRole('button').every((button) => !button.hasAttribute('disabled'))).toBe(
      true,
    );
    expect(card.querySelector('.spotmatch-symbol--wrong')).toBeNull();
  },
);

it('refills the hand immediately while the previous hand flies and keeps the three-second input lock', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(1000);
  const game = fixture();
  const playedId = game.model().viewModel.ownTop?.instanceId;
  game.send(game.command());
  const nextId = game.model().viewModel.ownTop?.instanceId;
  expect(nextId).not.toBe(playedId);
  const view = render(<SpotmatchStageArea screen={game.model()} assetsReady assetError={false} />);
  const hand = screen.getByTestId(TESTIDS.spotmatchOwnCard);
  expect(hand).toHaveAttribute('data-instance-id', nextId);
  expect(hand.querySelector('.spotmatch-symbol--matched')).toBeNull();
  expect(view.container.querySelector('.spotmatch-played-card [data-instance-id]')).toHaveAttribute(
    'data-instance-id',
    playedId,
  );
  await act(() => vi.advanceTimersByTime(SPOTMATCH_SUCCESS_PAUSE_MS - 1));
  expect(hand).toHaveAttribute('data-instance-id', nextId);
  expect(screen.getAllByRole('button').every((button) => button.hasAttribute('disabled'))).toBe(
    true,
  );
  await act(() => vi.advanceTimersByTime(1));
  expect(hand).toHaveAttribute('data-instance-id', nextId);
  expect(screen.getAllByRole('button').every((button) => !button.hasAttribute('disabled'))).toBe(
    true,
  );
});

it('holds the winning match before results and expires by server time, not snapshot arrival', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(1000);
  const game = fixture();
  for (let index = 0; index < 5; index++)
    game.send(game.command(), 'host', 1000 + index * SPOTMATCH_SUCCESS_PAUSE_MS);
  vi.setSystemTime(1000 + 5 * SPOTMATCH_SUCCESS_PAUSE_MS - 400);
  render(<SpotmatchStageArea screen={game.model()} assetsReady assetError={false} />);
  expect(screen.getByRole('status')).toHaveTextContent('甲 出牌成功');
  expect(screen.queryByTestId(TESTIDS.spotmatchResult)).toBeNull();
  expect(
    screen.getByTestId(TESTIDS.spotmatchCentralCard).querySelector('.spotmatch-symbol--matched'),
  ).not.toBeNull();
  expect(screen.queryByTestId(TESTIDS.spotmatchOwnCard)).toBeNull();
  expect(screen.getByText('手牌已出完')).toHaveClass('spotmatch-card');
  await act(() => vi.advanceTimersByTime(399));
  expect(screen.queryByTestId(TESTIDS.spotmatchResult)).toBeNull();
  await act(() => vi.advanceTimersByTime(1));
  expect(screen.getByTestId(TESTIDS.spotmatchResult)).toHaveTextContent('甲 率先出完');
  const ranking = screen.getByRole('region', { name: '最终排名' });
  expect(within(ranking).getAllByRole('listitem')).toHaveLength(2);
  expect(within(ranking).getByText('甲 · 你')).toHaveAttribute('aria-current', 'true');
  expect(within(ranking).getByText('剩余 0 张')).toBeInTheDocument();
  expect(within(ranking).getByText('出对 5 · 误点 0')).toBeInTheDocument();
});

it('presents stale inline without a modal, keeps unexpected rejections on the default path', async () => {
  const game = fixture();
  render(<SpotmatchStageArea screen={game.model()} assetsReady assetError={false} />);
  fireEvent.click(
    within(screen.getByTestId(TESTIDS.spotmatchCentralCard)).getByTestId(
      TESTIDS.spotmatchSymbol(game.command().symbolId),
    ),
  );
  const options = game.submit.mock.calls[0]?.[2];
  await act(async () => {
    expect(options?.onRejection?.(SPOTMATCH_REASONS.stale, 'stale')).toBe(true);
  });
  expect(screen.getByRole('status')).toHaveTextContent('被抢先了，再找一次');
  expect(options?.onRejection?.('forbidden', '权限不足')).toBe(false);
  expect(screen.queryByRole('dialog')).toBeNull();
});

it.each(['central', 'own'] as const)(
  'blocks repeat clicks for a full second after a confirmed %s mistake before its snapshot arrives',
  async (side) => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    const game = fixture();
    game.submit.mockImplementation(async (_label, _command, options) => {
      options?.onRejection?.(SPOTMATCH_REASONS.wrong, '没有匹配');
      return false;
    });
    const view = render(
      <SpotmatchStageArea screen={game.model()} assetsReady assetError={false} />,
    );
    const wrong = game.command(side);
    const card = screen.getByTestId(
      side === 'central' ? TESTIDS.spotmatchCentralCard : TESTIDS.spotmatchOwnCard,
    );
    fireEvent.click(within(card).getByTestId(TESTIDS.spotmatchSymbol(wrong.symbolId)));
    await game.submit.mock.results[0]?.value;
    const targets = screen.getAllByRole('button');
    expect(targets.every((button) => button.hasAttribute('disabled'))).toBe(true);
    expect(within(card).getByTestId(TESTIDS.spotmatchSymbol(wrong.symbolId))).toHaveClass(
      'spotmatch-symbol--wrong',
    );
    targets.forEach((button) => fireEvent.click(button));
    expect(game.submit).toHaveBeenCalledTimes(1);
    await act(() => vi.advanceTimersByTime(999));
    expect(targets.every((button) => button.hasAttribute('disabled'))).toBe(true);
    const model = game.model();
    view.rerender(
      <SpotmatchStageArea
        screen={{
          ...model,
          effectiveSeat: 1,
          controlledSeat: 1,
          viewModel: getSpotmatchViewModel(model.state, 1),
        }}
        assetsReady
        assetError={false}
      />,
    );
    expect(screen.getAllByRole('button').every((button) => !button.hasAttribute('disabled'))).toBe(
      true,
    );
    view.rerender(<SpotmatchStageArea screen={model} assetsReady assetError={false} />);
    expect(screen.getAllByRole('button').every((button) => button.hasAttribute('disabled'))).toBe(
      true,
    );
    await act(() => vi.advanceTimersByTime(1));
    expect(screen.getAllByRole('button').every((button) => !button.hasAttribute('disabled'))).toBe(
      true,
    );
  },
);

it('keeps network feedback out of the game status area and disables both cards offline', () => {
  const game = fixture();
  const model = game.model();
  render(
    <SpotmatchStageArea
      screen={{
        ...model,
        shellModel: {
          ...model.shellModel,
          connection: {
            ...model.shellModel.connection,
            status: { kind: 'offline' },
          },
        } as unknown as SpotmatchRoomScreenState['shellModel'],
      }}
      assetsReady
      assetError={false}
    />,
  );
  expect(screen.getByRole('status')).toHaveTextContent('找到同一个图案');
  expect(screen.getByRole('status')).not.toHaveTextContent('网络');
  expect(screen.getAllByRole('button').every((button) => button.hasAttribute('disabled'))).toBe(
    true,
  );
});

it('does not make the public card interactive for a spectator', () => {
  const game = fixture();
  const model = game.model();
  render(
    <SpotmatchStageArea
      screen={{
        ...model,
        effectiveSeat: null,
        viewModel: getSpotmatchViewModel(model.state, null),
      }}
      assetsReady
      assetError={false}
    />,
  );
  expect(screen.queryAllByRole('button')).toHaveLength(0);
});

it('disables both symbol cards while a submission is pending', () => {
  const game = fixture();
  render(
    <SpotmatchStageArea screen={game.model(undefined, true)} assetsReady assetError={false} />,
  );
  expect(screen.getAllByRole('button')).toHaveLength(16);
  expect(screen.getAllByRole('button').every((button) => button.hasAttribute('disabled'))).toBe(
    true,
  );
});

it('joins the server pause partway through and cancels the flight without replaying on snapshots', () => {
  vi.useFakeTimers();
  vi.setSystemTime(1000);
  const game = fixture();
  game.send(game.command());
  vi.setSystemTime(1600);
  const view = render(<SpotmatchStageArea screen={game.model()} assetsReady assetError={false} />);
  expect(animate).toHaveBeenCalledTimes(3);
  const flight = animations[0];
  expect(flight?.currentTime).toBe(600);
  const effect = view.container.querySelector('.spotmatch-played-card');
  expect(effect).toHaveAttribute('aria-hidden', 'true');
  expect(effect?.querySelectorAll('button')).toHaveLength(0);
  expect(effect?.querySelector('[data-instance-id]')).toHaveAttribute(
    'data-instance-id',
    game.model().viewModel.central?.instanceId,
  );
  view.rerender(<SpotmatchStageArea screen={game.model()} assetsReady assetError={false} />);
  expect(animate).toHaveBeenCalledTimes(3);
  view.unmount();
  expect(flight?.cancel).toHaveBeenCalledTimes(1);
});

it('holds the landed flight opaque and preserves every symbol through the static-card handoff', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(1000);
  const game = fixture();
  game.send(game.command());
  const view = render(<SpotmatchStageArea screen={game.model()} assetsReady assetError={false} />);
  const flyingCard = view.container.querySelector('.spotmatch-played-card .spotmatch-card');
  if (flyingCard === null) throw new Error('Expected the played card in flight');
  const profile = (card: Element) =>
    [...card.querySelectorAll('.spotmatch-symbol')].map((symbol) => ({
      id: symbol.getAttribute('data-symbol-id'),
      position: symbol.getAttribute('style'),
      art: symbol.querySelector('img')?.getAttribute('style'),
      source: symbol.querySelector('img')?.getAttribute('src'),
    }));
  const playedLayout = profile(flyingCard);
  const frames = animate.mock.calls[0]?.[0];
  if (!Array.isArray(frames)) throw new Error('Expected flight keyframes');
  expect(frames.at(-1)).toMatchObject({ opacity: 1 });
  await act(() => vi.advanceTimersByTime(SPOTMATCH_SUCCESS_PAUSE_MS));
  expect(view.container.querySelector('.spotmatch-played-card')).toBeNull();
  expect(profile(screen.getByTestId(TESTIDS.spotmatchCentralCard))).toEqual(playedLayout);
});

it('keeps the authoritative feedback and unlock time without flying cards for reduced motion', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(1000);
  vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
    matches: true,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: () => false,
  }));
  const game = fixture();
  game.send(game.command());
  const view = render(<SpotmatchStageArea screen={game.model()} assetsReady assetError={false} />);
  expect(screen.getByRole('status')).toHaveTextContent('甲 出牌成功');
  expect(view.container.querySelector('.spotmatch-played-card')).toBeNull();
  expect(animate).not.toHaveBeenCalled();
  await act(() => vi.advanceTimersByTime(2999));
  expect(screen.getAllByRole('button').every((button) => button.hasAttribute('disabled'))).toBe(
    true,
  );
  await act(() => vi.advanceTimersByTime(1));
  expect(screen.getByRole('status')).toHaveTextContent('找到同一个图案');
  expect(screen.getAllByRole('button').every((button) => !button.hasAttribute('disabled'))).toBe(
    true,
  );
});
