import {
  getSecrethitlerViewModel,
  isBotSeat,
} from '@game-judge/game-engine/games/secrethitler/public';

import {
  buildSecrethitlerPhaseStates,
  sendSecrethitlerSeatCommand,
} from '@/test-utils/secrethitlerState';

import { getSecrethitlerIdentityName } from '../../components/SecrethitlerRoleCardAdapter';
import { createSecrethitlerSeatDataSource } from '../secrethitlerRoomAdapter';

it('shows assigned bot identities to the room host only', () => {
  const state = buildSecrethitlerPhaseStates().get('viewing');
  if (state === undefined) throw new Error('Missing viewing fixture');
  const botSeat = 2;
  if (!isBotSeat(state.roster, botSeat)) throw new Error('Expected a bot in seat 2');
  const identity = state.identities[botSeat];
  if (identity === undefined) throw new Error('Missing assigned bot identity');

  const createSource = (userId: string) =>
    createSecrethitlerSeatDataSource({
      state,
      revision: 1,
      userId,
      controlledSeat: null,
    });

  expect(createSource('host').getSeat(botSeat).secondaryLabel).toBe(
    getSecrethitlerIdentityName(identity),
  );
  expect(createSource('host').getSeat(0).secondaryLabel).toBeNull();
  expect(createSource('u1').getSeat(botSeat).secondaryLabel).toBeNull();
  expect(createSource('spectator').getSeat(botSeat).secondaryLabel).toBeNull();
});

it('shows the public preselection to every viewer', () => {
  let state = buildSecrethitlerPhaseStates().get('election');
  if (state === undefined || state.phase.kind !== 'election') throw new Error('Missing election');
  const president = state.phase.presidentSeat;
  const candidate = getSecrethitlerViewModel(state, president).eligibleChancellorSeats[0];
  if (candidate === undefined) throw new Error('Missing candidate');
  state = sendSecrethitlerSeatCommand(state, president, {
    type: 'secrethitler.government.preselect',
    chancellorSeatId: candidate,
  });
  for (const userId of ['host', 'u1', 'spectator']) {
    const source = createSecrethitlerSeatDataSource({
      state,
      revision: 1,
      userId,
      controlledSeat: null,
    });
    expect(source.getSeat(candidate).indicators?.selection).toEqual({
      kind: 'preselected',
      label: '预选',
    });
  }
});
