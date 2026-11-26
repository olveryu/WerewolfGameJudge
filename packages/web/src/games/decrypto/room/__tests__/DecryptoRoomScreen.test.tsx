import {
  type DecryptoCommand,
  decryptoEngine,
  type DecryptoState,
  getDecryptoViewModel,
} from '@game-judge/game-engine/games/decrypto/public';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';

import type { DecryptoRoomSession } from '@/games/decrypto/model/DecryptoRoomSession';
import {
  buildDecryptoTestLobby,
  driveDecryptoTestCommand,
  endDecryptoTestGame,
  prepareDecryptoTestGame,
  startDecryptoTestGame,
} from '@/test-utils/decryptoState';

import { decryptoReview } from '../../review/decryptoReview';
import { DecryptoHistory } from '../DecryptoHistory';
import { DecryptoRoomScreen } from '../DecryptoRoomScreen';

let state: DecryptoState = buildDecryptoTestLobby();
let viewerSeat: number | null = 0;
let controlledSeat: number | null = null;
let isTakeoverLoading = false;
const submit = vi.fn();
const dispatch = vi.fn(async () => {
  throw new Error('Public preview must not submit commands');
});
const session: DecryptoRoomSession = {
  getSnapshot: () => {
    throw new Error('Screen fixture does not connect');
  },
  subscribe: () => () => undefined,
  connect: vi.fn(async () => undefined),
  dispatch,
  retryNow: vi.fn(),
  close: vi.fn(),
};
const showModalDescriptor = Object.getOwnPropertyDescriptor(
  HTMLDialogElement.prototype,
  'showModal',
);
const closeDialogDescriptor = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');

beforeEach(() => {
  state = buildDecryptoTestLobby();
  viewerSeat = 0;
  controlledSeat = null;
  isTakeoverLoading = false;
  submit.mockClear();
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.setAttribute('open', '');
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.removeAttribute('open');
    },
  });
});

afterEach(() => {
  cleanup();
  if (showModalDescriptor === undefined)
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  else Object.defineProperty(HTMLDialogElement.prototype, 'showModal', showModalDescriptor);
  if (closeDialogDescriptor === undefined)
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
  else Object.defineProperty(HTMLDialogElement.prototype, 'close', closeDialogDescriptor);
});

vi.mock('@/features/room/components/RoomEntryBoundary', () => ({
  RoomEntryBoundary: ({ children }: { children: (entry: null) => ReactNode }) => children(null),
}));
vi.mock('@/features/room/components/RoomShell', () => ({
  RoomShell: ({
    content,
    gameOverlays,
    directory,
    actionSurface = 'hand',
    phaseLabel,
    lobbyAction,
  }: {
    content: {
      kind: string;
      beforeSeatBoard?: ReactNode;
      bottomSummary?: ReactNode;
      element?: ReactNode;
    };
    gameOverlays: ReactNode;
    directory: {
      manual: readonly { label: string; state: { kind: 'ready'; onPress: () => void } }[];
      openConfiguration: (() => void) | null;
    };
    actionSurface?: 'hand' | 'menu' | 'hidden';
    phaseLabel: string | null;
    lobbyAction: { label: string; occupiedSeats: number } | null;
  }) => (
    <section aria-label="房间内容" data-kind={content.kind} data-action-surface={actionSurface}>
      {phaseLabel && <span data-testid="phase-label">{phaseLabel}</span>}
      {lobbyAction && (
        <span data-testid="lobby-action">{`${lobbyAction.label} · ${lobbyAction.occupiedSeats}`}</span>
      )}
      {content.beforeSeatBoard}
      {content.bottomSummary}
      {content.element}
      {directory.manual.map((entry) => (
        <button key={entry.label} onClick={entry.state.onPress}>
          {entry.label}
        </button>
      ))}
      {directory.openConfiguration && (
        <button onClick={directory.openConfiguration}>本局配置</button>
      )}
      {actionSurface === 'menu' && (
        <button onClick={directory.manual[0]?.state.onPress}>舞台玩法</button>
      )}
      {actionSurface === 'menu' && directory.openConfiguration && (
        <button onClick={directory.openConfiguration}>舞台配置</button>
      )}
      {gameOverlays}
    </section>
  ),
}));
vi.mock('../hooks/useDecryptoRoomState', () => ({
  useDecryptoRoomState: () => ({
    state,
    viewModel: getDecryptoViewModel(state, viewerSeat, controlledSeat === null),
    shellModel: null,
    reviewOverlay: null,
    roleCardAllRoles: [],
    roleViewing: { isOpen: false, close: vi.fn(), shouldPlayAnimation: false, remainingCards: 4 },
    remainingSeconds: null,
    isOverdue: false,
    isHost: true,
    isSubmitting: false,
    mySeat: 0,
    effectiveSeat: viewerSeat,
    controlledSeat,
    isTakeoverLoading,
    hasTakeoverError: false,
    retryTakeover: vi.fn(),
    submit,
  }),
}));

