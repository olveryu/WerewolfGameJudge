import { WEREWOLF_GAME_TYPE } from '../../protocol/gameTypes';
import type { BaseGameState } from '../../protocol/roomSnapshot';
import { defineGameEngineCatalog } from '../catalog';
import { commit, commitDomainRejection, reject } from '../decision';
import type {
  CommandOf,
  ConfigOf,
  EffectOf,
  EventOf,
  GameEngineDefinition,
  StateOf,
} from '../types';

interface CounterState extends BaseGameState<typeof WEREWOLF_GAME_TYPE> {
  readonly count: number;
}

interface CounterConfig {
  readonly initialCount: number;
}

interface IncrementCommand {
  readonly type: 'counter.increment';
  readonly amount: number;
}

interface IncrementedEvent {
  readonly type: 'counter.incremented';
  readonly amount: number;
}

interface AuditEffect {
  readonly type: 'counter.audit';
  readonly count: number;
}

const counterEngine = {
  gameType: WEREWOLF_GAME_TYPE,
  stateVersion: 1,
  createInitialState(config, context) {
    return {
      gameType: WEREWOLF_GAME_TYPE,
      stateVersion: 1,
      roomCode: context.roomCode,
      hostUserId: context.hostUserId,
      count: config.initialCount,
    };
  },
  decide(_state, command) {
    return commit<IncrementedEvent, AuditEffect>({
      events: [{ type: 'counter.incremented', amount: command.amount }],
    });
  },
  evolve(state, event) {
    return { ...state, count: state.count + event.amount };
  },
  normalize(state) {
    return state;
  },
  getLifecycle() {
    return 'ongoing' as const;
  },
} satisfies GameEngineDefinition<
  typeof WEREWOLF_GAME_TYPE,
  CounterState,
  CounterConfig,
  IncrementCommand,
  IncrementedEvent,
  AuditEffect
>;

function acceptState(_value: CounterState): void {}
function acceptConfig(_value: CounterConfig): void {}
function acceptCommand(_value: IncrementCommand): void {}
function acceptEvent(_value: IncrementedEvent): void {}
function acceptEffect(_value: AuditEffect): void {}

describe('typed game engine contract', () => {
  it('preserves every concrete engine type through extraction helpers', () => {
    const state: StateOf<typeof counterEngine> = counterEngine.createInitialState(
      { initialCount: 2 },
      { roomCode: '1234', hostUserId: 'host', nowMs: 10, commandId: 'create-1' },
    );
    const config: ConfigOf<typeof counterEngine> = { initialCount: 2 };
    const command: CommandOf<typeof counterEngine> = { type: 'counter.increment', amount: 3 };
    const event: EventOf<typeof counterEngine> = { type: 'counter.incremented', amount: 3 };
    const effect: EffectOf<typeof counterEngine> = { type: 'counter.audit', count: 5 };

    acceptState(state);
    acceptConfig(config);
    acceptCommand(command);
    acceptEvent(event);
    acceptEffect(effect);
    expect(counterEngine.evolve(state, event).count).toBe(5);
  });

  it('keeps accepted domain rejection distinct from zero-event rejection', () => {
    expect(
      commitDomainRejection('blocked', {
        events: [{ type: 'counter.incremented', amount: 0 } satisfies IncrementedEvent],
      }),
    ).toEqual({
      kind: 'commit',
      events: [{ type: 'counter.incremented', amount: 0 }],
      effects: [],
      broadcast: 'state',
      outcome: { kind: 'domainRejected', reason: 'blocked' },
    });
    expect(reject('not_host')).toEqual({ kind: 'reject', reason: 'not_host' });
  });

  it('retains concrete engines in an exhaustive catalog', () => {
    const catalog = defineGameEngineCatalog({ werewolf: counterEngine });

    expect(catalog.werewolf).toBe(counterEngine);
  });

  it('rejects incomplete, extra, and structurally invalid catalogs at compile time', () => {
    // @ts-expect-error canonical game key is required
    defineGameEngineCatalog({});
    // @ts-expect-error keys outside GameType are forbidden
    defineGameEngineCatalog({ werewolf: counterEngine, fibking: counterEngine });
    // @ts-expect-error a game identity without engine behavior is not a module
    defineGameEngineCatalog({ werewolf: { gameType: WEREWOLF_GAME_TYPE, stateVersion: 1 } });
  });
});
