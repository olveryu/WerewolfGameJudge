import { getSecrethitlerViewModel } from '@game-judge/game-engine/games/secrethitler/public';
import { render, screen } from '@testing-library/react';

import {
  buildSecrethitlerPhaseStates,
  completeSecrethitlerTestVote,
  sendSecrethitlerSeatCommand,
} from '@/test-utils/secrethitlerState';

import {
  secrethitlerVoteFailImage,
  secrethitlerVotePassImage,
} from '../../assets/secrethitlerVoteImages';
import { SecrethitlerMatchDetails } from '../SecrethitlerRoomScreen';

const states = buildSecrethitlerPhaseStates();

it('shows the pass banner for a settled passed government', () => {
  const state = states.get('legislativePresident');
  if (state === undefined) throw new Error('Missing legislativePresident');
  if (state.phase.kind !== 'legislativePresident') throw new Error('Expected hand');
  render(
    <SecrethitlerMatchDetails
      state={state}
      view={getSecrethitlerViewModel(state, state.phase.presidentSeat)}
      mySeat={state.phase.presidentSeat}
    />,
  );
  expect(screen.getByTestId('secrethitler-settled-vote-banner').getAttribute('src')).toBe(
    secrethitlerVotePassImage,
  );
  expect(screen.getByRole('status')).toHaveTextContent(/通过/);
});

it('shows the fail banner for a settled rejected government', () => {
  let state = states.get('election');
  if (state === undefined) throw new Error('Missing election');
  if (state.phase.kind !== 'election') throw new Error('Expected election');
  const view = getSecrethitlerViewModel(state, state.phase.presidentSeat);
  const chancellor = view.eligibleChancellorSeats[0];
  if (chancellor === undefined) throw new Error('Missing chancellor');
  state = sendSecrethitlerSeatCommand(state, state.phase.presidentSeat, {
    type: 'secrethitler.government.preselect',
    chancellorSeatId: chancellor,
  });
  if (state.phase.kind !== 'election') throw new Error('Expected election after preselection');
  state = sendSecrethitlerSeatCommand(state, state.phase.presidentSeat, {
    type: 'secrethitler.government.nominate',
    chancellorSeatId: chancellor,
  });
  for (const seat of state.livingSeats) {
    state = sendSecrethitlerSeatCommand(state, seat, {
      type: 'secrethitler.government.castVote',
      vote: 'nein',
    });
  }
  state = completeSecrethitlerTestVote(state);
  render(
    <SecrethitlerMatchDetails state={state} view={getSecrethitlerViewModel(state, 0)} mySeat={0} />,
  );
  expect(screen.getByTestId('secrethitler-settled-vote-banner').getAttribute('src')).toBe(
    secrethitlerVoteFailImage,
  );
  expect(screen.getByRole('status')).toHaveTextContent(/未通过/);
});
