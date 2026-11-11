/// <reference lib="dom" />

import type { Page } from '@playwright/test';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { alertPrimaryButton, dismissCurrentAlert } from '../e2e/helpers/alerts';
import {
  clickSeatAndConfirm,
  waitForRoleTurn,
  waitForStepAndSettle,
} from '../e2e/helpers/night-driver';
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
