/** Secret Hitler rules exercised through authoritative commands and parsed state. */

import { createEngineSession } from '../../../platform/engine/__tests__/engineSession';
import { isBotSeat } from '../../../platform/room/seating';
import type { SecrethitlerCommand } from '../commands/types';
import { SECRETHITLER_REASONS } from '../domain/decision';
import { getSecrethitlerNightParticipants } from '../domain/rules';
import { getSecrethitlerViewModel } from '../domain/visibility';
import { secrethitlerEngine } from '../engine';
import { parseSecrethitlerState } from '../state/parseState';
import {
  DEFAULT_SECRETHITLER_CONFIG,
  type SecrethitlerConfig,
  type SecrethitlerPhase,
  type SecrethitlerState,
} from '../state/types';

function game(
  numberOfPlayers = 5,
  humanCount = numberOfPlayers,
  randomSeed = 'secrethitler-test',
  fillBots = true,
) {
  const session = createEngineSession(secrethitlerEngine, {
    config: { ...DEFAULT_SECRETHITLER_CONFIG, numberOfPlayers } satisfies SecrethitlerConfig,
    parse: parseSecrethitlerState,
    randomSeed,
  });
  const seatUser = (seat: number) => (seat === 0 ? 'host' : `u${seat}`);
  const actorForSeat = (seat: number) =>
    isBotSeat(session.state.roster, seat)
      ? { userId: 'host', controlledSeat: seat }
      : { userId: seatUser(seat), controlledSeat: null };
  const send = (
    command: SecrethitlerCommand,
    userId = 'host',
    controlledSeat: number | null = null,
  ) => session.send(command, userId, controlledSeat);
  for (let seat = 0; seat < humanCount; seat += 1) {
    send({ type: 'room.seat.take', seat, profile: { displayName: `P${seat}` } }, seatUser(seat));
  }

  if (fillBots && humanCount < numberOfPlayers) send({ type: 'room.seat.fillBots' });
  return { session, send, seatUser, actorForSeat };
}

function currentPhase(current: ReturnType<typeof game>): SecrethitlerPhase {
  return current.session.state.phase;
}

function assignAndViewAll(current: ReturnType<typeof game>): void {
  current.send({ type: 'secrethitler.roles.assign' });
  for (let seat = 0; seat < current.session.state.config.numberOfPlayers; seat += 1) {
    if (isBotSeat(current.session.state.roster, seat)) {
      current.send({ type: 'secrethitler.role.viewed' }, 'host', seat);
    } else {
      current.send({ type: 'secrethitler.role.viewed' }, current.seatUser(seat));
    }
  }
}

function acknowledgeAudio(current: ReturnType<typeof game>): void {
  if (!current.session.state.isAudioPlaying) return;
  current.send({
    type: 'secrethitler.audio.ack',
    audioBatchId: current.session.state.audioBatchId,
  });
}

function enterElection(current: ReturnType<typeof game>): void {
  assignAndViewAll(current);
  current.send({ type: 'secrethitler.game.begin' });
  finishNight(current);
}

function finishNight(current: ReturnType<typeof game>): void {
  for (const seat of getSecrethitlerNightParticipants(current.session.state)) {
    const actor = current.actorForSeat(seat);
    current.send(
      { type: 'secrethitler.night.confirm', step: 1 },
      actor.userId,
      actor.controlledSeat,
    );
  }
  acknowledgeAudio(current);
  acknowledgeAudio(current);
}

function voteAll(current: ReturnType<typeof game>, vote: 'ja' | 'nein'): void {
  for (const seat of [...current.session.state.livingSeats]) {
    const actor = current.actorForSeat(seat);
    current.send(
      { type: 'secrethitler.government.castVote', vote },
      actor.userId,
      actor.controlledSeat,
    );
  }
}

function eligibleChancellors(state: SecrethitlerState, president: number): number[] {
  return state.livingSeats.filter(
    (seat) =>
      seat !== president &&
      seat !== state.lastChancellorSeat &&
      (state.livingSeats.length <= 5 || seat !== state.lastPresidentSeat),
  );
}

function nominateAndVote(
  current: ReturnType<typeof game>,
  vote: 'ja' | 'nein',
  avoidHitler = false,
): void {
  const phase = currentPhase(current);
  if (phase.kind !== 'election') throw new Error('Expected election');
  const candidates = eligibleChancellors(current.session.state, phase.presidentSeat).filter(
    (seat) => !avoidHitler || current.session.state.identities[seat] !== 'hitler',
  );
  const chancellor = candidates[0];
  if (chancellor === undefined) throw new Error('No eligible Secret Hitler chancellor');
  const president = current.actorForSeat(phase.presidentSeat);
  current.send(
    { type: 'secrethitler.government.nominate', chancellorSeatId: chancellor },
    president.userId,
    president.controlledSeat,
  );
  voteAll(current, vote);
}

