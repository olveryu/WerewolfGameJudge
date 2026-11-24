import {
  type GameState,
  GameStatus,
  getWerewolfViewModel,
  PRESET_TEMPLATES,
} from '@game-judge/game-engine/games/werewolf/public';

import type { RoomPlayerAction } from '@/features/room/model/RoomAction';
import type { RoomReviewEntry } from '@/features/room/review/roomReviewActions';
import type { StepInteraction } from '@/features/room/steps/useStepInteraction';

import {
  createWerewolfBoardInfoSections,
  createWerewolfPlayerActions,
  createWerewolfSeatDataSource,
  createWerewolfStepActionList,
  deriveWerewolfBottomProgress,
  deriveWerewolfSeatCounts,
} from '../werewolfRoomAdapter';
import { createEngineGame } from './harness/engineGame';

const REVIEW: RoomReviewEntry = { isEnabled: true, onPress: () => {} };
const EMPTY_STEP: StepInteraction = {
  message: null,
  progress: null,
  completionProgress: null,
  actions: [],
  seatSelection: null,
  onSeatTap: () => false,
  cardPicker: null,
};
const STEP_ACTION: RoomPlayerAction = {
  key: 'choose',
  label: '选择',
  audience: 'participant',
  category: 'player',
  state: { kind: 'ready', onPress: () => {} },
};

let activeNight: GameState;
beforeAll(() => {
  const preset = PRESET_TEMPLATES.find((candidate) => candidate.name === '预女猎白');
  if (preset === undefined) throw new Error('[FAIL-FAST] Missing room-adapter preset');
  activeNight = createEngineGame(
    preset.name,
    new Map(preset.roles.map((role, seat) => [seat, role])),
  ).getGameState();
});

function actionsFor(
  state: GameState,
  seat: number | null,
  isHost: boolean,
  options: {
    readonly isAudioPlaying?: boolean;
    readonly review?: RoomReviewEntry | null;
    readonly step?: StepInteraction;
  } = {},
) {
  const viewModel = getWerewolfViewModel(state, { seat, isHost });
  return createWerewolfStepActionList({
    viewModel,
    step: options.step ?? EMPTY_STEP,
    isHost,
    effectiveSeat: seat,
    isAudioPlaying: options.isAudioPlaying ?? false,
    review: options.review === undefined ? REVIEW : options.review,
    onViewRole: vi.fn(),
  });
}

