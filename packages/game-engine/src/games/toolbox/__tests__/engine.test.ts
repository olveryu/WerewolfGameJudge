import { createEngineSession } from '../../../platform/engine/__tests__/engineSession';
import { TOOLBOX_REASONS } from '../domain/decision';
import { projectToolboxStateForUser } from '../domain/visibility';
import { toolboxEngine } from '../engine';
import { parseToolboxState } from '../state/parseState';
import {
  DEFAULT_TOOLBOX_CONFIG,
  type ToolboxConfig,
  type ToolboxIdentityConfig,
  type ToolboxState,
} from '../state/types';
import { parseToolboxView } from '../state/view';

const IDENTITY: ToolboxIdentityConfig = {
  identities: [
    { name: '狼人', description: '夜里睁眼', count: 2 },
    { name: '村民', description: '', count: 3 },
  ],
  cardsPerPlayer: 1,
};

function session(config: ToolboxConfig = DEFAULT_TOOLBOX_CONFIG) {
  return createEngineSession(toolboxEngine, { config, parse: parseToolboxState });
}

function startWith(config: ToolboxConfig, users: readonly string[]): ReturnType<typeof session> {
  const game = session(config);
  for (const user of users) {
    game.send({ type: 'toolbox.member.join' }, user);
    game.send({ type: 'toolbox.seat.take' }, user);
  }
  game.send({ type: 'toolbox.session.begin', configVersion: game.state.configVersion });
  return game;
}

function activePhase(state: ToolboxState) {
  if (state.phase.kind !== 'active') throw new Error('expected active phase');
  return state.phase;
}

function cupOf(state: ToolboxState, userId: string) {
  const cup = activePhase(state).dice?.find((entry) => entry.userId === userId)?.cup;
  if (cup === undefined) throw new Error(`missing cup for ${userId}`);
  return cup;
}

