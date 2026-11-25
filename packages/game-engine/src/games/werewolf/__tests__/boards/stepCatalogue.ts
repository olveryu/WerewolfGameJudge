/**
 * The step-by-step list (D22): what every night step shows in every situation
 * the suite reaches, written out as a text file a person can read and confirm.
 */

import {
  CATALOGUE_RULE,
  renderHand,
  renderSection,
  renderStatusLine,
  Situations,
} from '../../../../platform/steps/__tests__/catalogueKit';
import {
  WEREWOLF_ROLE_DEFINITIONS,
  WEREWOLF_SHARED_STEP_OWNER_ROLE_ID,
  WEREWOLF_SHARED_STEPS,
} from '../../roles';
import { getWerewolfRoleDefinition, WEREWOLF_STEP_DEFINITIONS } from '../../roles/nightPlan';
import { NIGHT_STEP_ORDER } from '../../roles/nightStepOrder';
import type { NightCase } from './nightCases';

const UNIT = '个夜晚';

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
    '- 灰掉的牌写作“（不可用：原因）”。原因不印在牌面上，点这张灰牌时才弹出；',
    '  行动者睁眼就该知道的原因写在状态栏里。',
    '- 相同的显示只列一次：只有座位号、角色名不同而其余文字相同的，算同一种。',
    '  每一种给出一个实例和它出现在多少个夜晚里。',
    '- 不在本清单内的夜间文字只有网页端拼的两种句式，它们不随角色变化：',
    '  多人步骤的进度句（“已投 2/3”“已查看 3/12”“已全部投票，5 秒后结算（可改票或撤回）”），',
    '  见 packages/web/src/features/room/steps/__tests__/formatStepCompletion.test.ts；',
    '  其他人看到的“正在等待 … 行动”，名字取自本清单每一步的第一栏，',
    '  见 packages/web/src/features/room/model/__tests__/RoomBottomActions.test.ts。',
    '',
  ];

  NIGHT_STEP_ORDER.forEach((stepId, index) => {
    const definition = WEREWOLF_STEP_DEFINITIONS[stepId];
    if (definition === undefined) throw new Error(`[FAIL-FAST] Unknown step ${stepId}`);
    const ownerName = getWerewolfRoleDefinition(ownerRoleIdOf(stepId)).card.name;
    const audience = definition.audience === 'allSeats' ? '，全体玩家都要看' : '';
    const seen = new Situations(normalize, UNIT);
    const seenLater = new Situations(normalize, UNIT);
    const submitted = new Situations(normalize, UNIT);
    const reviewed = new Situations(normalize, UNIT);
    const labels = new Situations((text) => text, UNIT);
    for (const { name, run } of runs) {
      for (const entry of run.stepLabels) {
        if (entry.stepId === stepId) labels.add([entry.label], name, null);
      }
      for (const sighting of run.sightings) {
        if (sighting.stepId !== stepId) continue;
        const who = `${sighting.seat + 1}号${sighting.roleName}`;
        (sighting.isFollowUp ? seenLater : seen).add(
          [renderStatusLine(sighting.status), ...renderHand(sighting.hand)],
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
      CATALOGUE_RULE,
      `${index + 1}. ${ownerName} · ${definition.title}（${stepId}${audience}）`,
      CATALOGUE_RULE,
      '',
      ...renderSection('进度条上的名字，也是其他人看到的“正在等待 … 行动”里的名字', labels, null),
      ...renderSection('行动者看到的', seen, '没有夜晚到达这一步'),
      ...renderSection('做完一个动作后，同一步里接着看到的', seenLater, null),
      ...renderSection('按下之后', submitted, null),
      ...renderSection('复盘里的句子', reviewed, null),
    );
  });

  const explanations = new Situations(normalize, UNIT);
  const announcements = new Situations(normalize, UNIT);
  const daytimeViews = new Situations(normalize, UNIT);
  for (const { name, run } of runs) {
    for (const line of run.reviewLines) {
      if (line.stepId === null) explanations.add([line.text], name, null);
    }
    for (const line of run.outcome.announcements) announcements.add([line], name, null);
    for (const line of run.daytimeViews) daytimeViews.add([line], name, null);
  }
  out.push(
    CATALOGUE_RULE,
    '夜晚之后',
    CATALOGUE_RULE,
    '',
    ...renderSection('复盘里的说明句（不属于某一步）', explanations, null),
    ...renderSection('次日的公告', announcements, null),
    ...renderSection('次日个人可以打开的牌', daytimeViews, null),
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
