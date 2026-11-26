/**
 * The sheriff election as every viewer sees it, written out as a text file a person can read
 * and confirm. Elections are played through engine commands from a finished night; at every
 * moment the real status bar, hand, host cards and details panel are rendered for every seat
 * and for a spectator. A changed sentence is a diff of that file.
 */

import fs from 'node:fs';
import path from 'node:path';

import type {
  GameState,
  RoleId,
  SheriffElectionState,
  WerewolfPublicCommand,
} from '@game-judge/game-engine/games/werewolf/public';
import { getWerewolfNightReview } from '@game-judge/game-engine/games/werewolf/public';
import { formatSeat } from '@game-judge/game-engine/platform/room/formatSeat';
import { render, renderHook } from '@testing-library/react';
import ts from 'typescript';

import type { RoomPlayerAction } from '@/features/room/model/RoomAction';
import { toWerewolfReviewDocument } from '@/games/werewolf/review/toWerewolfReviewDocument';
import { SheriffElectionPanel } from '@/games/werewolf/room/components/SheriffElectionPanel';
import { buildSheriffElectionBoardStatus } from '@/games/werewolf/room/day/sheriffElectionBoardStatus';
import { createSheriffElectionPlayerActions } from '@/games/werewolf/room/day/sheriffElectionPlayerActions';
import {
  type SheriffElectionPanelModel,
  useSheriffElection,
} from '@/games/werewolf/room/day/useSheriffElection';
import { BoardStatusPreview } from '@/test-utils/boardStatus';
import { alertStore, dismissAlert } from '@/utils/alert';

import { verifyCatalogue } from '../../../../../../../../scripts/lib/catalogues/verify.mjs';
import { playBoardNightGame } from '../../__tests__/harness/boardNightScenarios';
import type { EngineGame } from '../../__tests__/harness/engineGame';

type Phase = SheriffElectionState['phase'];

const PHASES: readonly Phase[] = [
  'registration',
  'candidateSpeech',
  'firstVote',
  'runoffSpeech',
  'runoffVote',
  'result',
  'completed',
];
const ROLES: readonly RoleId[] = [
  'villager',
  'villager',
  'villager',
  'seer',
  'witch',
  'wolf',
  'wolf',
];
const HOST_SEAT = 0;
const RULE = '='.repeat(72);
const SEPARATOR = ' ｜ ';
const REVIEW_SECTION_TITLE = '警长竞选';
/** The room's own identity card, which the election dock keeps as its leading card. */
const IDENTITY_CARD: RoomPlayerAction = {
  key: 'viewRole',
  label: 'identity',
  category: 'player',
  audience: 'participant',
  state: { kind: 'ready', onPress: () => undefined },
};

// ---------------------------------------------------------------------------
// Playing an election
// ---------------------------------------------------------------------------

interface Move {
  /** What happened, as the list names the moment. */
  readonly title: string;
  readonly act: (game: EngineGame) => void;
}

const asSeat = (seat: number, command: WerewolfPublicCommand, title: string): Move => ({
  title,
  act: (game) => game.dispatchAsSeatOrThrow(seat, command, title),
});
const register = (seat: number): Move =>
  asSeat(seat, { type: 'werewolf.sheriff.register' }, `${formatSeat(seat)}报名`);
const cancelRegistration = (seat: number): Move =>
  asSeat(seat, { type: 'werewolf.sheriff.cancelRegistration' }, `${formatSeat(seat)}撤回报名`);
const withdraw = (seat: number): Move =>
  asSeat(seat, { type: 'werewolf.sheriff.withdraw' }, `${formatSeat(seat)}退水`);
const vote = (seat: number, targetSeat: number | null): Move =>
  asSeat(
    seat,
    { type: 'werewolf.sheriff.vote', targetSeat },
    targetSeat === null
      ? `${formatSeat(seat)}弃票`
      : `${formatSeat(seat)}投${formatSeat(targetSeat)}`,
  );
const advance = (title: string): Move => ({
  title,
  act: (game) => game.dispatchAsHostOrThrow({ type: 'werewolf.sheriff.advance' }, title),
});
const selfDestruct: Move = {
  title: '房主以自爆结束竞选',
  act: (game) =>
    game.dispatchAsHostOrThrow({ type: 'werewolf.sheriff.endBySelfDestruct' }, 'self-destruct'),
};
/** Let the armed countdown run out, as the server's timer does. */
const countdownEnds = (title: string): Move => ({
  title,
  act: (game) => {
    const deadline = deadlineOf(requireElection(game.getGameState()));
    if (deadline === undefined) throw new Error(`[TEST] ${title}: no countdown is armed`);
    game.dispatchSystemOrThrow({ type: 'werewolf.phase.settleExpired' }, title, {
      nowMs: deadline,
    });
  },
});