describe('toolbox membership and preparation', () => {
  it('counts members by account and keeps seats when a member leaves', () => {
    const game = session();
    expect(game.state.memberUserIds).toEqual(['host']);
    game.send({ type: 'toolbox.member.join' }, 'a');
    game.send({ type: 'toolbox.member.join' }, 'a');
    game.send({ type: 'toolbox.seat.take' }, 'a');
    expect(game.state.memberUserIds).toEqual(['host', 'a']);
    game.send({ type: 'toolbox.member.leave' }, 'a');
    expect(game.state.memberUserIds).toEqual(['host']);
    expect(game.state.phase).toEqual({ kind: 'preparing', seatedUserIds: ['a'] });
    game.expectReject({ type: 'toolbox.seat.release' }, TOOLBOX_REASONS.notMember, 'a');
  });

  it('lets only the host clear seats, and only when someone is seated', () => {
    const game = session();
    game.expectReject({ type: 'toolbox.seats.clear' }, TOOLBOX_REASONS.noSeated);
    game.send({ type: 'toolbox.member.join' }, 'a');
    game.send({ type: 'toolbox.seat.take' }, 'a');
    game.send({ type: 'toolbox.seat.take' });
    game.expectReject({ type: 'toolbox.seats.clear' }, TOOLBOX_REASONS.notHost, 'a');
    game.send({ type: 'toolbox.seats.clear' });
    expect(game.state.phase).toEqual({ kind: 'preparing', seatedUserIds: [] });
    expect(game.state.memberUserIds).toEqual(['host', 'a']);
  });

  it('rejects duplicate identity names and an enabled identity tool without identities', () => {
    const game = session();
    game.expectReject(
      {
        type: 'toolbox.config.update',
        config: {
          tools: ['identity'],
          identity: {
            identities: [
              { name: '狼人', description: '', count: 1 },
              { name: '狼人', description: '', count: 1 },
            ],
            cardsPerPlayer: 1,
          },
        },
      },
      TOOLBOX_REASONS.identityNameDuplicate,
    );
    game.expectReject(
      {
        type: 'toolbox.config.update',
        config: { tools: ['identity'], identity: { identities: [], cardsPerPlayer: 1 } },
      },
      TOOLBOX_REASONS.configInvalid,
    );
    game.expectReject(
      { type: 'toolbox.config.update', config: { ...DEFAULT_TOOLBOX_CONFIG, tools: [] } },
      TOOLBOX_REASONS.noTools,
    );
  });

  it('begins only with seated users, the current config version and enough cards', () => {
    const game = session({ tools: ['identity'], identity: { ...IDENTITY, cardsPerPlayer: 3 } });
    game.expectReject(
      { type: 'toolbox.session.begin', configVersion: 0 },
      TOOLBOX_REASONS.noSeated,
    );
    for (const user of ['host', 'a']) {
      if (user !== 'host') game.send({ type: 'toolbox.member.join' }, user);
      game.send({ type: 'toolbox.seat.take' }, user);
    }
    game.expectReject(
      { type: 'toolbox.session.begin', configVersion: 0 },
      TOOLBOX_REASONS.notEnoughCards,
    );
    game.send({
      type: 'toolbox.config.update',
      config: { tools: ['identity'], identity: IDENTITY },
    });
    game.expectReject(
      { type: 'toolbox.session.begin', configVersion: 0 },
      TOOLBOX_REASONS.configChanged,
    );
    game.send({ type: 'toolbox.session.begin', configVersion: 1 });
    expect(activePhase(game.state).participantUserIds).toEqual(['host', 'a']);
    game.send({ type: 'toolbox.member.join' }, 'late');
    game.expectReject({ type: 'toolbox.seat.take' }, TOOLBOX_REASONS.alreadyStarted, 'late');
  });

  it('returns to preparation on end, clearing tools, seats and results', () => {
    const game = startWith({ tools: ['dice', 'identity'], identity: IDENTITY }, ['a']);
    const { sessionId } = activePhase(game.state);
    game.expectReject(
      { type: 'toolbox.session.end', sessionId: 'stale' },
      TOOLBOX_REASONS.sessionStale,
    );
    game.send({ type: 'toolbox.session.end', sessionId });
    expect(game.state.phase).toEqual({ kind: 'preparing', seatedUserIds: [] });
    expect(game.state.config).toEqual({ tools: [], identity: IDENTITY });
    expect(game.effects).toEqual([]);
    expect(toolboxEngine.getLifecycle(game.state)).toBe('setup');
  });
});

