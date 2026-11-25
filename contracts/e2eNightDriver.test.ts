/// <reference lib="dom" />

import { errors, type Page } from '@playwright/test';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { alertPrimaryButton, pressCurrentAlertPrimary, readAlertText } from '../e2e/helpers/alerts';
import {
  clickSeatAndConfirm,
  tryClickNightButton,
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

      await pressCurrentAlertPrimary(page);

      expect(button.click).toHaveBeenCalledTimes(1);
      expect(replacementClick).not.toHaveBeenCalled();
      expect(title.dispose).toHaveBeenCalledTimes(1);
      expect(button.dispose).toHaveBeenCalledTimes(1);
    },
  );
});

interface FakeAlert {
  readonly title: string;
  readonly message: string | null;
}

/**
 * A page whose alert changes after every read, the way a replacement arrives between two reads
 * of a real page. `null` is the moment between two alerts, with no body mounted.
 */
function pageWithAlertSequence(sequence: readonly (FakeAlert | null)[]): Page {
  let reads = 0;
  const modalOf = (alert: FakeAlert) => ({
    querySelector: (selector: string) => {
      if (selector.includes(TESTIDS.alertTitle)) return { textContent: alert.title };
      return alert.message === null ? null : { textContent: alert.message };
    },
  });
  return {
    getByTestId: () => ({
      evaluateAll: async (
        read: (modals: readonly unknown[], testIds: unknown) => unknown,
        testIds: unknown,
      ) => {
        const alert = sequence[Math.min(reads, sequence.length - 1)];
        reads += 1;
        return read(alert == null ? [] : [modalOf(alert)], testIds);
      },
    }),
  } as unknown as Page;
}

describe('night driver alert reading', () => {
  const confirmation: FakeAlert = { title: '查验2号？', message: null };
  const result: FakeAlert = { title: '查验结果', message: '2号是狼人' };

  it('reads a title and its message from the same alert when a replacement arrives', async () => {
    const page = pageWithAlertSequence([confirmation, result]);

    // Each call is one read of the page: the first lands on the confirmation, the second on
    // the result. Neither can return the result's title with the confirmation's empty message.
    expect(await readAlertText(page)).toBe('查验2号？\n');
    expect(await readAlertText(page)).toBe('查验结果\n2号是狼人');
  });

  it('waits past other alerts for the one that carries the expected title', async () => {
    const page = pageWithAlertSequence([confirmation, null, result]);

    expect(await readAlertText(page, 5000, '查验结果')).toBe('查验结果\n2号是狼人');
  });
});

describe('night driver sweep', () => {
  const groupCard = TESTIDS.werewolfNightButton('openActionGroup');
  const foldedIds = `${TESTIDS.stepInteractionButton('wolfKill')} ${TESTIDS.stepInteractionButton('$skip')}`;

  interface FoldedCard {
    isOnHand: boolean;
    readonly press: () => Promise<void>;
    /** Runs after a visibility read, to move the step on between two reads. */
    readonly onSeen?: () => void;
  }

  /** A wolf's hand during the wolf step, with the group card folding the skip action. */
  function sweptPage(card: FoldedCard): Page {
    return {
      getByTestId: (testId: string) => ({
        getAttribute: async (name: string) => {
          if (testId !== groupCard) return name === 'data-step' ? 'wolfKill' : 'Ongoing';
          if (card.isOnHand) return foldedIds;
          // A waiting read of a card that has left the hand runs out its timeout.
          throw new errors.TimeoutError('locator.getAttribute: Timeout 10000ms exceeded.');
        },
        count: async () => 0,
        isVisible: async () => {
          if (testId === TESTIDS.bottomActionPanel) return true;
          if (testId !== groupCard) return false;
          const wasOnHand = card.isOnHand;
          card.onSeen?.();
          return wasOnHand;
        },
        evaluateAll: async () => (testId === groupCard && card.isOnHand ? [foldedIds] : []),
        click: card.press,
      }),
    } as unknown as Page;
  }
  const pressTimesOut = (): never => {
    throw new errors.TimeoutError('locator.click: Timeout 1000ms exceeded.');
  };

  // The step moves on while a sweep is looking at another player's hand. The trace of the
  // failure this pins shows the group card visible, then gone three milliseconds later.
  it('reports a miss when the group card leaves the hand right after it was seen', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const card: FoldedCard = {
      isOnHand: true,
      press: vi.fn(async () => pressTimesOut()),
      onSeen: () => {
        card.isOnHand = false;
      },
    };

    await expect(tryClickNightButton(sweptPage(card), 'skip')).resolves.toBe(false);
    expect(card.press).not.toHaveBeenCalled();
  });

  it('reports a miss when the declaration is withdrawn while the card is being pressed', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const card: FoldedCard = {
      isOnHand: true,
      press: vi.fn(async () => {
        card.isOnHand = false;
        pressTimesOut();
      }),
    };

    await expect(tryClickNightButton(sweptPage(card), 'skip')).resolves.toBe(false);
    expect(card.press).toHaveBeenCalledTimes(1);
  });

  it('fails with the press timeout when the card still declares the action', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const card: FoldedCard = {
      isOnHand: true,
      press: vi.fn(async () => {
        vi.advanceTimersByTime(1000);
        pressTimesOut();
      }),
    };

    await expect(tryClickNightButton(sweptPage(card), 'skip')).rejects.toThrow(
      'locator.click: Timeout 1000ms exceeded.',
    );
    expect(card.press).toHaveBeenCalledTimes(5);
  });
});