function resolvePower(current: ReturnType<typeof game>): void {
  const phase = currentPhase(current);
  if (phase.kind !== 'executive') return;
  const president = current.actorForSeat(phase.presidentSeat);
  if (phase.power === 'policyPeek') {
    current.send(
      { type: 'secrethitler.action.acknowledgePolicyPeek' },
      president.userId,
      president.controlledSeat,
    );
    return;
  }
  if (phase.power === 'specialElection') {
    const target = current.session.state.livingSeats.find((seat) => seat !== phase.presidentSeat);
    if (target === undefined) throw new Error('No special-election target');
    current.send(
      { type: 'secrethitler.action.specialElection', targetSeatId: target },
      president.userId,
      president.controlledSeat,
    );
    return;
  }
  if (phase.power === 'investigate') {
    const target = current.session.state.livingSeats.find(
      (seat) =>
        seat !== phase.presidentSeat && !current.session.state.investigatedSeats.includes(seat),
    );
    if (target === undefined) throw new Error('No investigation target');
    current.send(
      { type: 'secrethitler.action.investigate', targetSeatId: target },
      president.userId,
      president.controlledSeat,
    );
    return;
  }
  const target = current.session.state.livingSeats.find(
    (seat) => seat !== phase.presidentSeat && current.session.state.identities[seat] !== 'hitler',
  );
  if (target === undefined) throw new Error('No non-Hitler execution target');
  current.send(
    { type: 'secrethitler.action.execute', targetSeatId: target },
    president.userId,
    president.controlledSeat,
  );
}

function enactPolicy(
  current: ReturnType<typeof game>,
  desired: 'liberal' | 'fascist',
  completePower = true,
): void {
  const state = current.session.state;
  if (state.phase.kind !== 'legislativePresident')
    throw new Error('Expected president legislation');
  const president = current.actorForSeat(state.phase.presidentSeat);
  const discard =
    desired === 'fascist'
      ? (state.phase.hand.find((policy) => policy === 'liberal') ?? state.phase.hand[0])
      : (state.phase.hand.find((policy) => policy === 'fascist') ?? state.phase.hand[0]);
  if (discard === undefined) throw new Error('Empty president hand');
  current.send(
    { type: 'secrethitler.policy.presidentDiscard', policy: discard },
    president.userId,
    president.controlledSeat,
  );
  const chancellorPhase = current.session.state.phase;
  if (chancellorPhase.kind !== 'legislativeChancellor') throw new Error('Expected chancellor hand');
  const chancellor = current.actorForSeat(chancellorPhase.chancellorSeat);
  const policy =
    chancellorPhase.hand.find((candidate) => candidate === desired) ?? chancellorPhase.hand[0];
  if (policy === undefined) throw new Error('Empty chancellor hand');
  current.send(
    { type: 'secrethitler.policy.chancellorResolve', action: 'enact', policy },
    chancellor.userId,
    chancellor.controlledSeat,
  );
  if (completePower) resolvePower(current);
}

function reachPower(
  current: ReturnType<typeof game>,
  power: 'policyPeek' | 'investigate' | 'specialElection',
) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const phase = currentPhase(current);
    if (phase.kind === 'executive' && phase.power === power) return phase;
    if (phase.kind === 'executive') resolvePower(current);
    else if (phase.kind === 'election') nominateAndVote(current, 'ja', true);
    else if (phase.kind === 'legislativePresident') enactPolicy(current, 'fascist', false);
    else throw new Error(`Ended before ${power}`);
  }
  throw new Error(`Did not reach ${power}`);
}

function driveToPolicyCount(
  current: ReturnType<typeof game>,
  faction: 'liberal' | 'fascist',
  count: number,
): void {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (
      (faction === 'liberal' && current.session.state.liberalPolicies >= count) ||
      (faction === 'fascist' && current.session.state.fascistPolicies >= count) ||
      current.session.state.phase.kind === 'ended'
    )
      return;
    if (current.session.state.phase.kind !== 'election') throw new Error('Expected next election');
    nominateAndVote(current, 'ja', true);
    const phase = currentPhase(current);
    if (phase.kind !== 'legislativePresident') continue;
    enactPolicy(current, faction);
  }
}