function roomElement() {
  return (
    <MemoryRouter>
      <DecryptoRoomScreen
        room={{
          roomCode: '1234',
          roomId: 'room-1234',
          gameType: 'decrypto',
          hostUserId: 'host',
          createdAt: new Date(0),
        }}
        entryReason={null}
        onOpenMusicSettings={() => {}}
        onOpenRoomSettings={() => {}}
        onOpenUserSettings={() => {}}
        session={session}
        review={decryptoReview}
      />
    </MemoryRouter>
  );
}

function renderRoom() {
  return render(roomElement());
}

it('provides the lobby status and action to the room shell', () => {
  state = buildDecryptoTestLobby();
  renderRoom();
  expect(screen.getByTestId('phase-label')).toHaveTextContent('待开局');
  expect(screen.getByTestId('lobby-action')).toHaveTextContent('开始游戏 · 4');
});

it('keeps team setup modal and lets the host move teams in rotating mode', async () => {
  const lobby = buildDecryptoTestLobby(6);
  state = startDecryptoTestGame(lobby);
  const view = renderRoom();

  const dialog = screen.getByRole('dialog', { name: '确认分队与出题人' });
  expect(dialog).toHaveAttribute('open');
  expect(screen.getAllByRole('button', { name: /移到另一队/ })[0]).toBeEnabled();

  const cancelEvent = new Event('cancel', { cancelable: true });
  fireEvent(dialog, cancelEvent);
  expect(cancelEvent.defaultPrevented).toBe(true);
  expect(dialog).toHaveAttribute('open');
  expect(screen.getByRole('status')).toHaveTextContent('请完成分队后继续。');

  if (state.phase.kind !== 'teams') throw new Error('Expected team setup');
  const blueSeat = Object.entries(state.phase.assignments).find(([, team]) => team === 'blue')?.[0];
  if (blueSeat === undefined) throw new Error('Missing blue team member');
  state = driveDecryptoTestCommand(state, {
    type: 'decrypto.teams.move',
    seat: Number(blueSeat),
  });
  view.unmount();
  renderRoom();
  expect(screen.getByRole('status')).toHaveTextContent('两队人数不均，仍可继续。');
  expect(screen.getByRole('button', { name: '确认分队' })).toBeEnabled();
});

it('opens the same guide in the room without navigating', async () => {
  const user = userEvent.setup();
  state = buildDecryptoTestLobby();
  renderRoom();
  await user.click(screen.getByRole('button', { name: '玩法' }));
  expect(screen.getByRole('dialog', { name: '解码战玩法' })).toBeInTheDocument();
  expect(screen.getByText(/4–8 人分成两队/)).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '关闭详情' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '玩法' }));
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('explains the minimum team size when a blocked move is tapped instead of submitting', async () => {
  const user = userEvent.setup();
  state = startDecryptoTestGame(buildDecryptoTestLobby());
  renderRoom();
  expect(screen.getByText('每队至少 2 人')).toBeVisible();
  const moveButton = screen.getAllByRole('button', { name: /移到另一队/ })[0];
  if (moveButton === undefined) throw new Error('Missing move button');
  expect(moveButton).toHaveAttribute('aria-disabled', 'true');
  await user.click(moveButton);
  expect(screen.getByRole('status')).toHaveTextContent('本队至少保留 2 人，不能再移出。');
  expect(submit).not.toHaveBeenCalled();
});

