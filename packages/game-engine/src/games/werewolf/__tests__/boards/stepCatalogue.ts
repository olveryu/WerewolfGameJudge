/**
 * The step-by-step list (D22): what every night step shows in every situation
 * the suite reaches, written out as a text file a person can read and confirm.
 */

import {
  WEREWOLF_ROLE_DEFINITIONS,
  WEREWOLF_SHARED_STEP_OWNER_ROLE_ID,
  WEREWOLF_SHARED_STEPS,
} from '../../roles';
import { getWerewolfRoleDefinition, WEREWOLF_STEP_DEFINITIONS } from '../../roles/nightPlan';
import { NIGHT_STEP_ORDER } from '../../roles/nightStepOrder';
import type { NightCase } from './nightCases';

const RULE = '='.repeat(72);

/** Longest first, so a name that contains another is replaced whole. */
const ROLE_NAMES = WEREWOLF_ROLE_DEFINITIONS.map((role) => role.card.name).sort(
  (first, second) => second.length - first.length,
);

/** Two displays are the same situation when they differ only in seat numbers and role names. */
function normalize(text: string): string {
  let normalized = text
    .replace(/\d+/g, 'N')
    .replace(/N号(?:[ 、]N号)+/g, 'N号…')
    .replace(/N(?:、N)+号/g, 'N…号');
  for (const name of ROLE_NAMES) normalized = normalized.split(name).join('〔角色〕');
  // The order in which bottom cards happen to be dealt, or in which refused seats are grouped,
  // is not a different situation.
  const lines = normalized.split('\n');
  const isRefusal = (line: string): boolean => line.trimStart().startsWith('不可选 ');
  for (let start = 0; start < lines.length; start += 1) {
    let end = start;
    while (end < lines.length && isRefusal(lines[end] ?? '')) end += 1;
    if (end - start > 1) lines.splice(start, end - start, ...lines.slice(start, end).sort());
    start = Math.max(start, end);
  }
  return lines
    .map((line) => {
      const marker = '底牌：';
      const at = line.indexOf(marker);
      if (at === -1) return line;
      const cards = line
        .slice(at + marker.length)
        .split('、')
        .sort();
      return `${line.slice(0, at + marker.length)}${cards.join('、')}`;
    })
    .join('\n');
}

interface Entry {
  readonly lines: readonly string[];
  readonly example: string;
  readonly caseNames: Set<string>;
}

class Situations {
  private readonly entries = new Map<string, Entry>();

  add(lines: readonly string[], caseName: string, who: string | null): void {
    const key = normalize(lines.join('\n'));
    const existing = this.entries.get(key);
    if (existing !== undefined) {
      existing.caseNames.add(caseName);
      return;
    }
    this.entries.set(key, {
      lines,
      example: who === null ? `「${caseName}」` : `「${caseName}」里的${who}`,
      caseNames: new Set([caseName]),
    });
  }

  get size(): number {
    return this.entries.size;
  }

  render(): string[] {
    return [...this.entries.values()].flatMap((entry, index) => [
      `(${index + 1}) ${entry.caseNames.size} 个夜晚出现，例如${entry.example}`,
      ...entry.lines.map((line) => `    ${line}`),
      '',
    ]);
  }
}

function section(title: string, situations: Situations, emptyNote: string | null): string[] {
  if (situations.size === 0) return emptyNote === null ? [] : [`【${title}】${emptyNote}`, ''];
  return [`【${title}】${situations.size} 种`, ...situations.render()];
}

function ownerRoleIdOf(stepId: string): string {
  if (WEREWOLF_SHARED_STEPS.some((step) => step.id === stepId)) {
    return WEREWOLF_SHARED_STEP_OWNER_ROLE_ID;
  }
  const owner = WEREWOLF_ROLE_DEFINITIONS.find((role) =>
    role.steps.some((step) => step.id === stepId),
  );
  if (owner === undefined) throw new Error(`[FAIL-FAST] Step ${stepId} belongs to no role`);
  return owner.id;
}

function statusLine(status: string | null): string {
  return status === null ? '状态栏：（无）' : `状态栏：${status}`;
}

function handLines(hand: readonly string[]): string[] {
  return ['手牌：', ...hand.map((line) => `  ${line}`)];
}