const TWO_CANDIDATES_TO_VOTE: readonly Move[] = [
  register(1),
  register(2),
  advance('房主结束报名'),
  advance('房主结束发言'),
];
const TIED_FIRST_VOTE: readonly Move[] = [
  ...TWO_CANDIDATES_TO_VOTE,
  vote(0, 1),
  vote(3, 1),
  vote(4, 2),
  vote(5, 2),
  vote(6, null),
  countdownEnds('首轮投票倒计时结束'),
  countdownEnds('首轮结果公布结束'),
];

const ELECTIONS: readonly { readonly name: string; readonly moves: readonly Move[] }[] = [
  { name: '无人报名', moves: [advance('房主结束报名')] },
  {
    name: '全员报名',
    moves: [...ROLES.keys()].map(register).concat(advance('房主结束报名'), advance('房主结束发言')),
  },
  {
    name: '只有一人报名',
    moves: [register(1), advance('房主结束报名'), advance('房主结束发言')],
  },
  {
    name: '报名后撤回，两人竞选，首轮选出',
    moves: [
      register(1),
      register(2),
      register(3),
      cancelRegistration(3),
      advance('房主结束报名'),
      advance('房主结束发言'),
      vote(0, 1),
      vote(3, 2),
      vote(3, 1),
      vote(4, 2),
      vote(5, null),
      vote(6, 1),
      countdownEnds('首轮投票倒计时结束'),
    ],
  },
  {
    name: '首轮平票，平票轮选出',
    moves: [
      ...TIED_FIRST_VOTE,
      advance('房主结束平票发言'),
      vote(0, 1),
      vote(3, 1),
      vote(4, 1),
      vote(5, 2),
      vote(6, null),
      countdownEnds('平票投票倒计时结束'),
    ],
  },
  {
    name: '平票轮仍然平票',
    moves: [
      ...TIED_FIRST_VOTE,
      advance('房主结束平票发言'),
      vote(0, 1),
      vote(3, 1),
      vote(4, 2),
      vote(5, 2),
      vote(6, null),
      countdownEnds('平票投票倒计时结束'),
    ],
  },
  {
    name: '平票发言时一人退水',
    moves: [...TIED_FIRST_VOTE, withdraw(2), advance('房主结束平票发言')],
  },
  {
    name: '首轮无人得票',
    moves: [
      ...TWO_CANDIDATES_TO_VOTE,
      vote(0, null),
      vote(3, null),
      vote(4, null),
      vote(5, null),
      vote(6, null),
      countdownEnds('首轮投票倒计时结束'),
    ],
  },
  {
    name: '发言时退水，只剩一人',
    moves: [
      register(1),
      register(2),
      register(3),
      advance('房主结束报名'),
      withdraw(3),
      withdraw(2),
      advance('房主结束发言'),
    ],
  },
  {
    name: '发言时全部退水',
    moves: [
      register(1),
      register(2),
      advance('房主结束报名'),
      withdraw(1),
      withdraw(2),
      advance('房主结束发言'),
    ],
  },
  {
    name: '发言时自爆',
    moves: [register(1), register(2), advance('房主结束报名'), selfDestruct],
  },
  { name: '投票时自爆', moves: [...TWO_CANDIDATES_TO_VOTE, vote(0, 1), selfDestruct] },
];

function requireElection(state: GameState): SheriffElectionState {
  // The record stays on the state after the election closes and the game ends.
  if (state.sheriffElection === undefined) throw new Error('[TEST] There is no sheriff election');
  return state.sheriffElection;
}

/** The armed countdown of a voting or result phase, if any. */
function deadlineOf(election: SheriffElectionState): number | undefined {
  return 'deadline' in election ? election.deadline : undefined;
}

function finishNarration(game: EngineGame): void {
  while (game.getGameState().isAudioPlaying) game.acknowledgePendingAudioOrThrow('narration');
}

// ---------------------------------------------------------------------------
// Recording what a viewer sees
// ---------------------------------------------------------------------------

function textOf(container: HTMLElement): string {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const parts: string[] = [];
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const text = node.textContent?.trim() ?? '';
    if (text !== '') parts.push(text);
  }
  return parts.join(SEPARATOR);
}

