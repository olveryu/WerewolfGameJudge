import {
  SECRETHITLER_PHASES,
  type SecrethitlerState,
} from '@game-judge/game-engine/games/secrethitler/public';

import { confirmAction } from '@/features/room/confirm';
import { applyAudioPlaybackLock } from '@/features/room/model/audioPlaybackLock';
import {
  buildSecrethitlerPhaseStates,
  buildSecrethitlerTestLobby,
  sendSecrethitlerSeatCommand,
  startSecrethitlerTestGame,
} from '@/test-utils/secrethitlerState';

import { createSecrethitlerHostManagement } from '../secrethitlerRoomAdapter';

vi.mock('@/features/room/confirm', () => ({ confirmAction: vi.fn() }));

function lastConfirmation() {
  const confirmation = vi.mocked(confirmAction).mock.calls.at(-1)?.[0];
  if (confirmation === undefined) throw new Error('Missing confirmation');
  return confirmation;
}

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
  const keys = panel.actions.map((action) => action.key);
  expect(keys.includes('restart')).toBe(phase !== 'lobby');
  expect(keys.includes('music-settings')).toBe(['lobby', 'viewing'].includes(phase));
  expect(panel.actions.length).toBeGreaterThan(0);
});

it('dispatches restart only after confirmation', async () => {
  submit.mockClear();
  const state = stateFor('election');
  const restart = model(state).actions.find((action) => action.key === 'restart');
  if (restart?.state.kind !== 'ready') throw new Error('Missing restart');
  restart.state.onPress();
  expect(submit).not.toHaveBeenCalled();
  const confirmation = lastConfirmation();
  expect(confirmation).toMatchObject({
    label: '重新开始？',
    tone: 'danger',
    confirmText: '重新开始',
  });
  expect(confirmation.body).toContain('不结算完成奖励');
  await confirmation.onConfirm();
  expect(submit).toHaveBeenCalledWith(
    '重新开始',
    {
      type: 'secrethitler.game.restart',
      gameSequence: state.gameSequence,
      wasEnded: false,
    },
    { actionKey: 'restart' },
  );
});

it('warns about the settled round and review before restarting an ended game', async () => {
  submit.mockClear();
  const state = stateFor('ended');
  const restart = model(state).actions.find((action) => action.key === 'restart');
  if (restart?.state.kind !== 'ready') throw new Error('Missing restart');
  restart.state.onPress();
  expect(submit).not.toHaveBeenCalled();
  const confirmation = lastConfirmation();
  expect(confirmation).toMatchObject({ label: '重新开始？', tone: 'danger' });
  expect(confirmation.body).toContain('本局已结算');
  expect(confirmation.body).toContain('复盘');
  await confirmation.onConfirm();
  expect(submit).toHaveBeenCalledWith(
    '重新开始',
    {
      type: 'secrethitler.game.restart',
      gameSequence: state.gameSequence,
      wasEnded: true,
    },
    { actionKey: 'restart' },
  );
});

it('keeps the blocked start task separate from bulk viewing and removes viewing when complete', () => {
  submit.mockClear();
  const state = stateFor('viewing');
  const panel = model(state);
  const action = panel.actions.find((entry) => entry.key === 'mark-bots-viewed');
  if (action?.state.kind !== 'ready') throw new Error('Missing bulk viewing');
  action.state.onPress();
  expect(submit).not.toHaveBeenCalled();
  const confirmation = lastConfirmation();
  expect(confirmation.label).toBe('标记机器人已查看？');
  void confirmation.onConfirm();
  expect(submit).toHaveBeenCalledWith(
    '标记机器人已查看',
    {
      type: 'secrethitler.bots.markAllBotsViewed',
    },
    { actionKey: 'mark-bots-viewed' },
  );
  expect(panel.task).toMatchObject({ kind: 'action', actionKey: 'start-game' });
  expect(panel.actions.find((entry) => entry.key === 'start-game')?.state.kind).toBe('blocked');
  const viewed = sendSecrethitlerSeatCommand(state, 0, {
    type: 'secrethitler.bots.markAllBotsViewed',
  });
  expect(model(viewed).actions.some((entry) => entry.key === 'mark-bots-viewed')).toBe(false);
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
    const actions = locked.actions;
    expect(actions.some((action) => action.key === 'restart')).toBe(true);
    for (const action of actions) {
      expect(action.state.kind).toBe('blocked');
      expect(action.state).not.toHaveProperty('onPress');
    }
  }
});

it('dispatches night bot confirmation and disables mutating tools while submitting', () => {
  submit.mockClear();
  const state = stateFor('night');
  const action = model(state).actions.find((entry) => entry.key === 'mark-bots-confirmed');
  if (action?.state.kind !== 'ready') throw new Error('Missing bot confirmation');
  action.state.onPress();
  expect(submit).not.toHaveBeenCalled();
  const confirmation = lastConfirmation();
  expect(confirmation.label).toBe('标记机器人已确认？');
  void confirmation.onConfirm();
  expect(submit).toHaveBeenCalledWith(
    '标记机器人已确认',
    {
      type: 'secrethitler.bots.markAllBotsGroupConfirmed',
    },
    { actionKey: 'mark-bots-confirmed' },
  );
  for (const entry of model(state, true).actions) {
    expect(['busy', 'blocked']).toContain(entry.state.kind);
    expect(entry.state).not.toHaveProperty('onPress');
  }
  const settings = model(stateFor('lobby')).actions.find((entry) => entry.key === 'music-settings');
  if (settings?.state.kind !== 'ready') throw new Error('Missing music settings');
  settings.state.onPress();
  expect(music).toHaveBeenCalled();
});
