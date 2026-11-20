import {
  getSecrethitlerViewModel,
  type SecrethitlerState,
} from '@game-judge/game-engine/games/secrethitler/public';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import {
  buildSecrethitlerPhaseStates,
  sendSecrethitlerSeatCommand,
} from '@/test-utils/secrethitlerState';
import { alertStore, dismissAlert } from '@/utils/alert';

import {
  secrethitlerPolicyFascistImage,
  secrethitlerPolicyLiberalImage,
} from '../../assets/secrethitlerPolicyImages';
import { SecrethitlerActionSheet } from '../SecrethitlerActionSheet';

const states = buildSecrethitlerPhaseStates();
function fixture(phase: SecrethitlerState['phase']['kind']) {
  const state = states.get(phase);
  if (state === undefined) throw new Error(`Missing ${phase}`);
  return state;
}

function props(state: SecrethitlerState, seat: number | null) {
  return {
    state,
    viewModel: getSecrethitlerViewModel(state, seat),
    controlledSeat: seat,
    submit: vi.fn(async () => true),
    closeAction: vi.fn(),
    isSubmitting: false,
  };
}

async function confirmAction() {
  const confirmation = alertStore.getSnapshot();
  expect(confirmation).not.toBeNull();
  await confirmation?.buttons.find((button) => button.text === '确定')?.onPress?.();
  if (confirmation !== null) dismissAlert(confirmation.generation);
}

it('keeps 7–10 player Hitler and spectators out of the private recognition sheet', async () => {
  let state = fixture('night');
  // The phase collector saves the opening night; advance to the recognition cue.
  const identities = Object.entries(state.identities);
  const hitler = identities.find(([, identity]) => identity === 'hitler');
  if (hitler === undefined) throw new Error('Missing Hitler');
  state = { ...state, phase: { kind: 'night', step: 1, confirmedSeats: [] } };
  const rendered = render(<SecrethitlerActionSheet screen={props(state, Number(hitler[0]))} />);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  rendered.rerender(<SecrethitlerActionSheet screen={props(state, null)} />);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  const fascist = identities.find(([, identity]) => identity === 'fascist');
  if (fascist === undefined) throw new Error('Missing fascist');
  const input = props(state, Number(fascist[0]));
  rendered.rerender(<SecrethitlerActionSheet screen={input} />);
  expect(screen.getByText(new RegExp(`${Number(hitler[0]) + 1} 号.*希特勒`))).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '确认信息' }));
  expect(input.submit).not.toHaveBeenCalled();
  await confirmAction();
  expect(input.submit).toHaveBeenCalledWith(
    '确认信息',
    { type: 'secrethitler.night.confirm', step: 1 },
    { controlledSeat: Number(fascist[0]) },
  );
});