function renderedText(element: React.ReactElement): string {
  const view = render(element);
  try {
    return textOf(view.container);
  } finally {
    view.unmount();
  }
}

/** Run something that opens a confirmation and describe the dialog it opened. */
function confirmationOf(open: () => void): string {
  const before = alertStore.getSnapshot()?.generation ?? null;
  open();
  const dialog = alertStore.getSnapshot();
  if (dialog === null || dialog.generation === before) return '（没有确认框）';
  dismissAlert(dialog.generation);
  const body = dialog.message === undefined ? '' : dialog.message;
  return `确认框「${dialog.title}」${body} 按钮：${dialog.buttons.map((button) => button.text).join('／')}`;
}

interface Sighting {
  readonly phase: Phase;
  readonly phaseTitle: string;
  readonly moment: string;
  readonly who: string;
  readonly personal: readonly string[];
  readonly host: readonly string[];
  readonly panel: string;
  /** The description inside the result dialog; null outside the result phase. */
  readonly resultDialog: string | null;
  /** The election's record in the night report, the same for every viewer. */
  readonly review: readonly string[];
}

function describeViewer(election: SheriffElectionState, seat: number | null): string {
  if (seat === null) return '观战者';
  const standing = election.withdrawnSeats.includes(seat)
    ? '已退水'
    : election.registeredSeats.includes(seat)
      ? '上警'
      : '警下';
  return `${formatSeat(seat)}（${seat === HOST_SEAT ? '房主，' : ''}${standing}）`;
}

function observe(state: GameState, moment: string, seat: number | null): Sighting {
  const election = requireElection(state);
  const isHost = seat === HOST_SEAT;
  const deadline = deadlineOf(election);
  const hook = renderHook(() =>
    useSheriffElection({
      gameState: state,
      effectiveSeat: seat,
      isHost,
      remainingSeconds: deadline === undefined ? null : Math.ceil((deadline - Date.now()) / 1000),
      submit: () => Promise.resolve(true),
    }),
  );
  const model: SheriffElectionPanelModel | null = hook.result.current;
  if (model === null) throw new Error('[TEST] The election has no panel model');
  try {
    const dock = createSheriffElectionPlayerActions({
      election: model,
      roomTools: seat === null ? [] : [IDENTITY_CARD],
      isHost,
      isAudioPlaying: false,
      openDetails: () => undefined,
    });
    const cards = dock.actions.map((action) => {
      if (action.key === IDENTITY_CARD.key) return action.label;
      if (action.opensDialog === true) return `${action.label} → 打开详情面板`;
      return action.state.kind === 'ready'
        ? `${action.label} → ${confirmationOf(action.state.onPress)}`
        : `${action.label}（不可用）`;
    });
    const host: string[] = [];
    if (isHost && model.view.canAdvance && model.view.advanceLabel !== null) {
      host.push(`${model.view.advanceLabel} → ${confirmationOf(model.requestAdvance)}`);
    }
    if (isHost && isSelfDestructOffered(model.view.phase)) {
      host.push(`自爆结束竞选 → ${confirmationOf(model.requestEndBySelfDestruct)}`);
    }
    return {
      phase: model.view.phase,
      phaseTitle: model.view.phaseTitle,
      moment,
      who: describeViewer(election, seat),
      personal: [
        `顶部状态：${renderedText(
          <BoardStatusPreview status={buildSheriffElectionBoardStatus(model, isHost)} />,
        )}`,
        `底部状态栏：${dock.message ?? '（无）'}`,
        `底部手牌：${cards.length === 0 ? '（无）' : cards.join(SEPARATOR)}`,
      ],
      host,
      panel: renderedText(<SheriffElectionPanel model={model} />),
      resultDialog: model.view.phase === 'result' ? model.view.phaseDescription : null,
      review: describeReviewRecord(state),
    };
  } finally {
    hook.unmount();
  }
}

/** The election's part of the night report, built by the report's own pipeline. */
function describeReviewRecord(state: GameState): readonly string[] {
  const blocks = toWerewolfReviewDocument({
    review: getWerewolfNightReview(state),
    roomCode: state.roomCode,
    gameSequence: state.gameSequence,
  }).pages.flatMap((page) => page.blocks);
  const titleAt = blocks.findIndex(
    (block) => block.kind === 'section' && block.title === REVIEW_SECTION_TITLE,
  );
  const timeline = blocks[titleAt + 1];
  if (titleAt === -1 || timeline?.kind !== 'timeline') {
    throw new Error('[TEST] The night report has no sheriff election record');
  }
  return timeline.steps.flatMap((step) => {
    const lines = step.lines.map((line) =>
      line
        .map((inline) => {
          if (inline.kind === 'seat') return formatSeat(inline.seat);
          return inline.kind === 'tag' ? `[${inline.text}]` : inline.text;
        })
        .join(''),
    );
    return [step.title ?? '', ...lines.map((line) => `  ${line}`)].filter((line) => line !== '');
  });
}