describe('toolbox dice', () => {
  it('rolls the target count, then reveals, holds and keeps held values on reroll', () => {
    const game = startWith(DEFAULT_TOOLBOX_CONFIG, ['a']);
    let cup = cupOf(game.state, 'a');
    game.expectReject(
      { type: 'toolbox.dice.toggleHold', dieId: 0, cupVersion: cup.version },
      TOOLBOX_REASONS.notRolled,
      'a',
    );
    game.send({ type: 'toolbox.dice.roll', cupVersion: cup.version }, 'a');
    cup = cupOf(game.state, 'a');
    expect(cup.stage).toBe('rolled');
    expect(cup.dice).toHaveLength(5);
    expect(cup.dice.every((die) => die.value >= 1 && die.value <= 6)).toBe(true);
    game.expectReject(
      { type: 'toolbox.dice.roll', cupVersion: cup.version },
      TOOLBOX_REASONS.rollBeforeReveal,
      'a',
    );
    game.send({ type: 'toolbox.dice.reveal', cupVersion: cup.version }, 'a');
    cup = cupOf(game.state, 'a');
    game.send({ type: 'toolbox.dice.toggleHold', dieId: 1, cupVersion: cup.version }, 'a');
    cup = cupOf(game.state, 'a');
    const heldValue = cup.dice[1]!.value;
    game.send({ type: 'toolbox.dice.roll', cupVersion: cup.version }, 'a');
    cup = cupOf(game.state, 'a');
    expect(cup.dice[1]).toEqual({ id: 1, value: heldValue, held: true });
  });

  it('applies a new count on the next roll, removing unheld dice right to left', () => {
    const game = startWith(DEFAULT_TOOLBOX_CONFIG, ['a']);
    const version = () => cupOf(game.state, 'a').version;
    game.send({ type: 'toolbox.dice.roll', cupVersion: version() }, 'a');
    game.send({ type: 'toolbox.dice.reveal', cupVersion: version() }, 'a');
    game.send({ type: 'toolbox.dice.toggleHold', dieId: 4, cupVersion: version() }, 'a');
    game.send({ type: 'toolbox.dice.setCount', count: 3, cupVersion: version() }, 'a');
    expect(cupOf(game.state, 'a').dice).toHaveLength(5);
    game.send({ type: 'toolbox.dice.roll', cupVersion: version() }, 'a');
    expect(cupOf(game.state, 'a').dice.map((die) => die.id)).toEqual([0, 1, 4]);
    game.send({ type: 'toolbox.dice.setCount', count: 4, cupVersion: version() }, 'a');
    game.send({ type: 'toolbox.dice.reveal', cupVersion: version() }, 'a');
    game.send({ type: 'toolbox.dice.roll', cupVersion: version() }, 'a');
    expect(cupOf(game.state, 'a').dice.map((die) => die.id)).toEqual([0, 1, 4, 5]);
  });

  it('refuses count and hold conflicts instead of adjusting them', () => {
    const game = startWith(DEFAULT_TOOLBOX_CONFIG, ['a']);
    const version = () => cupOf(game.state, 'a').version;
    game.send({ type: 'toolbox.dice.roll', cupVersion: version() }, 'a');
    game.send({ type: 'toolbox.dice.reveal', cupVersion: version() }, 'a');
    game.send({ type: 'toolbox.dice.toggleHold', dieId: 0, cupVersion: version() }, 'a');
    game.send({ type: 'toolbox.dice.toggleHold', dieId: 1, cupVersion: version() }, 'a');
    game.expectReject(
      { type: 'toolbox.dice.setCount', count: 1, cupVersion: version() },
      TOOLBOX_REASONS.heldExceedsCount,
      'a',
    );
    game.send({ type: 'toolbox.dice.setCount', count: 2, cupVersion: version() }, 'a');
    game.expectReject(
      { type: 'toolbox.dice.toggleHold', dieId: 2, cupVersion: version() },
      TOOLBOX_REASONS.holdLimit,
      'a',
    );
    game.expectReject(
      { type: 'toolbox.dice.setCount', count: 21, cupVersion: version() },
      TOOLBOX_REASONS.diceCountInvalid,
      'a',
    );
    game.expectReject(
      { type: 'toolbox.dice.roll', cupVersion: version() - 1 },
      TOOLBOX_REASONS.cupStale,
      'a',
    );
  });

  it('keeps spectators and identity-only sessions away from dice', () => {
    const game = startWith({ tools: ['identity'], identity: IDENTITY }, ['a']);
    game.expectReject(
      { type: 'toolbox.dice.roll', cupVersion: 0 },
      TOOLBOX_REASONS.diceDisabled,
      'a',
    );
    game.send({ type: 'toolbox.member.join' }, 'late');
    game.expectReject(
      { type: 'toolbox.dice.roll', cupVersion: 0 },
      TOOLBOX_REASONS.notParticipant,
      'late',
    );
  });
});

