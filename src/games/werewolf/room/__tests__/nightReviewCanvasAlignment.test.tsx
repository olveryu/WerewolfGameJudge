/**
 * @jest-environment jsdom
 *
 * Structural alignment between the mini-program canvas fallback renderer and
 * the DOM share presentation: both present the same NightReviewData — same
 * title/disclaimer copy from nightReviewLayout, same section order (share
 * title → outcome → stats → disclaimer → actions → sheriff → identities),
 * the outcome lifted out of the action order on both surfaces, and the
 * remaining entries in the same order. The canvas is a text medium, so
 * alignment is pinned on its fillText sequence against the entry
 * formatters, and on the DOM side against the rendered text order.
 */
import { render } from '@testing-library/react-native';

import type { LocalGameState, LocalPlayer } from '@/games/werewolf/state/LocalGameState';
import { colors } from '@/theme';

import { NightReviewShareCard } from '../components/NightReviewShareCard';
import {
  buildNightReviewData,
  deriveNightReportStats,
  getNightReviewOutcome,
  type NightReviewActionEntry,
} from '../NightReview.helpers';
import {
  formatNightReviewShareTitle,
  NIGHT_REPORT_ACTIONS_TITLE,
  NIGHT_REPORT_FOOTER_TEXT,
  NIGHT_REPORT_IDLE_TITLE,
  NIGHT_REPORT_SHERIFF_TITLE,
  NIGHT_REVIEW_DISCLAIMER_TEXT,
  NIGHT_REVIEW_IDENTITIES_TITLE,
} from '../nightReviewLayout';
import { renderNightReviewToCanvas } from '../shareNightReview';
import {
  formatNightReviewActionLine,
  formatNightReviewIdentityLine,
  formatNightReviewOutcomeLine,
  formatNightReviewSheriffLines,
  formatNightReviewStatsLine,
  formatNightReviewWolfVerdictForEntry,
} from '../shareNightReviewLines';

/** The canvas line sequence for the action entries: one line per entry,
 * with the wolf verdict line right after the wolf attack line. */
function expectedActionLines(entries: readonly NightReviewActionEntry[]): string[] {
  const lines: string[] = [];
  for (const entry of entries) {
    if (entry.kind === 'deaths' || entry.kind === 'peacefulNight') continue;
    lines.push(formatNightReviewActionLine(entry));
    if (entry.kind === 'wolfAttack') lines.push(formatNightReviewWolfVerdictForEntry(entry));
  }
  return lines;
}

