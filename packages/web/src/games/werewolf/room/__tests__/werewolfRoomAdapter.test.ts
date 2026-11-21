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

import type { RoomReviewEntry } from '@/features/room/review/roomReviewActions';

import { nightState } from '../night/__tests__/nightFixtures';
import type { NightInteractionModel } from '../night/NightInteractionModel';
import { describeNightSeatSelection, type NightSeatSelection } from '../night/nightSeatSelection';
import { resolveNightInteraction } from '../night/resolveNightInteraction';
import { buildWerewolfGuideMessage } from '../werewolfGuideMessage';
import {
  buildNightButtons,
  createWerewolfBoardInfoSections,
  createWerewolfBottomActionLayout,
  createWerewolfBottomActions,
  createWerewolfSeatDataSource,
  deriveWerewolfBottomProgress,
  deriveWerewolfSeatCounts,
} from '../werewolfRoomAdapter';

const ENABLED_REVIEW: RoomReviewEntry = { isEnabled: true, onPress: () => {} };

const BOARD: readonly RoleId[] = ['wolf', 'wolf', 'seer', 'witch', 'hunter', 'villager'];
const IDLE: NightInteractionModel = { kind: 'idle' };

function nightModel(state: GameState, seat: number | null, isHost = false) {
  const viewModel = getWerewolfViewModel(state, { seat, isHost });
  const night = resolveNightInteraction({
    viewModel,
    locks: { isAudioPlaying: false, hasPendingCommand: false },
    nowMs: 0,
  });
  return { viewModel, night };
}

function layoutFor(
  state: GameState,
  seat: number | null,
  isHost: boolean,
  options: {
    isAudioPlaying?: boolean;
    review?: RoomReviewEntry | null;
    night?: NightInteractionModel;
    seatSelection?: NightSeatSelection | null;
  } = {},
) {
  const { viewModel, night } = nightModel(state, seat, isHost);
  return createWerewolfBottomActionLayout({
    viewModel,
    night: options.night ?? night,
    seatSelection: options.seatSelection,
    isHost,
    effectiveSeat: seat,
    isAudioPlaying: options.isAudioPlaying ?? false,
    isActionSubmitting: false,
    review: options.review === undefined ? ENABLED_REVIEW : options.review,
    onNightButton: vi.fn(),
    onViewRole: vi.fn(),
  });
}

