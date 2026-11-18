/// <reference lib="dom" />

import { errors, type Locator, type Page } from '@playwright/test';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { alertPrimaryButton, dismissCurrentAlert } from '../e2e/helpers/alerts';
import {
  clickSeatAndConfirm,
  tryClickNightButton,
  waitForRoleTurn,
  waitForStepAndSettle,
} from '../e2e/helpers/night-driver';
import { RoomPage } from '../e2e/pages/RoomPage';
import { TESTIDS } from '../packages/web/src/testids';

vi.mock('../e2e/helpers/waits', () => ({ ensureConnected: vi.fn() }));

function roomPage() {
  const state = {
    step: 'guardProtect',
    phase: 'Ongoing',
    audio: true,
    panel: true,
    modal: true,
    title: '开始游戏？',
  };
  const click = vi.fn();
  const tick = vi.fn(async () => {
    vi.advanceTimersByTime(300);
  });
  const page = {
    url: () => 'http://example.test/room',
    waitForTimeout: tick,
    getByTestId: (testId: string) => ({
      getAttribute: async (name: string) => (name === 'data-step' ? state.step : state.phase),
      count: async () => {
        if (testId === TESTIDS.audioWaitingMessage) return Number(state.audio);
        if (testId === TESTIDS.alertTitle) return Number(state.title.length > 0);
        return 0;
      },
      isVisible: async () => {
        if (testId === TESTIDS.bottomActionPanel) return state.panel;
        if (testId === TESTIDS.alertModal) return state.modal;
        return false;
      },
      allTextContents: async () => (state.title ? [state.title] : []),
      textContent: async () => state.title,
      click,
    }),
  } as unknown as Page;
  return { page, state, tick, click };
}

function nightPanelPage(key: string) {
  const fixture = roomPage();
  const state = Object.assign(fixture.state, {
    step: 'wolfKill',
    audio: false,
    modal: false,
    actionsOpen: false,
    buttonAvailable: false,
  });
  const originalGetByTestId = fixture.page.getByTestId.bind(fixture.page);
  const button = {
    isVisible: vi.fn(async () => state.actionsOpen && state.buttonAvailable),
    click: vi.fn(async () => {
      state.actionsOpen = false;
    }),
  };
  const panel = {
    _apiName: 'Locator',
    isVisible: async () => state.actionsOpen,
    getByTestId: () => button,
    _expect: async () => ({ matches: state.actionsOpen }),
  } as unknown as Locator;
  const entry = {
    evaluateAll: async (
      callback: (entries: { getAttribute: () => string }[], target: string) => boolean,
      target: string,
    ) =>
      callback(
        [{ getAttribute: () => (state.buttonAvailable ? TESTIDS.werewolfNightButton(key) : '') }],
        target,
      ),
  };
  fixture.page.getByTestId = vi.fn((testId: string) => {
    if (testId === TESTIDS.werewolfNightButton(key)) return button;
    if (testId === TESTIDS.roomHostManagementPanel) return panel;
    if (testId === TESTIDS.roomMoreActionsButton || testId === TESTIDS.roomHostManagementButton)
      return entry;
    return originalGetByTestId(testId);
  }) as unknown as Page['getByTestId'];
  const openPanel = vi
    .spyOn(RoomPage.prototype, 'openHostManagement')
    .mockImplementation(async () => {
      state.actionsOpen = true;
      return panel;
    });
  const closePanel = vi
    .spyOn(RoomPage.prototype, 'closeHostManagement')
    .mockImplementation(async () => {
      state.actionsOpen = false;
    });
  return { ...fixture, state, button, panel, openPanel, closePanel };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('night driver readiness', () => {
  it('does not mistake the host start dialog exit for an unlocked guard step', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { page, state, tick } = roomPage();
    tick.mockImplementation(async () => {
      vi.advanceTimersByTime(300);
      if (tick.mock.calls.length === 1) state.title = '';
      if (tick.mock.calls.length === 2) state.modal = false;
      if (tick.mock.calls.length === 3) state.audio = false;
    });

    await waitForRoleTurn(page, 'guardProtect', [page], 1500);

    expect(tick).toHaveBeenCalledTimes(3);
    expect(state.audio).toBe(false);
  });

  it('returns immediately when already unlocked, without waiting for another prompt', async () => {
    vi.useFakeTimers();
    const { page, state, tick } = roomPage();
    state.audio = false;
    state.modal = false;

    await waitForStepAndSettle(page, 'guardProtect', 1500);

    expect(tick).not.toHaveBeenCalled();
  });

  it('does not reuse readiness from a previous night on the same page', async () => {
    vi.useFakeTimers();
    const { page, state, tick } = roomPage();
    state.audio = false;
    await waitForStepAndSettle(page, 'guardProtect', 1500);
    state.audio = true;
    tick.mockImplementation(async () => {
      vi.advanceTimersByTime(300);
      state.audio = false;
    });

    await waitForStepAndSettle(page, 'guardProtect', 1500);

    expect(tick).toHaveBeenCalledTimes(1);
  });

  it('requires the action panel rather than interpreting an unmounted panel as unlocked', async () => {
    vi.useFakeTimers();
    const { page, state, tick } = roomPage();
    state.audio = false;
    state.panel = false;
    tick.mockImplementation(async () => {
      vi.advanceTimersByTime(300);
      state.panel = true;
    });

    await waitForStepAndSettle(page, 'guardProtect', 1500);

    expect(tick).toHaveBeenCalledTimes(1);
  });

  it('fails with anchors instead of proceeding after an audio deadline', async () => {
    vi.useFakeTimers();
    const { page } = roomPage();

    await expect(waitForStepAndSettle(page, 'guardProtect', 600)).rejects.toThrow(
      /Audio lock did not lift for step guardProtect\nP0=Ongoing\/guardProtect audio=true/,
    );
  });

  it('does not tap into a later step after the audio wait moves on', async () => {
    vi.useFakeTimers();
    const { page, state, tick, click } = roomPage();
    tick.mockImplementation(async () => {
      vi.advanceTimersByTime(300);
      state.step = 'wolfKill';
    });

    await expect(waitForStepAndSettle(page, 'guardProtect', 600)).rejects.toThrow(
      /Step guardProtect moved/,
    );
    expect(click).not.toHaveBeenCalled();
  });

  it('rejects a seat action when no step is active', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { page, click } = roomPage();
    page.getByTestId = vi.fn(() => ({
      getAttribute: async () => null,
      count: async () => 0,
      allTextContents: async () => [],
    })) as unknown as Page['getByTestId'];

    await expect(clickSeatAndConfirm(page, 1)).rejects.toThrow(
      /No active step before seat selection/,
    );
    expect(click).not.toHaveBeenCalled();
  });
});