/** The full expected canvas fillText sequence for a report. */
function expectedCanvasSequence(
  data: ReturnType<typeof buildNightReviewData>,
  roomCode: string,
): string[] {
  return [
    formatNightReviewShareTitle(roomCode),
    formatNightReviewOutcomeLine(getNightReviewOutcome(data)),
    formatNightReviewStatsLine(deriveNightReportStats(data)),
    `⚠ ${NIGHT_REVIEW_DISCLAIMER_TEXT}`,
    NIGHT_REPORT_ACTIONS_TITLE,
    ...expectedActionLines(data.actions),
    ...(data.sheriff
      ? [NIGHT_REPORT_SHERIFF_TITLE, ...formatNightReviewSheriffLines(data.sheriff)]
      : []),
    NIGHT_REVIEW_IDENTITIES_TITLE,
    ...data.identities.map(formatNightReviewIdentityLine),
  ];
}

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
    expect(texts).toEqual(expectedCanvasSequence(data, '1234'));
  });

  it('draws the sheriff section between the actions and the identities', () => {
    const { texts } = installFakeCanvas();
    const state = {
      ...composedNightState(),
      sheriffElection: {
        phase: 'completed',
        registeredSeats: [2, 3],
        withdrawnSeats: [],
        completedRounds: [
          {
            round: 'first',
            candidateSeats: [2, 3],
            eligibleVoterSeats: [0, 1, 2, 3, 4],
            ballots: { 0: 2, 1: 2, 2: 3, 3: 2, 4: null },
            voteCounts: { 2: 3, 3: 1 },
            abstainingSeats: [4],
          },
        ],
      },
      sheriffElectionResult: { kind: 'elected', sheriffSeat: 2 },
    } as unknown as LocalGameState;
    const data = buildNightReviewData(state);

    const base64 = renderNightReviewToCanvas(data, '1234', colors);

    expect(base64).toBe('AAAA');
    expect(texts).toEqual(expectedCanvasSequence(data, '1234'));
    expect(texts).toContain('警长竞选：3号 警长当选（首轮 3/5 票）');
    expect(texts).toContain('首轮：3号 3票（1、2、4号），4号 1票（3号），弃票：5号');
  });

  it('draws wolf abstentions inside the wolf-attack line and never a seat 0', () => {
    const { texts } = installFakeCanvas();
    const players = new Map<number, LocalPlayer | null>([
      [0, makePlayer(0, 'wolf')],
      [1, makePlayer(1, 'wolf')],
      [4, makePlayer(4, 'villager')],
    ]);
    const state = {
      currentNightResults: { wolfVotesBySeat: { '0': 4, '1': -1 } },
      lastNightDeaths: [],
      players,
      actions: new Map(),
    } as unknown as LocalGameState;
    const data = buildNightReviewData(state);

    const base64 = renderNightReviewToCanvas(data, '1234', colors);

    expect(base64).toBe('AAAA');
    // Same per-entry formatter sequence as the composed-night case: the
    // abstention rides inside the wolf-attack line, no separate entry.
    expect(texts).toEqual(expectedCanvasSequence(data, '1234'));
    expect(texts.some((text) => text.includes('狼人袭击：1号→5号，2号空刀'))).toBe(true);
    expect(texts.every((text) => !text.includes('0号'))).toBe(true);
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
    // share title → headline → stats strip → action cards → identity wall →
    // footer (the canvas disclaimer text lives in the DOM footer).
    expect(indexOf(formatNightReviewShareTitle('1234'))).toBeLessThan(indexOf('昨夜 1 人出局'));
    expect(indexOf('昨夜 1 人出局')).toBeLessThan(indexOf('● 狼杀 1'));
    expect(indexOf('● 狼杀 1')).toBeLessThan(indexOf(NIGHT_REPORT_ACTIONS_TITLE));
    expect(indexOf(NIGHT_REPORT_FOOTER_TEXT)).toBeGreaterThan(
      indexOf(NIGHT_REVIEW_IDENTITIES_TITLE),
    );
    expect(NIGHT_REPORT_FOOTER_TEXT).toContain(NIGHT_REVIEW_DISCLAIMER_TEXT);

    // Action cards appear in entry order between the two section titles;
    // the outcome itself never appears as a card (header only).
    const cardTitles = ['狼队', '守护', '使用解药救了', '查验'];
    expect(sequence).not.toContain('死亡');
    let previous = indexOf(NIGHT_REPORT_ACTIONS_TITLE);
    for (const title of cardTitles) {
      const index = indexOf(title);
      expect(index).toBeGreaterThan(previous);
      previous = index;
    }
    expect(indexOf(NIGHT_REVIEW_IDENTITIES_TITLE)).toBeGreaterThan(previous);

    // Identity roles ascend by seat after the identities title.
    const afterIdentities = sequence.slice(indexOf(NIGHT_REVIEW_IDENTITIES_TITLE));
    const roleIndices = ['狼人', '守卫', '女巫', '预言家', '平民'].map((label) =>
      afterIdentities.indexOf(label),
    );
    for (const index of roleIndices) expect(index).toBeGreaterThanOrEqual(0);
    expect([...roleIndices].sort((a, b) => a - b)).toEqual(roleIndices);
  });

  it('orders the DOM sections header → actions → strip → sheriff → identities', () => {
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

    expect(indexOf('昨夜平安夜')).toBeLessThan(indexOf(NIGHT_REPORT_ACTIONS_TITLE));
    expect(indexOf(NIGHT_REPORT_ACTIONS_TITLE)).toBeLessThan(indexOf(NIGHT_REPORT_IDLE_TITLE));
    expect(indexOf(NIGHT_REPORT_IDLE_TITLE)).toBeLessThan(indexOf('守卫 2号 未守护'));
    expect(indexOf('守卫 2号 未守护')).toBeLessThan(indexOf(NIGHT_REVIEW_IDENTITIES_TITLE));
  });
});