describe('createWerewolfSeatDataSource', () => {
  it('marks the wolf pack for a wolf, shows the vote badge and the controlled seat', () => {
    const state = nightState({
      roles: BOARD,
      stepId: 'wolfKill',
      overrides: { currentNightResults: { wolfVotesBySeat: { '1': 5 } } },
    });
    const { viewModel } = nightModel(state, 0);
    const source = createWerewolfSeatDataSource({
      state,
      viewModel,
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
      controlledSeat: null,
      sheriffElectionView: null,
      revision: 1,
    });
    expect(hostSource.getSeat(5).secondaryLabel).toBe('平民');
    expect(hostSource.getSeat(5).player?.occupant).toEqual({ kind: 'bot', seat: 5 });
    expect(hostSource.getSeat(0).showReadyBadge).toBe(true);
    expect(hostSource.getSeat(1).showReadyBadge).toBe(false);
    expect(hostSource.getSeat(0).showLevel).toBe(false);

    const player = nightModel(state, 1, false);
    const playerSource = createWerewolfSeatDataSource({
      state,
      viewModel: player.viewModel,
      controlledSeat: null,
      sheriffElectionView: null,
      revision: 1,
    });
    expect(playerSource.getSeat(5).secondaryLabel).toBeNull();
  });

  it.each([
    [GameStatus.Unseated, true, true],
    [GameStatus.Seated, true, true],
    [GameStatus.Assigned, false, true],
    [GameStatus.Ready, false, true],
    [GameStatus.Ongoing, false, false],
    [GameStatus.Day, false, false],
    [GameStatus.Ended, false, true],
  ])('shows levels only before roles are dealt (%s)', (status, showLevel, decorationsEnabled) => {
    const base = nightState({ roles: BOARD, stepId: 'seerCheck' });
    const state: GameState = { ...base, status };
    const viewModel = getWerewolfViewModel(state, { seat: 0, isHost: true });
    const source = createWerewolfSeatDataSource({
      state,
      viewModel,
      controlledSeat: null,
      sheriffElectionView: null,
      revision: 1,
    });

    expect(source.getSeat(0)).toMatchObject({ showLevel, decorationsEnabled });
  });

  it('highlights the night draft picks', () => {
    const roles: readonly RoleId[] = ['wolf', 'wolf', 'seer', 'cupid', 'hunter', 'villager'];
    const state = nightState({ roles, stepId: 'cupidChooseLovers' });
    const viewModel = getWerewolfViewModel(state, { seat: 3, isHost: false });
    const night = resolveNightInteraction({
      viewModel,
      locks: { isAudioPlaying: false, hasPendingCommand: false },
      nowMs: 0,
    });
    const source = createWerewolfSeatDataSource({
      state,
      viewModel,
      seatSelection: describeNightSeatSelection(night, [0, 5]),
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
    const emptyVoteLabel = SCHEMAS.wolfKill.ui?.emptyVoteText;
    if (emptyVoteLabel === undefined) throw new Error('wolfKill is missing emptyVoteText');
    expect(
      buildNightButtons(fresh).map((button) => [button.action.kind, button.tier, button.label]),
    ).toEqual([['emptyVote', 'secondary', emptyVoteLabel]]);
    const voted = nightModel(
      nightState({
        roles: BOARD,
        stepId: 'wolfKill',
        overrides: { currentNightResults: { wolfVotesBySeat: { '0': 5 } } },
      }),
      0,
    ).night;
    expect(
      buildNightButtons(voted).map((button) => [button.action.kind, button.tier, button.label]),
    ).toEqual([
      ['withdrawVote', 'secondary', '取消投票'],
      ['emptyVote', 'secondary', emptyVoteLabel],
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

  it('offers confirmation only once the required targets have been selected', () => {
    const roles: readonly RoleId[] = ['wolf', 'wolf', 'seer', 'cupid', 'hunter', 'villager'];
    const state = nightState({ roles, stepId: 'cupidChooseLovers' });
    const { night } = nightModel(state, 3);
    expect(describeNightSeatSelection(night, [0])?.confirm).toBeNull();
    expect(describeNightSeatSelection(night, [0, 5])?.confirm?.label).toBe('确认连接情侣 1号、6号');
  });
});

describe('createWerewolfBottomActionLayout', () => {
  const night = nightState({ roles: BOARD, stepId: 'seerCheck' });

  it('shows nothing in the lobby and the identity button once dealt', () => {
    const lobby: GameState = { ...night, status: GameStatus.Seated, nightStep: null };
    expect(layoutFor(lobby, 0, false)).toEqual({ primary: [], secondary: [], ghost: [] });
    const assigned: GameState = { ...night, status: GameStatus.Assigned, nightStep: null };
    expect(layoutFor(assigned, 0, false).primary.map((button) => button.key)).toEqual(['viewRole']);
    expect(layoutFor({ ...assigned, roleViewedSeats: [] }, 0, false).primary[0]).toMatchObject({
      isPending: true,
    });
    expect(layoutFor({ ...assigned, roleViewedSeats: [0] }, 0, false).primary[0]).toMatchObject({
      isPending: false,
    });
    expect(layoutFor(assigned, null, false).primary).toEqual([]);
  });

  it('hides every button while narration plays and keeps the identity button at night', () => {
    expect(layoutFor(night, 2, false, { isAudioPlaying: true })).toEqual({
      primary: [],
      secondary: [],
      ghost: [],
    });
    const seer = layoutFor(night, 2, false);
    expect(seer.primary).toMatchObject([{ key: 'openActionGroup', isPending: true }]);
    expect(seer.secondary.map((button) => button.key)).toEqual(['viewRole']);
    const bystander = layoutFor(night, 5, false);
    expect(bystander.secondary.map((button) => button.key)).toEqual(['viewRole']);
  });

  it('marks a required single seat action, but not its selection controls', () => {
    const roles: readonly RoleId[] = ['wolf', 'wolf', 'seer', 'wildChild', 'hunter', 'villager'];
    const state = nightState({ roles, stepId: 'wildChildChooseIdol' });
    const { night: interaction } = nightModel(state, 3);
    expect(layoutFor(state, 3, false).primary).toMatchObject([
      { key: 'startSeatSelection', isPending: true },
    ]);
    const selection = describeNightSeatSelection(interaction, [0]);
    expect(selection).not.toBeNull();
    const selecting = layoutFor(state, 3, false, { seatSelection: selection });
    expect(
      [...selecting.primary, ...selecting.secondary].map((button) => button.isPending),
    ).toEqual([undefined, undefined]);
  });

  it('marks skipping as pending when there are no eligible targets', () => {
    const state = nightState({ roles: BOARD, stepId: 'seerCheck' });
    const { night: interaction } = nightModel(state, 2);
    if (interaction.kind !== 'pickSeat') throw new Error('Expected seat selection');
    expect(
      layoutFor(state, 2, false, { night: { ...interaction, selectable: [] } }).secondary[0],
    ).toMatchObject({ key: 'skip', isPending: true });
  });

  it('marks only outstanding single-action acknowledgements', () => {
    const hunter = nightState({
      roles: BOARD,
      stepId: 'hunterConfirm',
      overrides: { confirmStatus: { role: 'hunter', canShoot: true } },
    });
    expect(layoutFor(hunter, 4, false).primary).toMatchObject([
      { key: 'confirm', isPending: true },
    ]);

    const roles: readonly RoleId[] = ['wolf', 'wolf', 'seer', 'cupid', 'hunter', 'villager'];
    const state = nightState({
      roles,
      stepId: 'cupidLoversReveal',
      overrides: { loverSeats: [0, 5] },
    });
    const { night: interaction } = nightModel(state, 0);
    if (interaction.kind !== 'ackGroupReveal') throw new Error('Expected group reveal');
    expect(layoutFor(state, 0, false).primary).toMatchObject([
      { key: 'groupConfirmAck', isPending: true },
    ]);
    expect(
      layoutFor(state, 0, false, { night: { ...interaction, hasAcked: true } }).primary[0]
        ?.isPending,
    ).toBeUndefined();
  });

  it('marks a multiple-choice entry but not a completed wolf vote', () => {
    const witch = nightState({
      roles: BOARD,
      stepId: 'witchAction',
      overrides: { witchContext: { killedSeat: 0, canSave: true, canPoison: true } },
    });
    const choices = layoutFor(witch, 3, false);
    expect(choices.primary).toMatchObject([{ key: 'openActionGroup', isPending: true }]);

    const state = nightState({ roles: BOARD, stepId: 'wolfKill' });
    const { night: interaction } = nightModel(state, 0);
    if (interaction.kind !== 'wolfVote') throw new Error('Expected wolf vote');
    expect(layoutFor(state, 0, false, { night: interaction }).primary[0]).toMatchObject({
      key: 'openActionGroup',
      isPending: true,
    });
    expect(
      layoutFor(state, 0, false, { night: { ...interaction, myVote: 5 } }).primary[0]?.isPending,
    ).toBeUndefined();
    expect(
      layoutFor(state, 0, false, { night: { ...interaction, myVote: null } }).primary[0]?.isPending,
    ).toBe(true);
    const onlyEmpty = { ...interaction, emptyVoteOnly: true };
    expect(layoutFor(state, 0, false, { night: onlyEmpty }).secondary).toMatchObject([
      { key: 'wolfEmpty', isPending: true },
      { key: 'viewRole' },
    ]);
    expect(
      layoutFor(state, 0, false, { night: { ...onlyEmpty, myVote: -1 } }).secondary[0]?.isPending,
    ).toBeUndefined();
  });

  it('hides every button, spectators included, while the night-end announcement plays in Day and Ended', () => {
    const viewers: ReadonlyArray<readonly [number | null, boolean]> = [
      [0, true],
      [1, false],
      [null, false],
    ];
    for (const status of [GameStatus.Day, GameStatus.Ended]) {
      const state: GameState = { ...night, status, nightStep: null };
      for (const [seat, isHost] of viewers) {
        expect(layoutFor(state, seat, isHost, { isAudioPlaying: true })).toEqual({
          primary: [],
          secondary: [],
          ghost: [],
        });
      }
    }
  });

  it('shows the Day and Ended buttons again once the announcement ends', () => {
    const day: GameState = { ...night, status: GameStatus.Day, nightStep: null };
    expect(layoutFor(day, 0, true).secondary.map((button) => button.key)).toEqual(['viewRole']);
    expect(layoutFor(day, null, false).primary.map((button) => button.key)).toEqual(['review']);
    const ended: GameState = { ...night, status: GameStatus.Ended, nightStep: null };
    expect(layoutFor(ended, 1, false).ghost.map((button) => button.key)).toEqual(['review']);
  });

  it('gives every ended non-host the enabled review tool; the host uses the panel', () => {
    const ended: GameState = { ...night, status: GameStatus.Ended, nightStep: null };
    expect(layoutFor(ended, null, false).primary).toMatchObject([
      { key: 'review', audience: 'anyone', variant: 'primary', isEnabled: true },
    ]);
    const host = layoutFor(ended, 0, true);
    expect(host.secondary.map((button) => button.key)).toEqual(['viewRole']);
    expect(host.ghost).toEqual([]);
    expect(layoutFor(ended, 1, false).ghost).toMatchObject([
      { key: 'review', variant: 'ghost', isEnabled: true },
    ]);
    const day: GameState = { ...night, status: GameStatus.Day, nightStep: null };
    // Day privacy remains in place for a seat the host has not granted.
    expect(
      layoutFor(day, 1, false, {
        review: { isEnabled: false, disabledReason: '房主尚未向你开放复盘' },
      }).ghost,
    ).toMatchObject([{ key: 'review', isEnabled: false, disabledReason: '房主尚未向你开放复盘' }]);
  });

  it('fails fast when Day or Ended has no review entry', () => {
    const ended: GameState = { ...night, status: GameStatus.Ended, nightStep: null };
    expect(() => layoutFor(ended, 1, false, { review: null })).toThrow(
      '[FAIL-FAST] Werewolf Ended has no review entry',
    );
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

describe('createWerewolfBottomActions', () => {
  function bottomActions(
    state: GameState,
    options: { isAudioPlaying: boolean; nightStatusLine: string | null },
  ) {
    const viewModel = getWerewolfViewModel(state, { seat: 0, isHost: false });
    const night = resolveNightInteraction({
      viewModel,
      locks: { isAudioPlaying: options.isAudioPlaying, hasPendingCommand: false },
      nowMs: 0,
    });
    const layout = createWerewolfBottomActionLayout({
      viewModel,
      night,
      isHost: false,
      effectiveSeat: 0,
      isAudioPlaying: options.isAudioPlaying,
      isActionSubmitting: false,
      review: null,
      onNightButton: vi.fn(),
      onViewRole: vi.fn(),
    });
    return createWerewolfBottomActions({
      state,
      viewModel,
      isHost: false,
      isAudioPlaying: options.isAudioPlaying,
      layout,
      actionMessage: 'action',
      nightStatusLine: options.nightStatusLine,
      guideMessage: buildWerewolfGuideMessage({
        isHost: false,
        roomStatus: viewModel.status,
        mySeat: 0,
        viewModel,
      }),
      sheriffElectionPanel: null,
      isSheriffInspectorVisible: false,
      openSheriffDetails: vi.fn(),
    });
  }

  const state = () => nightState({ roles: BOARD, stepId: 'wolfKill' });

  it('shows the countdown line while audio playback locks the message', () => {
    const model = bottomActions(state(), {
      isAudioPlaying: true,
      nightStatusLine: '1/2 狼人已确认（5秒后确认）',
    });
    expect(model.kind).toBe('stacked');
    if (model.kind !== 'stacked') throw new Error('Expected a stacked bottom model');
    expect(model.message).toBe('1/2 狼人已确认（5秒后确认）');
  });

  it('shows nothing while audio playback locks the message without a countdown', () => {
    const model = bottomActions(state(), { isAudioPlaying: true, nightStatusLine: null });
    expect(model.kind).toBe('stacked');
    if (model.kind !== 'stacked') throw new Error('Expected a stacked bottom model');
    expect(model.message).toBeNull();
  });

  it('shows the action message once audio playback ends', () => {
    const model = bottomActions(state(), {
      isAudioPlaying: false,
      nightStatusLine: '1/2 狼人已确认（5秒后确认）',
    });
    expect(model.kind).toBe('stacked');
    if (model.kind !== 'stacked') throw new Error('Expected a stacked bottom model');
    expect(model.message).toBe('action');
  });
});
