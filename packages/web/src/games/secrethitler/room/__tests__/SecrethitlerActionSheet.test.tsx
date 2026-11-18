import {
  getSecrethitlerViewModel,
  type SecrethitlerState,
} from '@game-judge/game-engine/games/secrethitler/public';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { buildSecrethitlerPhaseStates } from '@/test-utils/secrethitlerState';

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

it('keeps 7–10 player Hitler and spectators out of the private recognition sheet', () => {
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
  fireEvent.click(screen.getByRole('button', { name: label }));
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

it('renders one policy card per distinct policy in the hand', () => {
  const state = fixture('legislativePresident');
  if (state.phase.kind !== 'legislativePresident') throw new Error('Expected hand');
  render(<SecrethitlerActionSheet screen={props(state, state.phase.presidentSeat)} />);
  const kinds = new Set(state.phase.hand);
  // The sheet renders through a portal, so query the document, not the render container.
  const srcs = [...document.querySelectorAll('.choice-card img')].map((img) =>
    img.getAttribute('src'),
  );
  expect(new Set(srcs).size).toBe(kinds.size);
  for (const src of srcs) expect(src).toBeTruthy();
});