it('shows hands only to their authorized office and submits the actual available policy', async () => {
  const state = fixture('legislativePresident');
  if (state.phase.kind !== 'legislativePresident') throw new Error('Expected hand');
  const input = props(state, state.phase.presidentSeat);
  const rendered = render(<SecrethitlerActionSheet screen={input} />);
  const policy = state.phase.hand[0];
  if (policy === undefined) throw new Error('Missing policy');
  const label = `弃置${policy === 'liberal' ? '自由派' : '法西斯'}政策`;
  // Duplicate policies share the label, so address the first card by its indexed testid.
  fireEvent.click(screen.getByTestId(`secrethitler-policy-discard-${policy}-0`));
  expect(input.submit).toHaveBeenCalledWith(
    label,
    { type: 'secrethitler.policy.presidentDiscard', policy },
    { controlledSeat: state.phase.presidentSeat },
  );
  await waitFor(() => expect(input.closeAction).toHaveBeenCalled());
  rendered.rerender(<SecrethitlerActionSheet screen={props(state, state.phase.chancellorSeat)} />);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('keeps a failed secret ballot submission open for retry', async () => {
  const state = fixture('voting');
  const input = props(state, 1);
  input.submit.mockResolvedValue(false);
  render(<SecrethitlerActionSheet screen={input} />);
  fireEvent.click(screen.getByRole('button', { name: '反对' }));
  await waitFor(() => expect(input.submit).toHaveBeenCalled());
  expect(input.closeAction).not.toHaveBeenCalled();
});

it('submits a vote directly and closes after success', async () => {
  const state = fixture('voting');
  const input = props(state, 1);
  render(<SecrethitlerActionSheet screen={input} />);
  fireEvent.click(screen.getByTestId('secrethitler-vote-yes'));
  expect(input.submit).toHaveBeenCalledWith(
    '赞成',
    { type: 'secrethitler.government.castVote', vote: 'ja' },
    { controlledSeat: 1 },
  );
  await waitFor(() => expect(input.closeAction).toHaveBeenCalled());
});

it('renders vote choice cards with distinct images and no ballot selected yet', () => {
  const state = fixture('voting');
  render(<SecrethitlerActionSheet screen={props(state, 1)} />);
  const yes = screen.getByTestId('secrethitler-vote-yes');
  const no = screen.getByTestId('secrethitler-vote-no');
  expect(yes).toHaveAttribute('aria-pressed', 'false');
  expect(no).toHaveAttribute('aria-pressed', 'false');
  const yesSrc = yes.querySelector('img')?.getAttribute('src');
  const noSrc = no.querySelector('img')?.getAttribute('src');
  expect(yesSrc).toBeTruthy();
  expect(noSrc).toBeTruthy();
  expect(yesSrc).not.toBe(noSrc);
});

it('renders one policy card per policy in the hand, with the matching art and no selection state', () => {
  const state = fixture('legislativePresident');
  if (state.phase.kind !== 'legislativePresident') throw new Error('Expected hand');
  render(<SecrethitlerActionSheet screen={props(state, state.phase.presidentSeat)} />);
  // The sheet renders through a portal, so query the document, not the render container.
  const cards = [...document.querySelectorAll('.choice-card')];
  const hand = state.phase.hand;
  expect(cards).toHaveLength(hand.length);
  cards.forEach((card, index) => {
    const policy = hand[index];
    if (policy === undefined) throw new Error('Missing policy');
    expect(card).not.toHaveAttribute('aria-pressed');
    expect(card.querySelector('img')?.getAttribute('src')).toBe(
      policy === 'liberal' ? secrethitlerPolicyLiberalImage : secrethitlerPolicyFascistImage,
    );
  });
});

it('maps each policy in a mixed hand to its own art', () => {
  const base = fixture('legislativePresident');
  if (base.phase.kind !== 'legislativePresident') throw new Error('Expected hand');
  const presidentSeat = base.phase.presidentSeat;
  // The deterministic fixture hand is all fascist, so override it to cover the liberal branch too.
  const state: SecrethitlerState = {
    ...base,
    phase: { ...base.phase, hand: ['liberal', 'fascist', 'liberal'] },
  };
  render(<SecrethitlerActionSheet screen={props(state, presidentSeat)} />);
  const cards = [...document.querySelectorAll('.choice-card')];
  expect(cards).toHaveLength(3);
  const expected = [
    secrethitlerPolicyLiberalImage,
    secrethitlerPolicyFascistImage,
    secrethitlerPolicyLiberalImage,
  ];
  cards.forEach((card, index) => {
    const src = expected[index];
    if (src === undefined) throw new Error('Missing expected art');
    expect(card.querySelector('img')?.getAttribute('src')).toBe(src);
  });
});

it('submits the chancellor enact command for the tapped policy card', async () => {
  const state = fixture('legislativeChancellor');
  if (state.phase.kind !== 'legislativeChancellor') throw new Error('Expected hand');
  const input = props(state, state.phase.chancellorSeat);
  render(<SecrethitlerActionSheet screen={input} />);
  const policy = state.phase.hand[0];
  if (policy === undefined) throw new Error('Missing policy');
  const label = `施行${policy === 'liberal' ? '自由派' : '法西斯'}政策`;
  fireEvent.click(screen.getByTestId(`secrethitler-policy-enact-${policy}-0`));
  expect(input.submit).toHaveBeenCalledWith(
    label,
    { type: 'secrethitler.policy.chancellorResolve', action: 'enact', policy },
    { controlledSeat: state.phase.chancellorSeat },
  );
  await waitFor(() => expect(input.closeAction).toHaveBeenCalled());
});

it('shows the cast ballot as selected and keeps the other card unselected', () => {
  let state = fixture('voting');
  state = sendSecrethitlerSeatCommand(state, 1, {
    type: 'secrethitler.government.castVote',
    vote: 'ja',
  });
  render(<SecrethitlerActionSheet screen={props(state, 1)} />);
  expect(screen.getByTestId('secrethitler-vote-yes')).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByTestId('secrethitler-vote-no')).toHaveAttribute('aria-pressed', 'false');
});