/** The host's self-destruct card is offered while candidates speak or votes are cast. */
function isSelfDestructOffered(phase: Phase): boolean {
  return (
    phase === 'candidateSpeech' ||
    phase === 'runoffSpeech' ||
    phase === 'firstVote' ||
    phase === 'runoffVote'
  );
}

function playElections(): Sighting[] {
  // The countdown sentences read the clock; hold it so the list is the same on every run.
  vi.useFakeTimers({ now: 0, toFake: ['Date'] });
  try {
    return ELECTIONS.flatMap(({ name, moves }) => {
      const game = playBoardNightGame(ROLES, {
        isQuiet: true,
        rules: { isSheriffElectionEnabled: true },
      });
      finishNarration(game);
      const sightings: Sighting[] = [];
      const record = (moment: string): void => {
        const state = game.getGameState();
        vi.setSystemTime((deadlineOf(requireElection(state)) ?? 0) - 3000);
        for (const seat of [...ROLES.keys(), null]) {
          sightings.push(observe(state, `${name} › ${moment}`, seat));
        }
      };
      record('竞选开始');
      const play = (move: Move): void => {
        move.act(game);
        finishNarration(game);
        record(move.title);
      };
      moves.forEach(play);
      // Every outcome is announced for a few seconds before the election closes.
      if (requireElection(game.getGameState()).phase === 'result') {
        play(countdownEnds('结果公布结束'));
      }
      if (requireElection(game.getGameState()).phase !== 'completed') {
        throw new Error(`[TEST] ${name}: the election did not finish`);
      }
      return sightings;
    });
  } finally {
    vi.useRealTimers();
  }
}

// ---------------------------------------------------------------------------
// The list
// ---------------------------------------------------------------------------

/** Seat numbers, counts, and how many seats a list names do not make a new situation. */
function normalize(text: string): string {
  return text
    .replace(/\d+/g, 'N')
    .replace(/N号(?:(?:、| ｜ | )?N号)*/g, 'N号…')
    .replace(/(^|(?<= ｜ ))N(?: ｜ N)*(?= ｜ |$)/gm, 'N…');
}

class Situations {
  private readonly entries = new Map<
    string,
    { readonly lines: readonly string[]; readonly example: string; readonly moments: Set<string> }
  >();

  add(lines: readonly string[], moment: string, who: string | null): void {
    const key = normalize(lines.join('\n'));
    const existing = this.entries.get(key);
    if (existing !== undefined) {
      existing.moments.add(moment);
      return;
    }
    this.entries.set(key, {
      lines,
      example: who === null ? `「${moment}」` : `「${moment}」时的${who}`,
      moments: new Set([moment]),
    });
  }

  render(title: string): string[] {
    if (this.entries.size === 0) return [];
    return [
      `【${title}】${this.entries.size} 种`,
      ...[...this.entries.values()].flatMap((entry, index) => [
        `(${index + 1}) ${entry.moments.size} 个时刻出现，例如${entry.example}`,
        ...entry.lines.map((line) => `    ${line}`),
        '',
      ]),
    ];
  }
}

