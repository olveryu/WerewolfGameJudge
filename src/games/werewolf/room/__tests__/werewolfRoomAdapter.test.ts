/**
 * werewolfRoomAdapter: the projections onto the shared shell — seat data
 * source (highlight / badges / bot roles), night buttons per model kind,
 * bottom layout per status, progress ribbon, board info, seat counts.
 */
import {
  type GameState,
  GameStatus,
  getWerewolfViewModel,
  type RoleId,
  SCHEMAS,
} from '@game-judge/game-engine/games/werewolf/public';

import { nightState } from '../night/__tests__/nightFixtures';
import type { NightInteractionModel } from '../night/NightInteractionModel';
import { resolveNightInteraction } from '../night/resolveNightInteraction';
import {
  buildNightButtons,
  createWerewolfBoardInfoSections,
  createWerewolfBottomActionLayout,
  createWerewolfSeatDataSource,
  deriveWerewolfBottomProgress,
  deriveWerewolfSeatCounts,
  selectedNightSeats,
} from '../werewolfRoomAdapter';

const BOARD: readonly RoleId[] = ['wolf', 'wolf', 'seer', 'witch', 'hunter', 'villager'];
const IDLE: NightInteractionModel = { kind: 'idle' };

function nightModel(state: GameState, seat: number | null, isHost = false) {
  const viewModel = getWerewolfViewModel(state, { seat, isHost });
  const night = resolveNightInteraction({
    viewModel,
    draft: { firstSwapSeat: null, multiSelectedSeats: [] },
    swapSecondSeat: null,
    locks: { isAudioPlaying: false, hasPendingCommand: false },
    nowMs: 0,
  });
  return { viewModel, night };
}

function layoutFor(
  state: GameState,
  seat: number | null,
  isHost: boolean,
  options: { isAudioPlaying?: boolean; canOpenNightReview?: boolean } = {},
) {
  const { viewModel, night } = nightModel(state, seat, isHost);
  return createWerewolfBottomActionLayout({
    viewModel,
    night,
    isHost,
    effectiveSeat: seat,
    isAudioPlaying: options.isAudioPlaying ?? false,
    isActionSubmitting: false,
    canOpenNightReview: options.canOpenNightReview ?? isHost,
    onNightButton: jest.fn(),
    onViewRole: jest.fn(),
    onNightReview: jest.fn(),
  });
}

describe('createWerewolfSeatDataSource', () => {
  it('marks the wolf pack for a wolf, shows the vote badge and the controlled seat', () => {
    const state = nightState({
      roles: BOARD,
      stepId: 'wolfKill',
      overrides: { currentNightResults: { wolfVotesBySeat: { '1': 5 } } },
    });
    const { viewModel, night } = nightModel(state, 0);
    const source = createWerewolfSeatDataSource({
      state,
      viewModel,
      night,
      controlledSeat: 2,
      sheriffElectionView: null,
      revision: 1,
    });
    expect(source.count).toBe(6);
    expect(source.getSeat(1)).toMatchObject({
      highlight: 'danger',
      statusBadge: { label: '袭击6号', tone: 'danger' },
      showLevel: false,
      decorationsEnabled: false,
    });
    expect(source.getSeat(2).highlight).toBe('controlled');
    expect(source.getSeat(5).highlight).toBe('none');
    expect(source.getSeat(0).isSelf).toBe(true);
    expect(() => source.getSeat(6)).toThrow('out of range');
  });

  it('shows bot roles to the host only and the ready badge after viewing', () => {
    const base = nightState({ roles: BOARD, stepId: 'seerCheck' });
    const state: GameState = {
      ...base,
      status: GameStatus.Assigned,
      nightStep: null,
      roleViewedSeats: [0],
      roster: { ...base.roster, 5: { seat: 5, kind: 'bot' } },
    };
    const host = nightModel(state, 0, true);
    const hostSource = createWerewolfSeatDataSource({
      state,
      viewModel: host.viewModel,
      night: IDLE,
      controlledSeat: null,
      sheriffElectionView: null,
      revision: 1,
    });
    expect(hostSource.getSeat(5).secondaryLabel).toBe('平民');
    expect(hostSource.getSeat(5).player?.occupant).toEqual({ kind: 'bot', seat: 5 });
    expect(hostSource.getSeat(0).showReadyBadge).toBe(true);
    expect(hostSource.getSeat(1).showReadyBadge).toBe(false);
    expect(hostSource.getSeat(0).showLevel).toBe(true);

    const player = nightModel(state, 1, false);
    const playerSource = createWerewolfSeatDataSource({
      state,
      viewModel: player.viewModel,
      night: IDLE,
      controlledSeat: null,
      sheriffElectionView: null,
      revision: 1,
    });
    expect(playerSource.getSeat(5).secondaryLabel).toBeNull();
  });

  it('highlights the night draft picks', () => {
    const roles: readonly RoleId[] = ['wolf', 'wolf', 'seer', 'cupid', 'hunter', 'villager'];
    const state = nightState({ roles, stepId: 'cupidChooseLovers' });
    const viewModel = getWerewolfViewModel(state, { seat: 3, isHost: false });
    const night = resolveNightInteraction({
      viewModel,
      draft: { firstSwapSeat: null, multiSelectedSeats: [0, 5] },
      swapSecondSeat: null,
      locks: { isAudioPlaying: false, hasPendingCommand: false },
      nowMs: 0,
    });
    expect(selectedNightSeats(night)).toEqual([0, 5]);
    const source = createWerewolfSeatDataSource({
      state,
      viewModel,
      night,
      controlledSeat: null,
      sheriffElectionView: null,
      revision: 1,
    });
    expect(source.getSeat(0).highlight).toBe('selected');
    expect(source.getSeat(5).highlight).toBe('selected');
    expect(source.getSeat(1).highlight).toBe('none');
  });
});