describe('night driver declared panel actions', () => {
  it('never opens for an absent or audio-locked action, then discovers it when offered', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { page, state, button, openPanel } = nightPanelPage('wolfEmpty');
    expect(await tryClickNightButton(page, 'wolfEmpty')).toBe(false);
    expect(openPanel).not.toHaveBeenCalled();

    state.audio = true;
    state.buttonAvailable = true;
    expect(await tryClickNightButton(page, 'wolfEmpty')).toBe(false);
    expect(openPanel).not.toHaveBeenCalled();

    state.audio = false;
    expect(await tryClickNightButton(page, 'wolfEmpty')).toBe(true);
    expect(button.click).toHaveBeenCalledOnce();
  });

  it('logs a failed interaction only as obsolete when the action was withdrawn', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { page, state, button, openPanel } = nightPanelPage('skip');
    state.buttonAvailable = true;
    openPanel.mockImplementationOnce(async () => {
      state.buttonAvailable = false;
      state.step = 'seerCheck';
      throw new errors.TimeoutError('entry detached');
    });

    expect(await tryClickNightButton(page, 'skip')).toBe(false);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('entry detached'));
    expect(button.click).not.toHaveBeenCalled();
  });

  it('fails with the original error and anchors when the action is still offered', async () => {
    const { page, state, openPanel } = nightPanelPage('skip');
    state.buttonAvailable = true;
    openPanel.mockRejectedValueOnce(new errors.TimeoutError('entry remains blocked'));

    await expect(tryClickNightButton(page, 'skip')).rejects.toThrow(
      /Panel action wolfKill\/skip failed: entry remains blocked\nP0=Ongoing\/wolfKill/,
    );
  });
});

describe('night driver alert identity', () => {
  it('has no primary button while the alert body is unmounted', async () => {
    const page = {
      getByTestId: () => ({ count: async () => 0 }),
    } as unknown as Page;

    expect(await alertPrimaryButton(page)).toBeNull();
  });

  it.each([false, true])(
    'leaves replacements untouched when the captured click detaches=%s',
    async (detaches) => {
      const oldTitle = { isConnected: true };
      const replacementClick = vi.fn();
      const button = {
        click: vi.fn(async () => {
          oldTitle.isConnected = false;
          if (detaches) throw new Error('Element is not attached to the DOM');
        }),
        dispose: vi.fn(),
      };
      const title = {
        evaluate: async (callback: (node: typeof oldTitle) => unknown) => callback(oldTitle),
        dispose: vi.fn(),
      };
      const page = {
        getByTestId: (testId: string) => ({
          isVisible: async () => true,
          count: async () => Number(testId !== TESTIDS.alertButton(2)),
          elementHandles: async () => (testId === TESTIDS.alertTitle ? [title] : [button]),
          click: replacementClick,
        }),
      } as unknown as Page;

      await dismissCurrentAlert(page);

      expect(button.click).toHaveBeenCalledTimes(1);
      expect(replacementClick).not.toHaveBeenCalled();
      expect(title.dispose).toHaveBeenCalledTimes(1);
      expect(button.dispose).toHaveBeenCalledTimes(1);
    },
  );
});
