import { getSecrethitlerViewModel } from '@game-judge/game-engine/games/secrethitler/public';
import { fireEvent, render, screen, within } from '@testing-library/react';

import {
  buildSecrethitlerPhaseStates,
  completeSecrethitlerTestVote,
  sendSecrethitlerSeatCommand,
} from '@/test-utils/secrethitlerState';

import { SecrethitlerMatchDetails } from '../SecrethitlerHistory';
import { SecrethitlerRoomTracks } from '../SecrethitlerRoomTracks';

const states = buildSecrethitlerPhaseStates();

it('omits the recent result from the record while retaining it on room tracks', () => {
  const fixture = states.get('election');
  if (fixture === undefined) throw new Error('Missing election');
  const state = { ...fixture, lastPublicResult: { kind: 'veto', approved: true } } as const;
  const view = getSecrethitlerViewModel(state, null);
  const { unmount } = render(<SecrethitlerMatchDetails state={state} view={view} mySeat={null} />);
  expect(screen.queryByText(/最近结果/)).not.toBeInTheDocument();
  unmount();
  render(<SecrethitlerRoomTracks state={state} view={view} />);
  expect(screen.getByText('最近结果 · 总统同意否决')).toBeInTheDocument();
});

it('shows passed public votes with counts and individual ballots', () => {
  const state = states.get('legislativePresident');
  if (state === undefined || state.phase.kind !== 'legislativePresident')
    throw new Error('Missing president phase');
  render(
    <SecrethitlerMatchDetails
      state={state}
      view={getSecrethitlerViewModel(state, state.phase.presidentSeat)}
      mySeat={state.phase.presidentSeat}
    />,
  );
  expect(screen.getByText('通过')).toBeInTheDocument();
  expect(screen.getByText(/赞成 8 · 反对 0/)).toBeInTheDocument();
  expect(
    within(screen.getByRole('list', { name: '逐人投票' })).getAllByRole('listitem'),
  ).toHaveLength(8);
});

it('shows rejected secret votes as counts without individual ballots', () => {
  let state = states.get('election');
  if (state === undefined || state.phase.kind !== 'election') throw new Error('Missing election');
  const view = getSecrethitlerViewModel(state, state.phase.presidentSeat);
  const chancellor = view.eligibleChancellorSeats[0];
  if (chancellor === undefined) throw new Error('Missing chancellor');
  const presidentSeat = state.phase.presidentSeat;
  state = { ...state, config: { ...state.config, voteMode: 'secret' } };
  state = sendSecrethitlerSeatCommand(state, presidentSeat, {
    type: 'secrethitler.government.preselect',
    chancellorSeatId: chancellor,
  });
  if (state.phase.kind !== 'election') throw new Error('Expected election after preselection');
  state = sendSecrethitlerSeatCommand(state, state.phase.presidentSeat, {
    type: 'secrethitler.government.nominate',
    chancellorSeatId: chancellor,
  });
  for (const seat of state.livingSeats)
    state = sendSecrethitlerSeatCommand(state, seat, {
      type: 'secrethitler.government.castVote',
      vote: 'nein',
    });
  state = completeSecrethitlerTestVote(state);
  render(
    <SecrethitlerMatchDetails state={state} view={getSecrethitlerViewModel(state, 0)} mySeat={0} />,
  );
  expect(screen.getByText('未通过')).toBeInTheDocument();
  expect(screen.getByText('赞成 0 · 反对 8')).toBeInTheDocument();
  expect(screen.getByText('暗投模式不公布逐人票')).toBeInTheDocument();
  expect(screen.queryByRole('list', { name: '逐人投票' })).not.toBeInTheDocument();
});

it('shows only submission progress during an active vote, never the viewer’s own ballot', () => {
  const fixture = states.get('voting');
  if (fixture === undefined || fixture.phase.kind !== 'voting') throw new Error('Missing voting');
  const state = {
    ...fixture,
    phase: { ...fixture.phase, votes: { 0: 'ja', 1: 'nein' } },
  } as const;
  const { rerender } = render(
    <SecrethitlerMatchDetails state={state} view={getSecrethitlerViewModel(state, 0)} mySeat={0} />,
  );
  expect(screen.getByText('已投 2/8')).toBeInTheDocument();
  expect(screen.getByText('未投票：3号 4号 5号 6号 7号 8号')).toBeInTheDocument();
  // Seat 1 voted ja: the ballot stays in the vote dialog, as in Avalon.
  expect(screen.queryByText(/你投了/)).not.toBeInTheDocument();
  expect(screen.queryByText(/赞成|反对/)).not.toBeInTheDocument();
  expect(screen.queryByRole('list', { name: '逐人投票' })).not.toBeInTheDocument();
  rerender(
    <SecrethitlerMatchDetails state={state} view={getSecrethitlerViewModel(state, 2)} mySeat={2} />,
  );
  expect(screen.getByText('已投 2/8')).toBeInTheDocument();
  expect(screen.queryByText(/你投了/)).not.toBeInTheDocument();
  const complete = {
    ...state,
    phase: {
      ...state.phase,
      votes: { 0: 'ja', 1: 'nein', 2: 'ja', 3: 'ja', 4: 'ja', 5: 'ja', 6: 'ja', 7: 'ja' },
    },
  } as const;
  rerender(
    <SecrethitlerMatchDetails
      state={complete}
      view={getSecrethitlerViewModel(complete, null)}
      mySeat={null}
    />,
  );
  expect(screen.getByText('等待揭晓')).toBeInTheDocument();
  expect(screen.queryByText(/未投票：/)).not.toBeInTheDocument();
  expect(screen.queryByRole('list', { name: '逐人投票' })).not.toBeInTheDocument();
});

it('switches between policy and president records without mixing their order', () => {
  const state = states.get('election');
  if (state === undefined) throw new Error('Missing election');
  const view = getSecrethitlerViewModel(state, null);
  const withRecords = {
    ...view,
    history: {
      ...view.history,
      policies: [
        { policy: 'liberal', source: 'government' },
        { policy: 'fascist', source: 'chaos' },
      ],
      actions: [{ action: 'investigate', presidentSeat: 0, targetSeat: 1 }],
    },
  } as const;
  render(<SecrethitlerMatchDetails state={state} view={withRecords} mySeat={null} />);
  fireEvent.click(screen.getByRole('button', { name: '政策记录' }));
  expect(screen.getByRole('button', { name: '政策记录' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByText('第 1 张 · 自由派政策')).toBeInTheDocument();
  expect(screen.getByText('第 2 张 · 法西斯政策')).toBeInTheDocument();
  expect(screen.getByText('三次失败自动施行')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '总统行动' }));
  expect(screen.getByRole('heading', { name: '调查阵营' })).toBeInTheDocument();
  expect(screen.getByText('总统 1 号 · 目标 2 号')).toBeInTheDocument();
  expect(screen.queryByText('第 1 张 · 自由派政策')).not.toBeInTheDocument();
});

it('shows an empty state for each record category before any government is formed', () => {
  const state = states.get('election');
  if (state === undefined) throw new Error('Missing election');
  render(
    <SecrethitlerMatchDetails
      state={state}
      view={getSecrethitlerViewModel(state, null)}
      mySeat={null}
    />,
  );
  expect(screen.getByText('暂无政府投票记录。')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '政策记录' }));
  expect(screen.getByText('暂无政策记录。')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '总统行动' }));
  expect(screen.getByText('暂无总统行动记录。')).toBeInTheDocument();
});
