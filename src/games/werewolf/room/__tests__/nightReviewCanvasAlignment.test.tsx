/**
 * @jest-environment jsdom
 *
 * Structural alignment between the mini-program canvas fallback renderer and
 * the DOM share presentation: both present the same NightReviewData — same
 * title/disclaimer copy from nightReviewLayout, same section order (share
 * title → outcome → disclaimer → actions → identities), the outcome lifted
 * out of the action order on both surfaces, and the remaining entries in the
 * same order. The canvas is a text medium, so alignment is pinned on its
 * fillText sequence against the entry formatters, and on the DOM side
 * against the rendered text order.
 */
import { render } from '@testing-library/react-native';

import type { LocalGameState, LocalPlayer } from '@/games/werewolf/state/LocalGameState';
import { colors } from '@/theme';

import { NightReviewShareCard } from '../components/NightReviewShareCard';
import { buildNightReviewData, getNightReviewOutcome } from '../NightReview.helpers';
import {
  formatNightReviewShareTitle,
  NIGHT_REVIEW_ACTIONS_TITLE,
  NIGHT_REVIEW_DISCLAIMER_TEXT,
  NIGHT_REVIEW_IDENTITIES_TITLE,
  NIGHT_REVIEW_NOISE_TITLE,
} from '../nightReviewLayout';
import { renderNightReviewToCanvas } from '../shareNightReview';
import {
  formatNightReviewActionLine,
  formatNightReviewIdentityLine,
  formatNightReviewOutcomeLine,
} from '../shareNightReviewLines';