describe('Secret Hitler setup, role knowledge, and first night', () => {
  it.each([5, 6, 7, 8, 9, 10])(
    'waits for both narration and private confirmations in either arrival order for %i players',
    (count) => {
      for (const confirmFirst of [true, false]) {
        const current = game(count);
        assignAndViewAll(current);
        current.send({ type: 'secrethitler.game.begin' });
        const revealBatch = current.session.state.audioBatchId;
        if (!confirmFirst) acknowledgeAudio(current);
        for (const seat of getSecrethitlerNightParticipants(current.session.state)) {
          expect(current.session.state.phase.kind).toBe('night');
          current.send({ type: 'secrethitler.night.confirm', step: 1 }, current.seatUser(seat));
        }
        if (confirmFirst) {
          expect(current.session.state.phase.kind).toBe('night');
          expect(current.session.state.pendingAudioEffects[1]?.audioKey).toBe(
            count <= 6 ? 'evil_reveal_5_6' : 'fascist_reveal_7_10',
          );
          acknowledgeAudio(current);
        }
        expect(current.session.state.phase.kind).toBe('election');
        expect(current.session.state.pendingAudioEffects).toEqual([
          { audioKey: 'evil_close', isEndAudio: true },
          { audioKey: 'night_end' },
        ]);
        const closingBatch = current.session.state.audioBatchId;
        current.send({ type: 'secrethitler.audio.ack', audioBatchId: revealBatch });
        expect(current.session.state.audioBatchId).toBe(closingBatch);
        expect(current.session.state.isAudioPlaying).toBe(true);
        const closing = current.session.state.phase;
        if (closing.kind !== 'election') throw new Error('Expected closing narration');
        const chancellor = current.session.state.livingSeats.find(
          (seat) => seat !== closing.presidentSeat,
        );
        if (chancellor === undefined) throw new Error('Missing chancellor candidate');
        current.session.expectReject(
          {
            type: 'secrethitler.government.nominate',
            chancellorSeatId: chancellor,
          },
          SECRETHITLER_REASONS.audioPlaying,
          current.seatUser(closing.presidentSeat),
        );
        acknowledgeAudio(current);
        expect(current.session.state.phase.kind).toBe('election');
        expect(current.session.state.isAudioPlaying).toBe(false);
      }
    },
  );
  it('allows an entirely bot-filled room to receive identities and a bot first president', () => {
    const current = game(5, 0);
    current.send({ type: 'secrethitler.roles.assign' });
    expect(current.session.state.phase.kind).toBe('viewing');
    expect(Object.keys(current.session.state.identities)).toHaveLength(5);
    expect(isBotSeat(current.session.state.roster, current.session.state.nextPresidentSeat)).toBe(
      true,
    );
  });
  it('replays only the current host narration without clearing recognition confirmations', () => {
    const current = game();
    assignAndViewAll(current);
    current.send({ type: 'secrethitler.game.begin' });
    acknowledgeAudio(current);
    acknowledgeAudio(current);
    const participant = getSecrethitlerNightParticipants(current.session.state)[0];
    if (participant === undefined) throw new Error('Missing night participant');
    current.send({ type: 'secrethitler.night.confirm', step: 1 }, current.seatUser(participant));
    const phase = current.session.state.phase;
    const previousBatch = current.session.state.audioBatchId;
    current.session.expectReject(
      { type: 'secrethitler.night.replay', step: 0 },
      SECRETHITLER_REASONS.nightStep,
    );
    current.session.expectReject(
      { type: 'secrethitler.night.replay', step: 1 },
      SECRETHITLER_REASONS.notHostNightReplay,
      'u1',
    );
    current.send({ type: 'secrethitler.night.replay', step: 1 });
    expect(current.session.state.phase).toEqual(phase);
    expect(current.session.state.isAudioPlaying).toBe(true);
    expect(current.session.state.pendingAudioEffects).toEqual([{ audioKey: 'evil_reveal_5_6' }]);
    expect(current.session.state.audioBatchId).toBe(previousBatch + 1);
    current.send({ type: 'secrethitler.audio.ack', audioBatchId: previousBatch });
    expect(current.session.state.isAudioPlaying).toBe(true);
    expect(current.session.state.audioBatchId).toBe(previousBatch + 1);
  });
  it('deals the exact 5–10 player role matrix deterministically from the command seed', () => {
    for (let count = 5; count <= 10; count += 1) {
      const first = game(count, count, `roles:${count}`);
      const second = game(count, count, `roles:${count}`);
      first.send({ type: 'secrethitler.roles.assign' });
      second.send({ type: 'secrethitler.roles.assign' });
      expect(first.session.state.identities).toEqual(second.session.state.identities);
      const roles = Object.values(first.session.state.identities);
      const fascists = count >= 9 ? 3 : count >= 7 ? 2 : 1;
      const liberals = count - fascists - 1;
      expect(roles.filter((role) => role === 'liberal')).toHaveLength(liberals);
      expect(roles.filter((role) => role === 'fascist')).toHaveLength(fascists);
      expect(roles.filter((role) => role === 'hitler')).toHaveLength(1);
    }
  });

  it('enforces supported player counts and seats before dealing', () => {
    expect(() =>
      secrethitlerEngine.createInitialState(
        { numberOfPlayers: 4 },
        { roomCode: '1234', hostUserId: 'host', nowMs: 0, commandId: 'create' },
      ),
    ).toThrow(SECRETHITLER_REASONS.config);
    const current = game(5, 3, 'not-full', false);
    const decision = current.session.decide({ type: 'secrethitler.roles.assign' });
    expect(decision).toEqual({ kind: 'reject', reason: SECRETHITLER_REASONS.full });
    const presidents = new Set<number>();
    for (let seed = 0; seed < 30; seed += 1) {
      const botFilled = game(5, 3, `first-president:${seed}`);
      botFilled.send({ type: 'secrethitler.roles.assign' });
      presidents.add(botFilled.session.state.nextPresidentSeat);
    }
    expect([...presidents].sort()).toEqual([0, 1, 2, 3, 4]);
  });

  it('automatically advances the electronic audio sequence and crops first-night knowledge', () => {
    const current = game(5);
    assignAndViewAll(current);
    current.send({ type: 'secrethitler.game.begin' });
    expect(current.session.state.phase).toEqual({ kind: 'night', step: 1, confirmedSeats: [] });
    expect(current.session.state.pendingAudioEffects).toEqual([
      { audioKey: 'night_start' },
      { audioKey: 'evil_reveal_5_6' },
    ]);
    const denied = current.session.decide(
      { type: 'secrethitler.audio.ack', audioBatchId: current.session.state.audioBatchId },
      current.seatUser(1),
    );
    expect(denied).toEqual({ kind: 'reject', reason: SECRETHITLER_REASONS.notHostAckAudio });
    const blocked = current.session.decide({ type: 'secrethitler.night.replay', step: 1 });
    expect(blocked).toEqual({ kind: 'reject', reason: SECRETHITLER_REASONS.audioPlaying });
    acknowledgeAudio(current);
    expect(current.session.state.pendingAudioEffects).toEqual([]);
    const hitlerSeat = Number(
      Object.entries(current.session.state.identities).find(([, role]) => role === 'hitler')?.[0],
    );
    const known = getSecrethitlerViewModel(current.session.state, hitlerSeat).knownFascistSeats;
    expect(known).toHaveLength(1);
    const liberalSeat = Number(
      Object.entries(current.session.state.identities).find(([, role]) => role === 'liberal')?.[0],
    );
    expect(getSecrethitlerViewModel(current.session.state, liberalSeat).knownFascistSeats).toEqual(
      [],
    );
    expect(getSecrethitlerViewModel(current.session.state, null).knownFascistSeats).toEqual([]);
    acknowledgeAudio(current);
    expect(current.session.state.phase).toEqual({ kind: 'night', step: 1, confirmedSeats: [] });
    expect(
      current.session.decide(
        { type: 'secrethitler.night.confirm', step: 1 },
        current.seatUser(liberalSeat),
      ),
    ).toEqual({ kind: 'reject', reason: SECRETHITLER_REASONS.nightParticipant });
    for (const seat of getSecrethitlerNightParticipants(current.session.state)) {
      current.send({ type: 'secrethitler.night.confirm', step: 1 }, current.seatUser(seat));
    }
    expect(current.session.state.pendingAudioEffects).toEqual([
      { audioKey: 'evil_close', isEndAudio: true },
      { audioKey: 'night_end' },
    ]);
    acknowledgeAudio(current);
    expect(current.session.state.phase.kind).toBe('election');
    expect(current.session.state.pendingAudioEffects).toEqual([]);

    const tenPlayers = game(10);
    assignAndViewAll(tenPlayers);
    tenPlayers.send({ type: 'secrethitler.game.begin' });
    const tenHitler = Number(
      Object.entries(tenPlayers.session.state.identities).find(
        ([, role]) => role === 'hitler',
      )?.[0],
    );
    expect(tenPlayers.session.state.pendingAudioEffects).toEqual([
      { audioKey: 'night_start' },
      { audioKey: 'fascist_reveal_7_10' },
    ]);
    expect(getSecrethitlerViewModel(tenPlayers.session.state, tenHitler).knownFascistSeats).toEqual(
      [],
    );
  });
});

