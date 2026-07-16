import { WEREWOLF_STATE_IDENTITY } from '../../../state/version';
import { GameStatus } from '../../models';
import type { GameState } from '../../protocol/types';
import { assertWerewolfStateInvariants } from '../assertStateInvariants';

function createTreasureMasterState(overrides: Partial<GameState> = {}): GameState {
  return {
    ...WEREWOLF_STATE_IDENTITY,
    roomCode: 'ROOM',
    hostUserId: 'host',
    status: GameStatus.Assigned,
    templateRoles: ['treasureMaster', 'wolf', 'seer', 'villager'],
    players: {
      0: {
        userId: 'host',
        seat: 0,
        role: 'treasureMaster',
        hasViewedRole: false,
      },
    },
    roster: {},
    currentStepIndex: -1,
    isAudioPlaying: false,
    actions: [],
    pendingRevealAcks: [],
    hypnotizedSeats: [],
    piperRevealAcks: [],
    conversionRevealAcks: [],
    bottomCards: ['wolf', 'seer', 'villager'],
    treasureMasterSeat: 0,
    cupidLoversRevealAcks: [],
    ...overrides,
  };
}

function createThiefState(overrides: Partial<GameState> = {}): GameState {
  return {
    ...createTreasureMasterState(),
    templateRoles: ['thief', 'wolf', 'seer'],
    players: {
      0: { userId: 'host', seat: 0, role: 'thief', hasViewedRole: false },
    },
    bottomCards: ['wolf', 'seer'],
    treasureMasterSeat: undefined,
    thiefSeat: 0,
    ...overrides,
  };
}

describe('assertWerewolfStateInvariants', () => {
  it('accepts canonical assigned and ongoing bottom-card states', () => {
    expect(() => assertWerewolfStateInvariants(createTreasureMasterState())).not.toThrow();
    expect(() =>
      assertWerewolfStateInvariants(
        createThiefState({
          status: GameStatus.Ongoing,
          currentNightResults: { thiefChosenCard: 'wolf' },
        }),
      ),
    ).not.toThrow();
  });

  it('requires currentNightResults exactly during ongoing and ended states', () => {
    expect(() =>
      assertWerewolfStateInvariants(createTreasureMasterState({ status: GameStatus.Ongoing })),
    ).toThrow('Ongoing state has no currentNightResults');
    expect(() =>
      assertWerewolfStateInvariants(createTreasureMasterState({ currentNightResults: {} })),
    ).toThrow('Assigned state contains currentNightResults');
  });

  it('requires a legal deck and the matching seated actor after assignment', () => {
    expect(() =>
      assertWerewolfStateInvariants(createTreasureMasterState({ bottomCards: undefined })),
    ).toThrow('deal has no bottomCards');
    expect(() =>
      assertWerewolfStateInvariants(
        createTreasureMasterState({ bottomCards: ['wolf', 'seer', 'witch'] }),
      ),
    ).toThrow('bottomCards violate the canonical deck rules');
    expect(() =>
      assertWerewolfStateInvariants(createTreasureMasterState({ treasureMasterSeat: 1 })),
    ).toThrow('actor seat 1 is empty');
  });

  it('requires assigned identities and bottom cards to reconstruct the deal pool', () => {
    expect(() =>
      assertWerewolfStateInvariants(
        createTreasureMasterState({
          templateRoles: ['treasureMaster', 'wolf', 'seer', 'villager', 'witch'],
          players: {
            0: {
              userId: 'host',
              seat: 0,
              role: 'treasureMaster',
              hasViewedRole: false,
            },
            1: { userId: 'p1', seat: 1, role: 'seer', hasViewedRole: false },
          },
        }),
      ),
    ).toThrow('assigned roles and bottomCards do not match the role deal pool at seer');
  });

  it('rejects a chosen card outside the deck or from the forbidden faction', () => {
    expect(() =>
      assertWerewolfStateInvariants(
        createTreasureMasterState({
          status: GameStatus.Ongoing,
          currentNightResults: { treasureMasterChosenCard: 'witch' },
        }),
      ),
    ).toThrow('which is not in bottomCards');
    expect(() =>
      assertWerewolfStateInvariants(
        createTreasureMasterState({
          status: GameStatus.Ongoing,
          currentNightResults: { treasureMasterChosenCard: 'wolf' },
        }),
      ),
    ).toThrow('is a wolf-faction card');
  });

  it('requires thief to choose the wolf-faction card when one is present', () => {
    expect(() =>
      assertWerewolfStateInvariants(
        createThiefState({
          status: GameStatus.Ongoing,
          currentNightResults: { thiefChosenCard: 'seer' },
        }),
      ),
    ).toThrow('must be the wolf-faction card');
  });

  it('rejects state owned by the other bottom-card actor', () => {
    expect(() =>
      assertWerewolfStateInvariants(
        createTreasureMasterState({
          status: GameStatus.Ongoing,
          currentNightResults: { thiefChosenCard: 'wolf' },
        }),
      ),
    ).toThrow('also contains thiefChosenCard');
  });

  it('removes treasure-master runtime state in plague mode but keeps thief deals valid', () => {
    const plagueTreasureMasterState = createTreasureMasterState({
      rules: { isPlagueMode: true },
      players: {
        0: { userId: 'host', seat: 0, role: 'villager', hasViewedRole: false },
      },
      bottomCards: undefined,
      treasureMasterSeat: undefined,
    });
    expect(() => assertWerewolfStateInvariants(plagueTreasureMasterState)).not.toThrow();
    expect(() =>
      assertWerewolfStateInvariants(createTreasureMasterState({ rules: { isPlagueMode: true } })),
    ).toThrow('bottomCards exist without an active bottom-card deal');

    expect(() =>
      assertWerewolfStateInvariants(
        createThiefState({
          rules: { isPlagueMode: true },
          bottomCards: ['villager', 'seer'],
        }),
      ),
    ).not.toThrow();
  });
});