jest.mock('@/features/room/services/captureViewPngBase64', () => ({
  captureViewPngBase64: jest.fn(),
}));
jest.mock('@/features/room/services/captureViewSegmentedPngBase64', () => ({
  captureViewSegmentedPngBase64: jest.fn(),
}));
jest.mock('@/features/room/services/shareImage', () => ({
  shareImageBase64: jest.fn(),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Recording fake canvas: the jsdom canvas has no 2d context, so substitute a
// minimal one that records every fillText call in draw order.
// ─────────────────────────────────────────────────────────────────────────────

function installFakeCanvas(): { readonly texts: string[] } {
  const texts: string[] = [];

  class FakeCanvasContext {
    font = '';
    fillStyle = '';
    strokeStyle = '';
    lineWidth = 1;
    textAlign = '';
    textBaseline = '';

    measureText(text: string): { width: number } {
      // Narrow enough that no line ever wraps at card width.
      return { width: text.length * 2 };
    }
    fillText(text: string): void {
      texts.push(text);
    }
    beginPath(): void {}
    moveTo(): void {}
    lineTo(): void {}
    arcTo(): void {}
    closePath(): void {}
    fill(): void {}
    stroke(): void {}
    scale(): void {}
  }

  class FakeCanvas {
    width = 0;
    height = 0;
    private readonly context = new FakeCanvasContext();

    getContext(): FakeCanvasContext {
      return this.context;
    }
    toDataURL(): string {
      return 'data:image/png;base64,AAAA';
    }
  }

  const originalCreateElement = document.createElement.bind(document);
  jest.spyOn(document, 'createElement').mockImplementation(((
    tagName: string,
    ...rest: unknown[]
  ) => {
    if (tagName === 'canvas') return new FakeCanvas();
    return (originalCreateElement as (...args: unknown[]) => unknown)(tagName, ...rest);
  }) as typeof document.createElement);

  return { texts };
}

// ─────────────────────────────────────────────────────────────────────────────
// Fixture: the same composed night the modal/share-card tests use.
// ─────────────────────────────────────────────────────────────────────────────

function makePlayer(seat: number, role: string | null): LocalPlayer {
  return {
    userId: `uid-${seat}`,
    seat,
    role: role as LocalPlayer['role'],
    hasViewedRole: true,
  };
}

function composedNightState(): LocalGameState {
  const players = new Map<number, LocalPlayer | null>([
    [0, makePlayer(0, 'wolf')],
    [1, makePlayer(1, 'guard')],
    [2, makePlayer(2, 'witch')],
    [3, makePlayer(3, 'seer')],
    [4, makePlayer(4, 'villager')],
  ]);
  return {
    currentNightResults: {
      wolfVotesBySeat: { '0': 4 },
      guardedSeat: 3,
      savedSeat: 4,
    },
    lastNightDeaths: [4],
    deathReasons: { 4: 'wolfKill' },
    players,
    actions: new Map(),
    seerReveal: { targetSeat: 0, result: '狼人' },
  } as unknown as LocalGameState;
}

interface JsonNode {
  type: unknown;
  children: (JsonNode | string)[] | null;
}

function textOf(node: JsonNode): string {
  if (!node.children) return '';
  return node.children.map((child) => (typeof child === 'string' ? child : textOf(child))).join('');
}

/** Every rendered Text's content in tree (document) order. */
function collectTextSequence(node: JsonNode | (JsonNode | string)[] | string | null): string[] {
  if (node === null || typeof node === 'string') return [];
  if (Array.isArray(node)) return node.flatMap((child) => collectTextSequence(child));
  if (node.type === 'Text') return [textOf(node)];
  return collectTextSequence(node.children);
}

describe('night review canvas / DOM structural alignment', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('draws the outcome line under the title, then every non-outcome entry in order', () => {
    const { texts } = installFakeCanvas();
    const data = buildNightReviewData(composedNightState());

    const base64 = renderNightReviewToCanvas(data, '1234', colors);

    expect(base64).toBe('AAAA');
    expect(texts).toEqual([
      formatNightReviewShareTitle('1234'),
      formatNightReviewOutcomeLine(getNightReviewOutcome(data)),
      `⚠ ${NIGHT_REVIEW_DISCLAIMER_TEXT}`,
      NIGHT_REVIEW_ACTIONS_TITLE,
      ...data.actions
        .filter((entry) => entry.kind !== 'deaths' && entry.kind !== 'peacefulNight')
        .map(formatNightReviewActionLine),
      NIGHT_REVIEW_IDENTITIES_TITLE,
      ...data.identities.map(formatNightReviewIdentityLine),
    ]);
  });

  it('renders the DOM share card with the same sections, order and grouping', () => {
    const data = buildNightReviewData(composedNightState());
    const view = render(<NightReviewShareCard data={data} roomCode="1234" />);
    const sequence = collectTextSequence(view.toJSON());

    const indexOf = (text: string): number => {
      const index = sequence.indexOf(text);
      expect(index).toBeGreaterThanOrEqual(0);
      return index;
    };

    // Same shared copy, same section order as the canvas sequence:
    // share title → outcome hero headline → disclaimer → actions.
    expect(indexOf(formatNightReviewShareTitle('1234'))).toBeLessThan(indexOf('昨夜 1 人出局'));
    expect(indexOf('昨夜 1 人出局')).toBeLessThan(indexOf(NIGHT_REVIEW_DISCLAIMER_TEXT));
    expect(indexOf(NIGHT_REVIEW_DISCLAIMER_TEXT)).toBeLessThan(indexOf(NIGHT_REVIEW_ACTIONS_TITLE));

    // Action rows appear in entry order between the two section titles; the
    // outcome itself never appears as a timeline row (hero only).
    const rowTitles = ['狼人袭击', '守卫守护', '女巫使用解药救了', '毒药未使用', '预言家查验'];
    expect(sequence).not.toContain('死亡');
    let previous = indexOf(NIGHT_REVIEW_ACTIONS_TITLE);
    for (const title of rowTitles) {
      const index = indexOf(title);
      expect(index).toBeGreaterThan(previous);
      previous = index;
    }
    expect(indexOf(NIGHT_REVIEW_IDENTITIES_TITLE)).toBeGreaterThan(previous);

    // Identity seats ascend after the identities title.
    const afterIdentities = sequence.slice(indexOf(NIGHT_REVIEW_IDENTITIES_TITLE));
    const seatIndices = ['1号', '2号', '3号', '4号', '5号'].map((label) =>
      afterIdentities.indexOf(label),
    );
    for (const index of seatIndices) expect(index).toBeGreaterThanOrEqual(0);
    expect([...seatIndices].sort((a, b) => a - b)).toEqual(seatIndices);
  });

  it('orders the DOM sections hero → actions → noise zone → identities', () => {
    const players = new Map<number, LocalPlayer | null>([
      [0, makePlayer(0, 'wolf')],
      [1, makePlayer(1, 'guard')],
      [4, makePlayer(4, 'villager')],
    ]);
    const state = {
      currentNightResults: { wolfVotesBySeat: { '0': 4 } },
      lastNightDeaths: [],
      players,
      actions: new Map(),
    } as unknown as LocalGameState;
    const data = buildNightReviewData(state);
    const view = render(<NightReviewShareCard data={data} roomCode="1234" />);
    const sequence = collectTextSequence(view.toJSON());

    const indexOf = (text: string): number => {
      const index = sequence.indexOf(text);
      expect(index).toBeGreaterThanOrEqual(0);
      return index;
    };

    expect(indexOf('昨夜平安夜')).toBeLessThan(indexOf(NIGHT_REVIEW_ACTIONS_TITLE));
    expect(indexOf(NIGHT_REVIEW_ACTIONS_TITLE)).toBeLessThan(indexOf(NIGHT_REVIEW_NOISE_TITLE));
    expect(indexOf(NIGHT_REVIEW_NOISE_TITLE)).toBeLessThan(indexOf('守卫未守护'));
    expect(indexOf('守卫未守护')).toBeLessThan(indexOf(NIGHT_REVIEW_IDENTITIES_TITLE));
  });
});