/** Render the whole list from the played nights. */
export function renderStepCatalogue(cases: readonly NightCase[]): string {
  const runs = cases.map((nightCase) => ({ name: nightCase.name, run: nightCase.play() }));
  const out: string[] = [
    '狼人杀首夜逐步骤清单',
    '',
    '本文件由测试生成（night1.catalogue.integration.test.ts），不要手改。',
    '显示的文字变了，测试会失败；重新生成后，变化就是这份文件的差异。',
    '',
    `来源：${runs.length} 个夜晚。每个夜晚都从发牌开始，通过正式命令一步步打完，`,
    '这里记下的是每个行动者在自己屏幕上实际看到的文字。',
    '',
    '读法：',
    '- 步骤按夜晚里的先后顺序排列。',
    '- 「状态栏」是行动者屏幕上方的那一句；「手牌」是他能按的牌，一行一张。',
    '- 相同的显示只列一次：只有座位号、角色名不同而其余文字相同的，算同一种。',
    '  每一种给出一个实例和它出现在多少个夜晚里。',
    '- 进度句（“已投 2/3”“已查看 3/12”）和非行动者看到的等待提示由网页端生成，',
    '  不在本清单内。',
    '',
  ];

  NIGHT_STEP_ORDER.forEach((stepId, index) => {
    const definition = WEREWOLF_STEP_DEFINITIONS[stepId];
    if (definition === undefined) throw new Error(`[FAIL-FAST] Unknown step ${stepId}`);
    const ownerName = getWerewolfRoleDefinition(ownerRoleIdOf(stepId)).card.name;
    const audience = definition.audience === 'allSeats' ? '，全体玩家都要看' : '';
    const seen = new Situations();
    const seenLater = new Situations();
    const submitted = new Situations();
    const reviewed = new Situations();
    for (const { name, run } of runs) {
      for (const sighting of run.sightings) {
        if (sighting.stepId !== stepId) continue;
        const who = `${sighting.seat + 1}号${sighting.roleName}`;
        (sighting.isFollowUp ? seenLater : seen).add(
          [statusLine(sighting.status), ...handLines(sighting.hand)],
          name,
          who,
        );
      }
      for (const submission of run.submissions) {
        if (submission.stepId !== stepId) continue;
        submitted.add(
          [
            `按下：${submission.action}`,
            submission.confirmation === null
              ? '确认框：（没有，直接显示内容）'
              : `确认框：${submission.confirmation}`,
            ...(submission.result === null ? [] : [`结果：${submission.result}`]),
            ...(submission.after.length === 0
              ? []
              : ['之后还能操作：', ...submission.after.map((line) => `  ${line}`)]),
          ],
          name,
          `${submission.seat + 1}号${submission.roleName}`,
        );
      }
      for (const line of run.reviewLines) {
        if (line.stepId === stepId) reviewed.add([line.text], name, null);
      }
    }
    out.push(
      RULE,
      `${index + 1}. ${ownerName} · ${definition.title}（${stepId}${audience}）`,
      RULE,
      '',
      ...section('行动者看到的', seen, '没有夜晚到达这一步'),
      ...section('做完一个动作后，同一步里接着看到的', seenLater, null),
      ...section('按下之后', submitted, null),
      ...section('复盘里的句子', reviewed, null),
    );
  });

  const explanations = new Situations();
  const announcements = new Situations();
  const daytimeViews = new Situations();
  for (const { name, run } of runs) {
    for (const line of run.reviewLines) {
      if (line.stepId === null) explanations.add([line.text], name, null);
    }
    for (const line of run.outcome.announcements) announcements.add([line], name, null);
    for (const line of run.daytimeViews) daytimeViews.add([line], name, null);
  }
  out.push(
    RULE,
    '夜晚之后',
    RULE,
    '',
    ...section('复盘里的说明句（不属于某一步）', explanations, null),
    ...section('次日的公告', announcements, null),
    ...section('次日个人可以打开的牌', daytimeViews, null),
  );
  return `${out.join('\n').trimEnd()}\n`;
}

/** Every piece of text the suite showed anyone, for checking that written copy is reached. */
export function collectShownText(cases: readonly NightCase[]): string {
  return cases
    .flatMap((nightCase) => {
      const run = nightCase.play();
      return [
        ...run.sightings.flatMap((sighting) => [
          sighting.title,
          sighting.status ?? '',
          ...sighting.hand,
        ]),
        ...run.submissions.flatMap((submission) => [
          submission.action,
          submission.confirmation ?? '',
          submission.result ?? '',
          ...submission.after,
        ]),
        ...run.reviewLines.map((line) => line.text),
        ...run.outcome.unavailable,
        ...run.outcome.views,
        ...run.outcome.announcements,
        ...run.daytimeViews,
      ];
    })
    .join('\n');
}
