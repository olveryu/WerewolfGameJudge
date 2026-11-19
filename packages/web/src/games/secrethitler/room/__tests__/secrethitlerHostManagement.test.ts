import {
  SECRETHITLER_PHASES,
  type SecrethitlerState,
} from '@game-judge/game-engine/games/secrethitler/public';

import { applyAudioPlaybackLock } from '@/features/room/model/audioPlaybackLock';
import {
  buildSecrethitlerPhaseStates,
  buildSecrethitlerTestLobby,
  sendSecrethitlerSeatCommand,
  startSecrethitlerTestGame,
} from '@/test-utils/secrethitlerState';
import { showDestructiveAlert } from '@/utils/alertPresets';

import { createSecrethitlerHostManagement } from '../secrethitlerRoomAdapter';

vi.mock('@/utils/alertPresets', () => ({
  showConfirmAlert: vi.fn(),
  showDestructiveAlert: vi.fn(),
}));

const submit = vi.fn(async () => true);
const music = vi.fn();
const phases = buildSecrethitlerPhaseStates();
const denied = { isAllowed: false, reason: null } as const;

function model(state: SecrethitlerState, isSubmitting = false) {
  return createSecrethitlerHostManagement({
    state,
    isSubmitting,
    submit,
    onMusicSettings: music,
    review: state.phase.kind === 'ended' ? { isEnabled: true, onPress: vi.fn() } : null,
    capabilities: {
      canConfigureGame: denied,
      canFillBots: denied,
      canClearSeats: denied,
      canShareRoom: denied,
    },
  });
}

function stateFor(phase: SecrethitlerState['phase']['kind']) {
  const state = phases.get(phase);
  if (state === undefined) throw new Error(`Missing ${phase}`);
  return state;
}

it.each(SECRETHITLER_PHASES)('preserves the host action inventory in %s', (phase) => {
  const panel = model(stateFor(phase));
  const keys = panel.sections.flatMap((section) => section.actions.map((action) => action.key));
  expect(keys.includes('restart')).toBe(phase !== 'lobby');
  expect(keys.includes('music-settings')).toBe(['lobby', 'viewing'].includes(phase));
  expect(panel.sections.every((section) => section.actions.length > 0)).toBe(true);
});

it('dispatches restart only after confirmation', async () => {
  submit.mockClear();
  const state = stateFor('election');
  const restart = model(state)
    .sections.flatMap((section) => section.actions)
    .find((action) => action.key === 'restart');
  if (!restart?.isEnabled) throw new Error('Missing restart');
  restart.onPress();
  expect(submit).not.toHaveBeenCalled();
  const confirmation = vi.mocked(showDestructiveAlert).mock.calls.at(-1);
  if (confirmation === undefined) throw new Error('Missing confirmation');
  expect(confirmation[1]).toContain('不结算完成奖励');
  await confirmation[3]();
  expect(submit).toHaveBeenCalledWith('重新开始', {
    type: 'secrethitler.game.restart',
    gameSequence: state.gameSequence,
    wasEnded: false,
  });
});

it('warns about the settled round and review before restarting an ended game', async () => {
  submit.mockClear();
  const state = stateFor('ended');
  const restart = model(state)
    .sections.flatMap((section) => section.actions)
    .find((action) => action.key === 'restart');
  if (!restart?.isEnabled) throw new Error('Missing restart');
  restart.onPress();
  expect(submit).not.toHaveBeenCalled();
  const confirmation = vi.mocked(showDestructiveAlert).mock.calls.at(-1);
  if (confirmation === undefined) throw new Error('Missing confirmation');
  expect(confirmation[1]).toContain('本局已结算');
  expect(confirmation[1]).toContain('复盘');
  await confirmation[3]();
  expect(submit).toHaveBeenCalledWith('重新开始', {
    type: 'secrethitler.game.restart',
    gameSequence: state.gameSequence,
    wasEnded: true,
  });
});

it('exposes bulk viewing as the blocked-start remedy and removes it once complete', () => {
  const state = stateFor('viewing');
  const panel = model(state);
  const action = panel.sections
    .flatMap((section) => section.actions)
    .find((entry) => entry.key === 'mark-bots-viewed');
  if (!action?.isEnabled) throw new Error('Missing bulk viewing');
  action.onPress();
  expect(submit).toHaveBeenCalledWith('标记机器人已查看', {
    type: 'secrethitler.bots.markAllBotsViewed',
  });
  expect(panel.task).toMatchObject({ remedyActionKey: 'mark-bots-viewed' });
  const viewed = sendSecrethitlerSeatCommand(state, 0, {
    type: 'secrethitler.bots.markAllBotsViewed',
  });
  expect(
    model(viewed)
      .sections.flatMap((section) => section.actions)
      .some((entry) => entry.key === 'mark-bots-viewed'),
  ).toBe(false);
});

it('marks start only after the seated host views their identity', () => {
  const state = stateFor('viewing');
  expect(model(stateFor('lobby')).pendingActionKeys).toEqual(['assign-roles']);
  expect(model(state).pendingActionKeys).toEqual([]);
  const hostViewed = sendSecrethitlerSeatCommand(state, 0, {
    type: 'secrethitler.role.viewed',
  });
  expect(model(hostViewed).pendingActionKeys).toEqual(['start-game']);
});

it('locks all host commands during opening and closing narration without dropping the buttons', () => {
  const narrated: SecrethitlerState[] = [];
  startSecrethitlerTestGame(buildSecrethitlerTestLobby(), (state) => {
    if (state.isAudioPlaying) narrated.push(state);
  });
  expect(narrated.map((state) => state.phase.kind)).toEqual(['night', 'election']);
  for (const state of narrated) {
    const locked = applyAudioPlaybackLock(model(state), {
      isAudioPlaying: true,
      exemptActionKeys: new Set<string>(),
    });
    const actions = locked.sections.flatMap((section) => section.actions);
    expect(actions.some((action) => action.key === 'restart')).toBe(true);
    for (const action of actions) {
      expect(action.isEnabled).toBe(false);
      expect(action).not.toHaveProperty('onPress');
    }
  }
});

it('dispatches night bot confirmation and disables mutating tools while submitting', () => {
  const state = stateFor('night');
  const action = model(state)
    .sections.flatMap((section) => section.actions)
    .find((entry) => entry.key === 'mark-bots-confirmed');
  if (!action?.isEnabled) throw new Error('Missing bot confirmation');
  action.onPress();
  expect(submit).toHaveBeenCalledWith('标记机器人已确认', {
    type: 'secrethitler.bots.markAllBotsGroupConfirmed',
  });
  for (const entry of model(state, true).sections.flatMap((section) => section.actions)) {
    expect(entry.isEnabled).toBe(false);
    expect(entry).not.toHaveProperty('onPress');
  }
  const settings = model(stateFor('lobby'))
    .sections.flatMap((section) => section.actions)
    .find((entry) => entry.key === 'music-settings');
  if (!settings?.isEnabled) throw new Error('Missing music settings');
  settings.onPress();
  expect(music).toHaveBeenCalled();
});