describe('Werewolf seat data source', () => {
  it('marks the real wolf pack and a controlled seat without exposing it to a villager', () => {
    const wolfView = getWerewolfViewModel(activeNight, { seat: 4, isHost: false });
    const source = createWerewolfSeatDataSource({
      state: activeNight,
      viewModel: wolfView,
      controlledSeat: 2,
      sheriffElectionView: null,
      revision: 1,
    });
    expect(source.count).toBe(12);
    expect(source.getSeat(5).highlight).toBe('danger');
    expect(source.getSeat(2).highlight).toBe('controlled');
    expect(source.getSeat(4).isSelf).toBe(true);
    expect(source.getSeat(5)).toMatchObject({ showLevel: false, decorationsEnabled: false });
    expect(() => source.getSeat(12)).toThrow('out of range');

    const villagerView = getWerewolfViewModel(activeNight, { seat: 0, isHost: true });
    const villagerSource = createWerewolfSeatDataSource({
      state: activeNight,
      viewModel: villagerView,
      controlledSeat: null,
      sheriffElectionView: null,
      revision: 1,
    });
    expect(villagerSource.getSeat(5).highlight).toBe('none');
  });

  it('renders selected and available seats from the shared selection state', () => {
    const viewModel = getWerewolfViewModel(activeNight, { seat: 4, isHost: false });
    const source = createWerewolfSeatDataSource({
      state: activeNight,
      viewModel,
      controlledSeat: null,
      sheriffElectionView: null,
      revision: 1,
      seatSelection: {
        selected: [0],
        eligible: [0, 1],
        unavailableReasons: { 2: '不能选择自己' },
      },
    });
    expect(source.getSeat(0).indicators?.selection).toEqual({ kind: 'selected', label: null });
    expect(source.getSeat(1).indicators?.selection).toEqual({ kind: 'available', label: null });
    expect(source.getSeat(2).indicators?.selection).toBeUndefined();
    expect(source.getSeat(2)).toMatchObject({
      isSelectionUnavailable: true,
      disabledReason: '不能选择自己',
    });
  });

  it('shows a real wolf vote to the pack, but not to a non-wolf', () => {
    const preset = PRESET_TEMPLATES.find((candidate) => candidate.name === '预女猎白');
    if (preset === undefined) throw new Error('[FAIL-FAST] Missing room-adapter preset');
    const game = createEngineGame(
      preset.name,
      new Map(preset.roles.map((role, seat) => [seat, role])),
    );
    const current = game.getGameState().nightState?.slice.current;
    if (current == null) throw new Error('[FAIL-FAST] Missing wolf-vote step');
    game.submitStepOrThrow(5, { ...current, actionKey: 'wolfKill', seats: [0] }, 'vote');
    const state = game.getGameState();
    const packView = getWerewolfViewModel(state, { seat: 4, isHost: false });
    const packSource = createWerewolfSeatDataSource({
      state,
      viewModel: packView,
      controlledSeat: null,
      sheriffElectionView: null,
      revision: 1,
    });
    expect(packSource.getSeat(5).statusBadge).toMatchObject({ label: '袭击1号', tone: 'danger' });

    const villagerView = getWerewolfViewModel(state, { seat: 0, isHost: true });
    const villagerSource = createWerewolfSeatDataSource({
      state,
      viewModel: villagerView,
      controlledSeat: null,
      sheriffElectionView: null,
      revision: 1,
    });
    expect(villagerSource.getSeat(5).statusBadge).toBeNull();
  });

  it.each([
    [GameStatus.Unseated, true, true],
    [GameStatus.Seated, true, true],
    [GameStatus.Assigned, false, true],
    [GameStatus.Ready, false, true],
    [GameStatus.Ongoing, false, false],
    [GameStatus.Day, false, false],
    [GameStatus.Ended, false, true],
  ])('shows level and decorations appropriately in %s', (status, showLevel, decorationsEnabled) => {
    const state = { ...activeNight, status };
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
});

describe('Werewolf step actions', () => {
  it('shows identity access after dealing and hides it in the lobby', () => {
    expect(actionsFor({ ...activeNight, status: GameStatus.Seated }, 0, false).actions).toEqual([]);
    expect(
      actionsFor({ ...activeNight, status: GameStatus.Assigned }, 0, false).actions,
    ).toMatchObject([{ key: 'viewRole' }]);
  });

  it('groups multiple shared actions and hides all actions during narration', () => {
    const step: StepInteraction = {
      ...EMPTY_STEP,
      actions: [STEP_ACTION, { ...STEP_ACTION, key: 'skip' }],
    };
    const actions = actionsFor(activeNight, 4, false, { step });
    expect(actions.actions.map((action) => action.key)).toEqual(['viewRole']);
    expect(actions.group?.actions.map((action) => action.key)).toEqual(['choose', 'skip']);
    expect(actionsFor(activeNight, 4, false, { step, isAudioPlaying: true })).toEqual({
      actions: [],
      group: null,
    });
  });

  it('shows the shared selection controls without a separate action group', () => {
    const step: StepInteraction = {
      ...EMPTY_STEP,
      actions: [STEP_ACTION],
      seatSelection: { eligible: [0], selected: [], unavailableReasons: {} },
    };
    expect(actionsFor(activeNight, 4, false, { step })).toEqual({
      actions: [STEP_ACTION],
      group: null,
    });
  });

  it('preserves host, player, and spectator review access after the night', () => {
    const ended = { ...activeNight, status: GameStatus.Ended };
    expect(actionsFor(ended, 0, true).actions.map((action) => action.key)).toEqual(['viewRole']);
    expect(actionsFor(ended, 1, false).actions.map((action) => action.key)).toEqual([
      'viewRole',
      'review',
    ]);
    expect(actionsFor(ended, null, false).actions.map((action) => action.key)).toEqual(['review']);
    expect(() => actionsFor(ended, 1, false, { review: null })).toThrow(
      '[FAIL-FAST] Werewolf Ended has no review entry',
    );
    expect(actionsFor(ended, null, false, { isAudioPlaying: true }).actions).toEqual([]);
  });
});

describe('Werewolf room progress and board information', () => {
  it('derives the active night progress from the real plan', () => {
    const progress = deriveWerewolfBottomProgress(activeNight);
    expect(progress?.label).toBe('狼人');
    expect(deriveWerewolfBottomProgress({ ...activeNight, status: GameStatus.Day })).toBeNull();
  });

  it('groups board roles and counts the seated players', () => {
    const sections = createWerewolfBoardInfoSections(activeNight.templateRoles);
    expect(sections.map((section) => section.title)).toEqual(['狼人', '神职', '特殊', '村民']);
    expect(sections[0]?.items).toEqual([{ roleId: 'wolf', displayName: '狼人', count: 4 }]);
    expect(sections[3]?.items).toEqual([{ roleId: 'villager', displayName: '村民', count: 4 }]);
    expect(
      deriveWerewolfSeatCounts(
        activeNight,
        getWerewolfViewModel(activeNight, { seat: null, isHost: true }),
      ),
    ).toEqual({ seatedCount: 12, viewedCount: 12, totalSeats: 12 });
  });

  it('shows the actor’s countdown through the narration lock', () => {
    const viewModel = getWerewolfViewModel(activeNight, { seat: 4, isHost: false });
    const actions = actionsFor(activeNight, 4, false, { isAudioPlaying: true });
    const playerActions = createWerewolfPlayerActions({
      state: activeNight,
      viewModel,
      isHost: false,
      isAudioPlaying: true,
      actions,
      actionMessage: 'action',
      nightStatusLine: 'countdown',
      isStepActor: true,
      guideMessage: null,
      sheriffElectionPanel: null,
      openSheriffDetails: vi.fn(),
    });
    expect(playerActions.message).toBe('countdown');
  });
});