describe('Secret Hitler elections, privacy, legislation, and chaos', () => {
  it('keeps votes private until everyone votes and reveals the completed public ballot', () => {
    const current = game(5);
    enterElection(current);
    const election = current.session.state.phase;
    if (election.kind !== 'election') throw new Error('Expected election');
    const chancellorSeat = eligibleChancellors(current.session.state, election.presidentSeat)[0];
    if (chancellorSeat === undefined) throw new Error('No candidate');
    const president = current.actorForSeat(election.presidentSeat);
    current.send(
      { type: 'secrethitler.government.nominate', chancellorSeatId: chancellorSeat },
      president.userId,
      president.controlledSeat,
    );
    const firstVoter = current.actorForSeat(0);
    current.send(
      { type: 'secrethitler.government.castVote', vote: 'ja' },
      firstVoter.userId,
      firstVoter.controlledSeat,
    );
    expect(getSecrethitlerViewModel(current.session.state, 0).myVote).toBe('ja');
    expect(getSecrethitlerViewModel(current.session.state, 1).myVote).toBeNull();
    expect(
      getSecrethitlerViewModel(current.session.state, 1).history.governments.at(-1)?.votes,
    ).toBeNull();
    for (const seat of current.session.state.livingSeats.filter((candidate) => candidate !== 0)) {
      const actor = current.actorForSeat(seat);
      current.send(
        { type: 'secrethitler.government.castVote', vote: 'ja' },
        actor.userId,
        actor.controlledSeat,
      );
    }
    const record = getSecrethitlerViewModel(current.session.state, 1).history.governments.at(-1);
    expect(record?.outcome).toBe('passed');
    expect(record?.votes).toHaveLength(5);
    expect(current.session.state.phase.kind).toBe('legislativePresident');
    const government = current.session.state.phase;
    if (government.kind !== 'legislativePresident') throw new Error('Expected president hand');
    expect(
      getSecrethitlerViewModel(current.session.state, government.presidentSeat).myHand,
    ).toHaveLength(3);
    expect(
      getSecrethitlerViewModel(current.session.state, government.chancellorSeat).myHand,
    ).toBeNull();
    const presidentActor = current.actorForSeat(government.presidentSeat);
    const discard = government.hand[0];
    if (discard === undefined) throw new Error('Missing policy');
    current.send(
      { type: 'secrethitler.policy.presidentDiscard', policy: discard },
      presidentActor.userId,
      presidentActor.controlledSeat,
    );
    const chancellorPhase = current.session.state.phase;
    if (chancellorPhase.kind !== 'legislativeChancellor')
      throw new Error('Expected chancellor hand');
    expect(
      getSecrethitlerViewModel(current.session.state, chancellorPhase.chancellorSeat).myHand,
    ).toHaveLength(2);
    expect(
      getSecrethitlerViewModel(current.session.state, chancellorPhase.presidentSeat).myHand,
    ).toBeNull();
    const exposed = getSecrethitlerViewModel(current.session.state, 1);
    expect(exposed).not.toHaveProperty('policyDeck');
    expect(exposed).not.toHaveProperty('identities');
  });

  it('advances the chaos policy after three rejected governments without a power or term limit', () => {
    const current = game(5);
    enterElection(current);
    for (let rejection = 0; rejection < 3; rejection += 1) {
      nominateAndVote(current, 'nein');
      if (rejection < 2) {
        expect(current.session.state.electionTracker).toBe(rejection + 1);
        expect(current.session.state.phase.kind).toBe('election');
      }
    }
    expect(current.session.state.electionTracker).toBe(0);
    expect(current.session.state.lastPresidentSeat).toBeNull();
    expect(current.session.state.lastChancellorSeat).toBeNull();
    expect(current.session.state.history.policies).toHaveLength(1);
    expect(current.session.state.history.policies[0]?.source).toBe('chaos');
    expect(current.session.state.phase.kind).toBe('election');
    expect(
      current.session.state.history.governments.every((government) => government.votes !== null),
    ).toBe(true);
  });

  it('applies the last-elected-government term limits and the five-player exception', () => {
    const current = game(6);
    enterElection(current);
    nominateAndVote(current, 'ja', true);
    const firstGovernment = current.session.state.phase;
    if (firstGovernment.kind !== 'legislativePresident') throw new Error('Expected legislature');
    const oldChancellor = firstGovernment.chancellorSeat;
    enactPolicy(current, 'liberal');
    expect(current.session.state.phase.kind).toBe('election');
    const afterGovernment = currentPhase(current);
    if (afterGovernment.kind !== 'election') return;
    const nextPresident = afterGovernment.presidentSeat;
    const rejectedChancellor = current.session.decide(
      { type: 'secrethitler.government.nominate', chancellorSeatId: oldChancellor },
      current.actorForSeat(nextPresident).userId,
      current.actorForSeat(nextPresident).controlledSeat,
    );
    expect(rejectedChancellor).toEqual({
      kind: 'reject',
      reason: SECRETHITLER_REASONS.nomination,
    });
    const fivePlayer = game(5);
    enterElection(fivePlayer);
    nominateAndVote(fivePlayer, 'ja', true);
    const fiveGov = fivePlayer.session.state.phase;
    if (fiveGov.kind !== 'legislativePresident') throw new Error('Expected legislature');
    const formerPresident = fiveGov.presidentSeat;
    enactPolicy(fivePlayer, 'liberal');
    const fivePlayerPhase = currentPhase(fivePlayer);
    if (fivePlayerPhase.kind !== 'election') throw new Error('Expected election');
    const currentPresident = fivePlayerPhase.presidentSeat;
    expect(fivePlayer.session.state.livingSeats.length).toBe(5);
    if (currentPresident !== formerPresident) {
      const president = fivePlayer.actorForSeat(currentPresident);
      const allowed = fivePlayer.session.decide(
        { type: 'secrethitler.government.nominate', chancellorSeatId: formerPresident },
        president.userId,
        president.controlledSeat,
      );
      expect(allowed.kind).toBe('commit');
    }
  });
});