describe('toolbox identity deck', () => {
  it('draws from one shared deck without replacement until every quota is full', () => {
    const users = ['a', 'b', 'c', 'd', 'e'];
    const game = startWith({ tools: ['identity'], identity: IDENTITY }, users);
    const roundId = () => activePhase(game.state).identity!.roundId;
    for (const user of users)
      game.send({ type: 'toolbox.identity.draw', roundId: roundId() }, user);
    const round = activePhase(game.state).identity!;
    expect(round.remaining).toEqual([0, 0]);
    expect(round.hands.flatMap((hand) => hand.identityIndexes).sort()).toEqual([0, 0, 1, 1, 1]);
    game.expectReject(
      { type: 'toolbox.identity.draw', roundId: roundId() },
      TOOLBOX_REASONS.handFull,
      'a',
    );
  });

  it('restarts only the identity round, rejecting stale rounds and keeping dice', () => {
    const game = startWith({ tools: ['dice', 'identity'], identity: IDENTITY }, ['a']);
    game.send({ type: 'toolbox.dice.roll', cupVersion: 0 }, 'a');
    const cupBefore = cupOf(game.state, 'a');
    const firstRound = activePhase(game.state).identity!.roundId;
    game.send({ type: 'toolbox.identity.draw', roundId: firstRound }, 'a');
    const nextIdentity: ToolboxIdentityConfig = {
      identities: [{ name: '预言家', description: '', count: 1 }],
      cardsPerPlayer: 1,
    };
    game.expectReject(
      { type: 'toolbox.identity.restart', roundId: firstRound, identity: nextIdentity },
      TOOLBOX_REASONS.notHost,
      'a',
    );
    game.send({ type: 'toolbox.identity.restart', roundId: firstRound, identity: nextIdentity });
    const round = activePhase(game.state).identity!;
    expect(round.roundId).not.toBe(firstRound);
    expect(round.hands).toEqual([{ userId: 'a', identityIndexes: [] }]);
    expect(game.state.config.identity).toEqual(nextIdentity);
    expect(cupOf(game.state, 'a')).toEqual(cupBefore);
    game.expectReject(
      { type: 'toolbox.identity.draw', roundId: firstRound },
      TOOLBOX_REASONS.roundStale,
      'a',
    );
  });
});

describe('toolbox per-user view', () => {
  it('projects only public counts and the viewer own private state', () => {
    const game = startWith({ tools: ['dice', 'identity'], identity: IDENTITY }, ['a', 'b']);
    game.send({ type: 'toolbox.dice.roll', cupVersion: 0 }, 'a');
    game.send(
      { type: 'toolbox.identity.draw', roundId: activePhase(game.state).identity!.roundId },
      'a',
    );
    game.send({ type: 'toolbox.member.join' }, 'late');

    const own = parseToolboxView(
      JSON.parse(JSON.stringify(projectToolboxStateForUser(game.state, 'a'))),
    );
    if (own.phase.kind !== 'active' || own.phase.participation.kind !== 'participant') {
      throw new Error('expected participant view');
    }
    expect(own.phase.participation.dice?.stage).toBe('rolled');
    expect(own.phase.participation.hand).toHaveLength(1);
    expect(own.phase.identity?.remainingTotal).toBe(4);
    expect(own.memberCount).toBe(4);

    const other = projectToolboxStateForUser(game.state, 'b');
    if (other.phase.kind !== 'active' || other.phase.participation.kind !== 'participant') {
      throw new Error('expected participant view');
    }
    expect(other.phase.participation.dice?.stage).toBe('unrolled');
    expect(other.phase.participation.hand).toEqual([]);

    const spectator = projectToolboxStateForUser(game.state, 'late');
    expect(spectator.phase).toMatchObject({ participation: { kind: 'spectator' } });
    const serialized = JSON.stringify(spectator);
    expect(serialized).not.toContain('"remaining"');
    expect(serialized).not.toContain('"a"');
    expect(serialized).not.toContain('identityIndexes');
  });

  it('rejects a view that pretends a disabled tool has private state', () => {
    const game = startWith({ tools: ['identity'], identity: IDENTITY }, ['a']);
    const view = projectToolboxStateForUser(game.state, 'a');
    if (view.phase.kind !== 'active') throw new Error('expected active');
    expect(() =>
      parseToolboxView({
        ...view,
        phase: {
          ...view.phase,
          participation: { kind: 'participant', dice: null, hand: null },
        },
      }),
    ).toThrow(/hand/);
  });
});