describe('buildNightButtons', () => {
  it('offers skip for a skippable pick and nothing for idle / reveal acks', () => {
    const seer = nightModel(nightState({ roles: BOARD, stepId: 'seerCheck' }), 2).night;
    expect(buildNightButtons(seer).map((button) => [button.key, button.label])).toEqual([
      ['skip', '不用技能'],
    ]);
    expect(buildNightButtons(IDLE)).toEqual([]);
  });

  it('offers the empty vote and, once voted, the withdraw for a wolf', () => {
    const fresh = nightModel(nightState({ roles: BOARD, stepId: 'wolfKill' }), 0).night;
    expect(buildNightButtons(fresh).map((button) => button.action.kind)).toEqual(['emptyVote']);
    const voted = nightModel(
      nightState({
        roles: BOARD,
        stepId: 'wolfKill',
        overrides: { currentNightResults: { wolfVotesBySeat: { '0': 5 } } },
      }),
      0,
    ).night;
    expect(buildNightButtons(voted).map((button) => button.action.kind)).toEqual([
      'withdrawVote',
      'emptyVote',
    ]);
  });

  it('offers save + skip for a witch with an antidote target, and the status opener for a hunter', () => {
    const witch = nightModel(
      nightState({
        roles: BOARD,
        stepId: 'witchAction',
        overrides: { witchContext: { killedSeat: 0, canSave: true, canPoison: true } },
      }),
      3,
    ).night;
    expect(buildNightButtons(witch).map((button) => [button.action.kind, button.label])).toEqual([
      ['save', '对1号用解药'],
      ['skip', '不用技能'],
    ]);
    const hunter = nightModel(
      nightState({
        roles: BOARD,
        stepId: 'hunterConfirm',
        overrides: { confirmStatus: { role: 'hunter', canShoot: true } },
      }),
      4,
    ).night;
    expect(buildNightButtons(hunter)).toEqual([
      expect.objectContaining({ action: { kind: 'openStatus' }, label: '发动状态' }),
    ]);
  });

  it('templates the multi-select confirm count and hides it with nothing picked', () => {
    const roles: readonly RoleId[] = ['wolf', 'wolf', 'seer', 'cupid', 'hunter', 'villager'];
    const state = nightState({ roles, stepId: 'cupidChooseLovers' });
    const viewModel = getWerewolfViewModel(state, { seat: 3, isHost: false });
    const picked = resolveNightInteraction({
      viewModel,
      draft: { firstSwapSeat: null, multiSelectedSeats: [0, 5] },
      swapSecondSeat: null,
      locks: { isAudioPlaying: false, hasPendingCommand: false },
      nowMs: 0,
    });
    const schema = SCHEMAS.cupidChooseLovers;
    if (schema.kind !== 'multiChooseSeat') throw new Error('cupidChooseLovers is multiChooseSeat');
    const labels = buildNightButtons(picked).map((button) => button.label);
    expect(labels[0]).toBe(schema.ui!.confirmButtonText!.replace('{count}', '2'));
    const empty = nightModel(state, 3).night;
    expect(buildNightButtons(empty).some((button) => button.key === 'multiConfirm')).toBe(false);
  });
});