it('offers the stage menu while playing and the bottom configuration after ending', async () => {
  const user = userEvent.setup();
  const lobby = buildDecryptoTestLobby();
  state = prepareDecryptoTestGame(startDecryptoTestGame(lobby));
  const view = renderRoom();
  expect(screen.getByRole('region', { name: '房间内容' })).toHaveAttribute('data-kind', 'stage');
  await user.click(screen.getByRole('button', { name: '舞台配置' }));
  expect(screen.getByRole('dialog', { name: '本局配置' })).toHaveTextContent('解码战');
  await user.click(screen.getByRole('button', { name: '关闭详情' }));
  await user.click(screen.getByRole('button', { name: '舞台玩法' }));
  expect(screen.getByRole('dialog', { name: '解码战玩法' })).toBeInTheDocument();
  state = endDecryptoTestGame(state);
  view.unmount();
  renderRoom();
  expect(screen.queryByRole('button', { name: '舞台玩法' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '本局配置' })).toBeInTheDocument();
});

it('switches between the numbered clue archive and a single selected round', async () => {
  const user = userEvent.setup();
  state = endDecryptoTestGame(startDecryptoTestGame(buildDecryptoTestLobby()));
  renderRoom();
  await user.click(screen.getByRole('tab', { name: '往轮记录' }));
  expect(screen.getByRole('group', { name: '选择查看轮次' })).toBeInTheDocument();
  expect(screen.getByRole('table', { name: /第 2 轮/ })).toBeInTheDocument();
  expect(screen.getAllByRole('row')).toHaveLength(4);
  await user.click(screen.getByRole('button', { name: '第 1 轮' }));
  expect(screen.getByRole('table', { name: /第 1 轮/ })).toBeInTheDocument();
  expect(screen.getAllByRole('table')).toHaveLength(1);
  await user.click(screen.getByRole('tab', { name: '历史线索' }));
  expect(screen.getByRole('heading', { name: '1号线索' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '4号线索' })).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByRole('table')).not.toBeInTheDocument());
});

it('selects fixed encryptors from the team dropdowns without radios in the member rows', async () => {
  const user = userEvent.setup();
  const lobby = buildDecryptoTestLobby();
  state = startDecryptoTestGame({ ...lobby, config: { ...lobby.config, encryptorMode: 'fixed' } });
  renderRoom();
  if (state.phase.kind !== 'teams') throw new Error('Expected team setup');
  const blueSeat = Object.entries(state.phase.assignments).find(([, team]) => team === 'blue')?.[0];
  if (blueSeat === undefined) throw new Error('Missing blue team member');
  const select = screen.getByRole('combobox', { name: '蓝队出题人' });
  expect(screen.getAllByRole('combobox')).toHaveLength(2);
  expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  await user.selectOptions(select, blueSeat);
  expect(submit).toHaveBeenCalledWith(
    '选择出题人',
    { type: 'decrypto.teams.encryptor', team: 'blue', seat: Number(blueSeat) },
    { actionKey: 'encryptor:blue' },
  );
});

it('allows a long player name to be expanded by touch or keyboard without repeating bot numbers', async () => {
  const user = userEvent.setup();
  const lobby = buildDecryptoTestLobby();
  const player = lobby.roster[0];
  if (player === null || player === undefined || !('userId' in player))
    throw new Error('Expected a human host');
  const displayName = '这是一个用于查看完整显示效果的很长名字';
  state = startDecryptoTestGame({
    ...lobby,
    roster: { ...lobby.roster, 0: { ...player, profile: { ...player.profile, displayName } } },
  });
  renderRoom();
  const nameButton = screen.getByRole('button', { name: `1号 · ${displayName}，查看完整名字` });
  const fullName = screen.getByText(`1号 · ${displayName}`);
  expect(fullName).not.toBeVisible();
  await user.click(nameButton);
  expect(nameButton).toHaveAttribute('aria-expanded', 'true');
  expect(fullName).toBeVisible();
  await user.keyboard('{Enter}');
  expect(fullName).not.toBeVisible();
  expect(screen.getAllByText('机器人', { selector: '.decrypto-player-name' })).toHaveLength(2);
});