describe('Secret Hitler policies, powers, and settlement', () => {
  it('reveals exactly the next three policies only to the president and preserves their draw order', () => {
    const current = game(5, 5, 'veto-seed');
    enterElection(current);
    const phase = reachPower(current, 'policyPeek');
    const preview = phase.preview;
    expect(preview).toHaveLength(3);
    expect(current.session.state.policyDeck.slice(0, 3)).toEqual(preview);
    expect(
      getSecrethitlerViewModel(current.session.state, phase.presidentSeat).policyPreview,
    ).toEqual(preview);
    expect(getSecrethitlerViewModel(current.session.state, null).policyPreview).toBeNull();
    expect(
      getSecrethitlerViewModel(current.session.state, (phase.presidentSeat + 1) % 5).policyPreview,
    ).toBeNull();
    resolvePower(current);
    nominateAndVote(current, 'ja', true);
    const next = currentPhase(current);
    if (next.kind !== 'legislativePresident') throw new Error('Expected next hand');
    expect(next.hand).toEqual(preview);
  });

  it('returns to the original presidential rotation after a special election even if its government fails', () => {
    const current = game(8, 8, 'veto-seed');
    enterElection(current);
    const phase = reachPower(current, 'specialElection');
    const target = (phase.presidentSeat + 3) % 8;
    const actor = current.actorForSeat(phase.presidentSeat);
    current.send(
      { type: 'secrethitler.action.specialElection', targetSeatId: target },
      actor.userId,
      actor.controlledSeat,
    );
    expect(current.session.state.phase).toEqual({
      kind: 'election',
      presidentSeat: target,
      returnToSeat: (phase.presidentSeat + 1) % 8,
    });
    nominateAndVote(current, 'nein');
    expect(current.session.state.phase).toEqual({
      kind: 'election',
      presidentSeat: (phase.presidentSeat + 1) % 8,
      returnToSeat: null,
    });
  });

  it('keeps the previous failures through an elected government and triggers chaos on its approved veto', () => {
    const current = game(8, 8, 'veto-seed');
    enterElection(current);
    driveToPolicyCount(current, 'fascist', 5);
    nominateAndVote(current, 'nein');
    nominateAndVote(current, 'nein');
    nominateAndVote(current, 'ja', true);
    expect(current.session.state.electionTracker).toBe(2);
    const phase = currentPhase(current);
    if (phase.kind !== 'legislativePresident') throw new Error('Expected hand');
    const president = current.actorForSeat(phase.presidentSeat);
    const discard = phase.hand[0];
    if (discard === undefined) throw new Error('Missing discard');
    current.send(
      { type: 'secrethitler.policy.presidentDiscard', policy: discard },
      president.userId,
      president.controlledSeat,
    );
    const chancellor = current.actorForSeat(phase.chancellorSeat);
    current.send(
      { type: 'secrethitler.policy.chancellorResolve', action: 'veto' },
      chancellor.userId,
      chancellor.controlledSeat,
    );
    const policyCount = current.session.state.history.policies.length;
    const actionCount = current.session.state.history.actions.length;
    const expectedPolicy = current.session.state.policyDeck[0];
    current.send(
      { type: 'secrethitler.policy.vetoRespond', approve: true },
      president.userId,
      president.controlledSeat,
    );
    expect(current.session.state.history.policies).toHaveLength(policyCount + 1);
    expect(current.session.state.history.policies.at(-1)).toEqual({
      policy: expectedPolicy,
      source: 'chaos',
    });
    expect(current.session.state.history.actions).toHaveLength(actionCount);
    expect(current.session.state.electionTracker).toBe(0);
    expect(current.session.state.lastPresidentSeat).toBeNull();
    expect(current.session.state.lastChancellorSeat).toBeNull();
  });

  it('ends immediately when Hitler is elected after the third fascist policy', () => {
    const current = game(5, 5, 'veto-seed');
    enterElection(current);
    driveToPolicyCount(current, 'fascist', 3);
    let phase = currentPhase(current);
    if (phase.kind !== 'election') throw new Error('Expected election');
    const hitler = Number(
      Object.entries(current.session.state.identities).find(([, role]) => role === 'hitler')?.[0],
    );
    if (phase.presidentSeat === hitler) {
      nominateAndVote(current, 'nein');
      phase = currentPhase(current);
    }
    if (phase.kind !== 'election') throw new Error('Expected next election');
    const president = current.actorForSeat(phase.presidentSeat);
    current.send(
      { type: 'secrethitler.government.nominate', chancellorSeatId: hitler },
      president.userId,
      president.controlledSeat,
    );
    voteAll(current, 'ja');
    expect(current.session.state.phase).toEqual({
      kind: 'ended',
      winner: 'fascist',
      reason: 'hitlerElected',
    });
    expect(current.session.effects).toHaveLength(1);
    current.session.expectReject(
      { type: 'secrethitler.government.castVote', vote: 'ja' },
      SECRETHITLER_REASONS.phase,
    );
    expect(current.session.effects).toHaveLength(1);
  });

  it('does not re-trigger a fascist-track power when a liberal policy is enacted', () => {
    let exercised = false;
    for (let seed = 0; seed < 8 && !exercised; seed += 1) {
      const current = game(8, 8, `liberal-power:${seed}`);
      enterElection(current);
      driveToPolicyCount(current, 'fascist', 2);
      if (currentPhase(current).kind === 'ended') continue;
      nominateAndVote(current, 'ja', true);
      const phase = currentPhase(current);
      if (phase.kind !== 'legislativePresident' || !phase.hand.includes('liberal')) continue;
      const president = current.actorForSeat(phase.presidentSeat);
      const discard = phase.hand.includes('fascist') ? 'fascist' : 'liberal';
      current.send(
        { type: 'secrethitler.policy.presidentDiscard', policy: discard },
        president.userId,
        president.controlledSeat,
      );
      const chancellor = current.actorForSeat(phase.chancellorSeat);
      current.send(
        { type: 'secrethitler.policy.chancellorResolve', action: 'enact', policy: 'liberal' },
        chancellor.userId,
        chancellor.controlledSeat,
      );
      expect(current.session.state.phase.kind).toBe('election');
      exercised = true;
    }
    expect(exercised).toBe(true);
  });

  it('execution of Hitler ends the game, retains eliminated humans in settlement, and resets on rematch', () => {
    const current = game(5, 5, 'veto-seed');
    enterElection(current);
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const phase = currentPhase(current);
      if (phase.kind === 'executive' && phase.power === 'execute') {
        const hitler = Number(
          Object.entries(current.session.state.identities).find(
            ([, role]) => role === 'hitler',
          )?.[0],
        );
        if (phase.presidentSeat !== hitler) {
          const president = current.actorForSeat(phase.presidentSeat);
          current.send(
            { type: 'secrethitler.action.execute', targetSeatId: hitler },
            president.userId,
            president.controlledSeat,
          );
          break;
        }
        resolvePower(current);
      } else if (phase.kind === 'election') {
        nominateAndVote(current, 'ja', true);
      } else if (phase.kind === 'legislativePresident') {
        const president = current.actorForSeat(phase.presidentSeat);
        current.send(
          {
            type: 'secrethitler.policy.presidentDiscard',
            policy: phase.hand.includes('liberal') ? 'liberal' : 'fascist',
          },
          president.userId,
          president.controlledSeat,
        );
      } else if (phase.kind === 'legislativeChancellor') {
        const chancellor = current.actorForSeat(phase.chancellorSeat);
        current.send(
          {
            type: 'secrethitler.policy.chancellorResolve',
            action: 'enact',
            policy: phase.hand.includes('fascist') ? 'fascist' : 'liberal',
          },
          chancellor.userId,
          chancellor.controlledSeat,
        );
      } else if (phase.kind === 'executive') resolvePower(current);
      else break;
    }
    expect(current.session.state.phase).toEqual({
      kind: 'ended',
      winner: 'liberal',
      reason: 'hitlerExecuted',
    });
    expect(current.session.effects[0]?.payload.participantUserIds).toHaveLength(5);
    const previousSequence = current.session.state.gameSequence;
    current.send({ type: 'secrethitler.roles.assign' });
    expect(current.session.state.gameSequence).toBe(previousSequence + 1);
    expect(current.session.state.livingSeats).toHaveLength(5);
    expect(current.session.state.history).toEqual({ governments: [], policies: [], actions: [] });
    expect(current.session.state.roleViewedSeats).toEqual([]);
    expect(current.session.state.xpSettled).toBe(false);
  });

  it('unlocks veto at five fascist policies and lets the president reject or accept a request', () => {
    const current = game(5, 5, 'veto-seed');
    enterElection(current);
    driveToPolicyCount(current, 'fascist', 5);
    expect(current.session.state.fascistPolicies).toBeGreaterThanOrEqual(5);
    if (currentPhase(current).kind === 'ended') throw new Error('Game ended before veto test');
    if (currentPhase(current).kind !== 'election') throw new Error('Expected election');
    nominateAndVote(current, 'ja', true);
    if (currentPhase(current).kind !== 'legislativePresident') throw new Error('Expected hand');
    enactPolicy(current, 'fascist');
    if (currentPhase(current).kind === 'ended') throw new Error('Game ended before next election');
    if (currentPhase(current).kind !== 'election') throw new Error('Expected next election');
    nominateAndVote(current, 'ja', true);
    const before = currentPhase(current);
    if (before.kind !== 'legislativePresident') throw new Error('Expected hand');
    const president = current.actorForSeat(before.presidentSeat);
    const discard = before.hand[0];
    if (discard === undefined) throw new Error('Missing policy');
    current.send(
      { type: 'secrethitler.policy.presidentDiscard', policy: discard },
      president.userId,
      president.controlledSeat,
    );
    const chancellor = currentPhase(current);
    if (chancellor.kind !== 'legislativeChancellor') throw new Error('Expected hand');
    const chancellorActor = current.actorForSeat(chancellor.chancellorSeat);
    current.send(
      { type: 'secrethitler.policy.chancellorResolve', action: 'veto' },
      chancellorActor.userId,
      chancellorActor.controlledSeat,
    );
    expect(currentPhase(current).kind).toBe('vetoResponse');
    const presidentActor = current.actorForSeat(chancellor.presidentSeat);
    current.send(
      { type: 'secrethitler.policy.vetoRespond', approve: false },
      presidentActor.userId,
      presidentActor.controlledSeat,
    );
    const afterVeto = currentPhase(current);
    expect(afterVeto.kind).toBe('legislativeChancellor');
    expect(
      current.session.decide(
        { type: 'secrethitler.policy.chancellorResolve', action: 'veto' },
        chancellorActor.userId,
        chancellorActor.controlledSeat,
      ),
    ).toEqual({ kind: 'reject', reason: SECRETHITLER_REASONS.veto });
    if (afterVeto.kind !== 'legislativeChancellor') return;
    const hand = afterVeto.hand;
    const policy = hand[0];
    if (policy === undefined) throw new Error('Missing policy');
    const actor = current.actorForSeat(afterVeto.chancellorSeat);
    current.send(
      { type: 'secrethitler.policy.chancellorResolve', action: 'enact', policy },
      actor.userId,
      actor.controlledSeat,
    );
  });

  it('emits one completion fact per human with wins matching opening faction; bots are excluded', () => {
    const current = game(5, 5, 'liberal-win');
    enterElection(current);
    for (
      let attempt = 0;
      attempt < 30 && current.session.state.phase.kind !== 'ended';
      attempt += 1
    ) {
      nominateAndVote(current, 'ja', true);
      if (current.session.state.phase.kind === 'legislativePresident')
        enactPolicy(current, 'liberal');
    }
    expect(current.session.state.phase).toMatchObject({
      kind: 'ended',
      winner: 'liberal',
      reason: 'liberalPolicies',
    });
    const effect = current.session.effects.find(
      (entry) => entry.type === 'secrethitler.game.completed',
    );
    expect(effect?.payload).toMatchObject({
      completionVersion: 2,
      participantUserIds: ['host', 'u1', 'u2', 'u3', 'u4'],
    });
    if (effect?.type !== 'secrethitler.game.completed')
      throw new Error('Missing completion effect');
    if (!('stats' in effect.payload)) throw new Error('Expected strict v2 completion facts');
    expect(effect.payload.stats).toEqual(
      ['host', 'u1', 'u2', 'u3', 'u4'].map((userId, seat) => ({
        userId,
        gamesPlayed: 1,
        liberalWins: current.session.state.identities[seat] === 'liberal' ? 1 : 0,
        fascistWins: current.session.state.identities[seat] !== 'liberal' ? 0 : 0,
      })),
    );
    const historyView = getSecrethitlerViewModel(current.session.state, null);
    expect(historyView.winner).toBe('liberal');
    expect(historyView.endReason).toBe('liberalPolicies');
    expect(historyView.seats.every((seat) => seat.identity !== null)).toBe(true);

    const botFilled = game(5, 3, 'bot-settlement');
    enterElection(botFilled);
    for (
      let attempt = 0;
      attempt < 30 && botFilled.session.state.phase.kind !== 'ended';
      attempt += 1
    ) {
      nominateAndVote(botFilled, 'ja', true);
      if (botFilled.session.state.phase.kind === 'legislativePresident')
        enactPolicy(botFilled, 'liberal');
    }
    expect(botFilled.session.state.phase.kind).toBe('ended');
    const botEffect = botFilled.session.effects.find(
      (entry) => entry.type === 'secrethitler.game.completed',
    );
    expect(botEffect).toBeUndefined();
  });

  it('does not disclose private investigations, hands, or policy previews in public history', () => {
    const current = game(10, 10, 'privacy-power');
    enterElection(current);
    driveToPolicyCount(current, 'fascist', 3);
    expect(current.session.state.phase.kind).not.toBe('ended');
    expect(current.session.state.history.policies.length).toBeGreaterThanOrEqual(1);
    const publicView = getSecrethitlerViewModel(current.session.state, null);
    expect(publicView.myInvestigation).toBeNull();
    expect(publicView.policyPreview).toBeNull();
    expect(publicView.myHand).toBeNull();
  });
});