describe('createWerewolfBottomActionLayout', () => {
  const night = nightState({ roles: BOARD, stepId: 'seerCheck' });

  it('shows nothing in the lobby and the identity button once dealt', () => {
    const lobby: GameState = { ...night, status: GameStatus.Seated, nightStep: null };
    expect(layoutFor(lobby, 0, false)).toEqual({ primary: [], secondary: [], ghost: [] });
    const assigned: GameState = { ...night, status: GameStatus.Assigned, nightStep: null };
    expect(layoutFor(assigned, 0, false).primary.map((button) => button.key)).toEqual(['viewRole']);
    expect(layoutFor(assigned, null, false).primary).toEqual([]);
  });

  it('hides every button while narration plays and keeps the identity button at night', () => {
    expect(layoutFor(night, 2, false, { isAudioPlaying: true })).toEqual({
      primary: [],
      secondary: [],
      ghost: [],
    });
    const seer = layoutFor(night, 2, false);
    expect(seer.secondary.map((button) => button.key)).toEqual(['skip', 'viewRole']);
    const bystander = layoutFor(night, 5, false);
    expect(bystander.secondary.map((button) => button.key)).toEqual(['viewRole']);
  });

  it('gives spectators the review as primary and shared seats a ghost tool; the host uses the panel', () => {
    const ended: GameState = { ...night, status: GameStatus.Ended, nightStep: null };
    expect(layoutFor(ended, null, false).primary.map((button) => button.key)).toEqual([
      'nightReview',
    ]);
    const host = layoutFor(ended, 0, true);
    expect(host.secondary.map((button) => button.key)).toEqual(['viewRole']);
    expect(host.ghost).toEqual([]);
    const shared = layoutFor(ended, 1, false, { canOpenNightReview: true });
    expect(shared.ghost.map((button) => button.key)).toEqual(['nightReview']);
    expect(layoutFor(ended, 1, false, { canOpenNightReview: false }).ghost).toEqual([]);
  });
});

describe('progress, board info and counts', () => {
  it('derives the step ribbon only during a live step', () => {
    const state = nightState({ roles: BOARD, stepId: 'seerCheck' });
    const progress = deriveWerewolfBottomProgress(state);
    expect(progress).not.toBeNull();
    expect(progress?.label).toBe('预言家');
    expect(deriveWerewolfBottomProgress({ ...state, nightStep: null })).toBeNull();
  });

  it('groups the template by faction and collapses plain villagers to one counted item', () => {
    const sections = createWerewolfBoardInfoSections([
      'wolf',
      'wolf',
      'seer',
      'villager',
      'villager',
    ]);
    expect(sections.map((section) => section.title)).toEqual(['狼人', '神职', '特殊', '村民']);
    expect(sections[0]?.items).toEqual([{ roleId: 'wolf', displayName: '狼人', count: 2 }]);
    expect(sections[3]?.items).toEqual([{ roleId: 'villager', displayName: '村民', count: 2 }]);
  });

  it('counts seats, not roles, on a bottom-card board', () => {
    const roles: readonly RoleId[] = ['wolf', 'wolf', 'seer', 'thief'];
    const state = nightState({ roles, stepId: 'thiefChoose' });
    // thief adds two bottom cards: 6 roles on the board, 4 seats at the table
    const bottomCardBoard: GameState = {
      ...state,
      templateRoles: [...roles, 'villager', 'villager'],
    };
    expect(
      deriveWerewolfSeatCounts(
        bottomCardBoard,
        getWerewolfViewModel(bottomCardBoard, { seat: null, isHost: true }),
      ).totalSeats,
    ).toBe(4);
  });

  it('counts seated, viewed and total seats for the host panel', () => {
    const state = nightState({
      roles: BOARD,
      stepId: 'seerCheck',
      overrides: { roleViewedSeats: [0, 1] },
    });
    expect(
      deriveWerewolfSeatCounts(state, getWerewolfViewModel(state, { seat: null, isHost: true })),
    ).toEqual({
      seatedCount: 6,
      viewedCount: 2,
      totalSeats: 6,
    });
  });
});