it('keeps eight rounds behind number buttons instead of stacking eight tables', async () => {
  const user = userEvent.setup();
  const ended = endDecryptoTestGame(startDecryptoTestGame(buildDecryptoTestLobby()));
  if (ended.phase.kind !== 'ended') throw new Error('Expected ended fixture');
  const entry = ended.phase.game.history.blue[0];
  if (entry === undefined) throw new Error('Missing history fixture');
  render(
    <DecryptoHistory
      entries={Array.from({ length: 8 }, (_, index) => ({ ...entry, round: index + 1 }))}
      isOwnTeam
    />,
  );
  await user.click(screen.getByRole('tab', { name: '往轮记录' }));
  expect(
    within(screen.getByRole('group', { name: '选择查看轮次' })).getAllByRole('button'),
  ).toHaveLength(8);
  expect(screen.getAllByRole('table')).toHaveLength(1);
  expect(screen.getByRole('table', { name: /第 8 轮/ })).toBeVisible();
  await user.click(screen.getByRole('button', { name: '第 1 轮' }));
  expect(screen.getAllByRole('table')).toHaveLength(1);
  expect(screen.getByRole('table', { name: /第 1 轮/ })).toBeVisible();
});

function commandAsSeat(seat: number, command: DecryptoCommand) {
  const player = state.roster[seat];
  if (player === undefined || player === null) throw new Error('Missing fixture player');
  state =
    'userId' in player
      ? driveDecryptoTestCommand(state, command, player.userId)
      : driveDecryptoTestCommand(state, command, 'host', { controlledSeat: seat });
}

it('submits the bot encryptor clues with its controlled seat and clears drafts when changing seats', async () => {
  const user = userEvent.setup();
  state = prepareDecryptoTestGame(startDecryptoTestGame(buildDecryptoTestLobby(6)));
  if (state.phase.kind !== 'playing') throw new Error('Expected gameplay');
  const botEncryptor = Object.values(state.phase.game.encryptors ?? {}).find((seat) => seat > 1);
  if (botEncryptor === undefined) throw new Error('Expected a bot encryptor');
  viewerSeat = botEncryptor;
  controlledSeat = botEncryptor;
  const view = renderRoom();
  expect(screen.getByRole('group', { name: /^本轮密码：/ })).toHaveTextContent(
    state.phase.game.codes[state.phase.game.assignments[botEncryptor]!].join(''),
  );
  const inputs = screen.getAllByRole('textbox');
  for (const [index, input] of inputs.entries()) await user.type(input, `线索${index + 1}`);
  await user.click(screen.getByRole('button', { name: '提交线索' }));
  expect(submit).toHaveBeenCalledWith(
    '提交线索',
    { type: 'decrypto.clues.submit', clues: ['线索1', '线索2', '线索3'] },
    { controlledSeat: botEncryptor, actionKey: 'clues-submit' },
  );
  const game = state.phase.game;
  const botDecoder = Object.entries(game.assignments).find(
    ([seat, team]) => Number(seat) > 1 && Number(seat) !== game.encryptors?.[team],
  );
  if (botDecoder === undefined) throw new Error('Expected a bot decoder');
  viewerSeat = Number(botDecoder[0]);
  controlledSeat = viewerSeat;
  view.rerender(roomElement());
  expect(screen.queryByDisplayValue('线索1')).not.toBeInTheDocument();
  expect(screen.queryByRole('group', { name: /^本轮密码：/ })).not.toBeInTheDocument();
});

function advanceReveal() {
  if (state.phase.kind !== 'playing') throw new Error('Expected reveal');
  const game = state.phase.game;
  if (game.step !== 'reveal' || game.activeTeam === null || game.revealAt === null)
    throw new Error('Expected active reveal timer');
  const decision = decryptoEngine.decide(
    state,
    {
      type: 'decrypto.reveal.advance',
      gameSequence: state.gameSequence,
      round: game.round,
      team: game.activeTeam,
      revealIndex: game.revealIndex,
      revealAt: game.revealAt,
    },
    {
      actor: { kind: 'system', effectId: 'test-reveal' },
      controlledSeat: null,
      commandId: `reveal-${game.revealIndex}`,
      nowMs: game.revealAt,
      randomSeed: 'test-reveal',
    },
  );
  if (decision.kind === 'reject') throw new Error(`Reveal rejected: ${decision.reason}`);
  state = decision.events.reduce(decryptoEngine.evolve, state);
}