function renderCatalogue(sightings: readonly Sighting[]): string {
  const out: string[] = [
    '狼人杀警长竞选逐阶段清单',
    '',
    '本文件由测试生成（day/__tests__/sheriffElection.catalogue.test.tsx），不要手改。',
    '显示的文字变了，测试会失败；重新生成后，变化就是这份文件的差异。',
    '',
    `来源：${ELECTIONS.length} 场竞选。每一场都从一个打完的夜晚开始，通过正式命令一步步进行；`,
    '每个时刻都为每个座位和一名观战者渲染真实的界面，记下上面的文字。',
    '',
    '读法：',
    '- 「顶部状态」是座位盘上方那一栏，「底部状态栏」和「底部手牌」在屏幕下方。',
    '- 手牌后面的「确认框」是按下这张牌弹出的对话框。',
    '- 「详情面板」是点开竞选详情后看到的内容，各块文字用“｜”隔开。',
    '- 结果公布时弹出的窗口固定标题“警长竞选结果”和倒计时“N 秒后继续”写在房间页面里，',
    '  不在本清单内；它的说明文字和详情面板在。',
    '- 相同的显示只列一次：只有座位号和数字不同的，算同一种。',
    '- 只给读屏软件的说明（例如“投给3号”）和提交失败时的提示不在本清单内。',
    '',
  ];
  PHASES.forEach((phase, index) => {
    const inPhase = sightings.filter((sighting) => sighting.phase === phase);
    const personal = new Situations();
    const host = new Situations();
    const panel = new Situations();
    const resultDialog = new Situations();
    const review = new Situations();
    for (const sighting of inPhase) {
      if (sighting.resultDialog !== null) {
        resultDialog.add([sighting.resultDialog], sighting.moment, null);
      }
      review.add(sighting.review, sighting.moment, null);
      personal.add(sighting.personal, sighting.moment, sighting.who);
      if (sighting.host.length > 0) host.add(sighting.host, sighting.moment, null);
      panel.add([sighting.panel], sighting.moment, sighting.who);
    }
    out.push(
      RULE,
      `${index + 1}. ${inPhase[0]?.phaseTitle ?? '（没有任何一场竞选走到）'}（${phase}）`,
      RULE,
      '',
      ...personal.render('每个人自己看到的状态和手牌'),
      ...host.render('房主在主持管理里的牌'),
      ...resultDialog.render('结果弹窗里的说明（弹窗里同时显示详情面板）'),
      ...panel.render('详情面板'),
      ...review.render('复盘里的竞选记录'),
    );
  });
  return `${out.join('\n').trimEnd()}\n`;
}

// ---------------------------------------------------------------------------
// Sentences written for the election
// ---------------------------------------------------------------------------

const ROOM_DIRECTORY = path.resolve(__dirname, '../..');
const ELECTION_SOURCES = [
  'day/sheriffElectionPlayerActions.ts',
  'day/sheriffElectionPresentation.ts',
  'day/sheriffElectionViewModel.ts',
  'day/useSheriffElection.ts',
  'day/sheriffElectionBoardStatus.tsx',
  'components/SheriffElectionPanel.tsx',
  'components/SheriffElectionReadOnly.tsx',
];

/** Written fragments the list cannot show, each with where they appear instead. */
const SHOWN_ELSEWHERE: Readonly<Record<string, string>> = {
  号弃票: 'screen-reader label of an abstaining seat',
  的投票人: "screen-reader label of a candidate's voters",
  警长候选人: 'screen-reader label of the ballot',
  投票提交中: 'spinner while a ballot is being sent',
  竞选投票: 'names the command in the failure message when a ballot cannot be sent',
  推进竞选: 'names the command in the failure message when the host cannot advance',
};

/** Every Chinese fragment written in a source file: literals, template pieces, and JSX text. */
function collectWrittenFragments(relativePath: string): string[] {
  const filePath = path.join(ROOM_DIRECTORY, relativePath);
  const source = ts.createSourceFile(
    filePath,
    fs.readFileSync(filePath, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const fragments: string[] = [];
  const keep = (text: string): void => {
    const trimmed = text.trim();
    if (/\p{Script=Han}/u.test(trimmed)) fragments.push(trimmed);
  };
  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteralLike(node) || ts.isJsxText(node)) keep(node.text);
    if (ts.isTemplateExpression(node)) {
      keep(node.head.text);
      for (const span of node.templateSpans) keep(span.literal.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return fragments;
}

const SIGHTINGS = playElections();

describe('sheriff election step-by-step list', () => {
  it('matches the generated list of what every viewer sees in every phase', () => {
    verifyCatalogue('werewolf-sheriff', renderCatalogue(SIGHTINGS));
  });

  it('reaches every phase of the election', () => {
    expect([...new Set(SIGHTINGS.map((sighting) => sighting.phase))].sort()).toEqual(
      [...PHASES].sort(),
    );
  });

  it('shows every sentence written for the election in some played election', () => {
    const shown = SIGHTINGS.flatMap((sighting) => [
      ...sighting.personal,
      ...sighting.host,
      sighting.panel,
      sighting.resultDialog ?? '',
      ...sighting.review,
    ]).join('\n');
    const unshown = [...new Set(ELECTION_SOURCES.flatMap(collectWrittenFragments))]
      .filter((fragment) => !shown.includes(fragment))
      .sort();

    // Exactly the listed exceptions: a new unshown sentence fails, and so does a stale exception.
    expect(unshown).toEqual(Object.keys(SHOWN_ELSEWHERE).sort());
  });
});