it.each([false, true])(
  'reveals public results sequentially, skipping first-round interception, while takeover refresh is %s',
  (loading) => {
    state = prepareDecryptoTestGame(startDecryptoTestGame(buildDecryptoTestLobby()));
    viewerSeat = 2;
    controlledSeat = 2;
    isTakeoverLoading = loading;
    for (const round of [1, 2]) {
      if (state.phase.kind !== 'playing' || state.phase.game.encryptors === null)
        throw new Error('Expected a playing round');
      const game = state.phase.game;
      for (const team of ['blue', 'purple'] as const) {
        const encryptor = game.encryptors?.[team];
        if (encryptor === undefined) throw new Error('Missing encryptor');
        commandAsSeat(encryptor, { type: 'decrypto.clues.submit', clues: ['甲', '乙', '丙'] });
      }
      for (const team of ['blue', 'purple'] as const) {
        const decoder = Object.entries(game.assignments).find(
          ([seat, assignedTeam]) =>
            assignedTeam === team && Number(seat) !== game.encryptors?.[team],
        );
        if (decoder === undefined) throw new Error('Missing decoder');
        commandAsSeat(Number(decoder[0]), {
          type: 'decrypto.guess.submit',
          kind: 'decode',
          guess: game.codes[team],
        });
        if (round > 1)
          commandAsSeat(Number(decoder[0]), {
            type: 'decrypto.guess.submit',
            kind: 'intercept',
            guess: game.codes[team === 'blue' ? 'purple' : 'blue'],
          });
      }
      const view = renderRoom();
      const visibleBoard = within(screen.getByRole('tabpanel', { name: /^蓝队记录/ }));
      expect(visibleBoard.queryByRole('group', { name: /^正确密码：/ })).not.toBeInTheDocument();
      if (round > 1) {
        expect(visibleBoard.getByRole('group', { name: /^拦截答案：/ })).toBeVisible();
        expect(visibleBoard.queryByRole('group', { name: /^解码答案：/ })).not.toBeInTheDocument();
        advanceReveal();
        view.rerender(roomElement());
      } else {
        expect(visibleBoard.queryByRole('group', { name: /^拦截答案：/ })).not.toBeInTheDocument();
      }
      expect(visibleBoard.getByRole('group', { name: /^解码答案：/ })).toBeVisible();
      expect(visibleBoard.queryByRole('group', { name: /^正确密码：/ })).not.toBeInTheDocument();
      advanceReveal();
      view.rerender(roomElement());
      expect(visibleBoard.getByRole('group', { name: /^正确密码：/ })).toHaveTextContent(
        game.codes.blue.join(''),
      );
      view.unmount();
      while (state.phase.kind === 'playing' && state.phase.game.step === 'reveal') advanceReveal();
      if (round === 1)
        state = driveDecryptoTestCommand(state, {
          type: 'decrypto.reveal.continue',
          gameSequence: state.gameSequence,
        });
    }
  },
);

it('chooses numbers per clue, swaps duplicates and submits the controlled decoder seat', async () => {
  const user = userEvent.setup();
  state = prepareDecryptoTestGame(startDecryptoTestGame(buildDecryptoTestLobby(6)));
  if (state.phase.kind !== 'playing' || state.phase.game.encryptors === null)
    throw new Error('Expected gameplay');
  const game = state.phase.game;
  for (const team of ['blue', 'purple'] as const) {
    const encryptor = game.encryptors?.[team];
    if (encryptor === undefined) throw new Error('Missing encryptor');
    commandAsSeat(encryptor, {
      type: 'decrypto.clues.submit',
      clues: [`${team}甲`, `${team}乙`, `${team}丙`],
    });
  }
  const botDecoder = Object.entries(game.assignments).find(
    ([seat, team]) => Number(seat) > 1 && Number(seat) !== game.encryptors?.[team],
  );
  if (botDecoder === undefined) throw new Error('Expected a bot decoder');
  viewerSeat = Number(botDecoder[0]);
  controlledSeat = viewerSeat;
  renderRoom();
  const chooseNumber = async (position: number, number: number) => {
    await user.click(screen.getByRole('button', { name: new RegExp(`第${position}条线索`) }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: `${number} 号` }),
    );
  };
  await chooseNumber(1, 1);
  await chooseNumber(2, 2);
  await chooseNumber(1, 2);
  await chooseNumber(3, 3);
  await user.click(screen.getByRole('button', { name: '提交解码' }));
  expect(submit).toHaveBeenCalledWith(
    '提交解码',
    { type: 'decrypto.guess.submit', kind: 'decode', guess: [2, 1, 3] },
    { controlledSeat, actionKey: 'guess:decode' },
  );
});
