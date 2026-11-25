/**
 * Shared pieces of the generated step-by-step lists: one list per game whose night runs on the
 * step mechanism. A list records what every actor is shown at every step of nights played
 * through production commands, so a change to any displayed sentence is a diff of that file.
 */

import fs from 'node:fs';
import path from 'node:path';

import ts from 'typescript';

import { formatSeat } from '../../room/formatSeat';
import type { StepPresentation } from '../types';

export const CATALOGUE_RULE = '='.repeat(72);

interface Entry {
  readonly lines: readonly string[];
  readonly example: string;
  readonly caseNames: Set<string>;
}

/** The distinct things shown in one place, each with how many played cases show it. */
export class Situations {
  private readonly entries = new Map<string, Entry>();

  /**
   * @param normalize maps two displays of the same situation to the same text
   * @param unit what one played case is called, e.g. "个夜晚"
   */
  constructor(
    private readonly normalize: (text: string) => string,
    private readonly unit: string,
  ) {}

  add(lines: readonly string[], caseName: string, who: string | null): void {
    const key = this.normalize(lines.join('\n'));
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
      `(${index + 1}) ${entry.caseNames.size} ${this.unit}出现，例如${entry.example}`,
      ...entry.lines.map((line) => `    ${line}`),
      '',
    ]);
  }
}

/** One titled group of situations; an empty group prints its note, or nothing. */
export function renderSection(
  title: string,
  situations: Situations,
  emptyNote: string | null,
): string[] {
  if (situations.size === 0) return emptyNote === null ? [] : [`【${title}】${emptyNote}`, ''];
  return [`【${title}】${situations.size} 种`, ...situations.render()];
}

export function renderStatusLine(status: string | null): string {
  return status === null ? '状态栏：（无）' : `状态栏：${status}`;
}

export function renderHand(hand: readonly string[]): string[] {
  return ['手牌：', ...hand.map((line) => `  ${line}`)];
}

/** The actor's hand as printed lines: one card per line, with what each card carries. */
export function describeHand(view: StepPresentation): readonly string[] {
  const lines: string[] = [];
  for (const action of view.actions) {
    let card = action.label;
    if (action.kind === 'pickSeats') {
      const count = action.min === action.max ? `${action.min}` : `${action.min}–${action.max}`;
      card += `（选 ${count} 名）`;
      if (action.committed !== null && action.committed.length > 0) {
        card += `，已选 ${action.committed.map((seat) => formatSeat(seat)).join(' ')}`;
      }
    }
    if (action.availability.kind === 'unavailable') {
      card += `（不可用：${action.availability.reason}）`;
    }
    lines.push(`· ${card}`);
    if (action.kind === 'view' && action.content !== null) {
      const [first = '', ...rest] = action.content.text.split('\n');
      lines.push(`  内容「${action.content.title}」${first}`, ...rest.map((line) => `    ${line}`));
    }
    if (action.kind === 'pickCard') {
      if (action.hint !== null) lines.push(`  提示：${action.hint}`);
      const cards = action.cards.map((option) =>
        option.unavailableReason === null
          ? option.label
          : `${option.label}（不可选：${option.unavailableReason}）`,
      );
      lines.push(`  底牌：${cards.join('、')}`);
    }
    if (action.kind === 'pickSeats') {
      const namesByReason = new Map<string, string[]>();
      for (const option of action.seats) {
        if (option.unavailableReason === null) continue;
        namesByReason.set(option.unavailableReason, [
          ...(namesByReason.get(option.unavailableReason) ?? []),
          formatSeat(option.seat),
        ]);
      }
      for (const [reason, names] of namesByReason) {
        lines.push(`  不可选 ${names.join(' ')}：${reason}`);
      }
    }
  }
  return lines;
}

/** What one actor was shown at one step of a played night. */
export interface PlayedStepSighting {
  readonly stepId: string;
  /** The actor, as the list names them: seat and role. */
  readonly who: string;
  readonly view: StepPresentation;
}

/** One night played through production commands. */
export interface PlayedNight {
  readonly name: string;
  readonly sightings: readonly PlayedStepSighting[];
}

function describeSighting(sighting: PlayedStepSighting): readonly string[] {
  return [renderStatusLine(sighting.view.message), ...renderHand(describeHand(sighting.view))];
}

/** Render the list for a night whose steps only show information to their actors. */
export function renderViewNightCatalogue(input: {
  readonly heading: string;
  readonly generatedBy: string;
  /** What one played night is called, e.g. "个板子". */
  readonly unit: string;
  readonly stepOrder: readonly string[];
  readonly nights: readonly PlayedNight[];
  readonly normalize: (text: string) => string;
}): string {
  const out: string[] = [
    input.heading,
    '',
    `本文件由测试生成（${input.generatedBy}），不要手改。`,
    '显示的文字变了，测试会失败；重新生成后，变化就是这份文件的差异。',
    '',
    `来源：${input.nights.length} ${input.unit}。每一局都从入座、发牌开始，通过正式命令打完夜晚，`,
    '这里记下的是每个行动者在自己屏幕上实际看到的文字。',
    '',
    '读法：',
    '- 步骤按夜晚里的先后顺序排列。',
    '- 「状态栏」是行动者屏幕上方的那一句；「手牌」是他能按的牌，一行一张。',
    '- 查看类的牌按下后直接显示「内容」，没有确认框；看过即从手牌里消失。',
    '- 相同的显示只列一次：只有座位号、玩家名不同而其余文字相同的，算同一种。',
    '- 进度句（“已查看 3/12”）和非行动者看到的等待提示由网页端生成，不在本清单内。',
    '',
  ];
  input.stepOrder.forEach((stepId, index) => {
    const shown = new Situations(input.normalize, input.unit);
    let title: string | null = null;
    for (const night of input.nights) {
      for (const sighting of night.sightings) {
        if (sighting.stepId !== stepId) continue;
        title = sighting.view.title;
        shown.add(describeSighting(sighting), night.name, sighting.who);
      }
    }
    out.push(
      CATALOGUE_RULE,
      `${index + 1}. ${title ?? '（没有任何一局走到）'}（${stepId}）`,
      CATALOGUE_RULE,
      '',
      ...renderSection('行动者看到的', shown, '没有任何一局走到'),
    );
  });
  return `${out.join('\n').trimEnd()}\n`;
}

/** Everything the played nights showed, as one text to search for written sentences. */
export function collectPlayedText(nights: readonly PlayedNight[]): string {
  return nights
    .flatMap((night) =>
      night.sightings.flatMap((sighting) => [sighting.view.title, ...describeSighting(sighting)]),
    )
    .join('\n');
}

export interface CopyEntry {
  /** `<file name>.<key>`, e.g. `witch.selfAttacked`. */
  readonly id: string;
  readonly text: string;
}

/** Every string entry of every `defineCopy` table in one source file. */
export function collectCopy(filePath: string): CopyEntry[] {
  const source = ts.createSourceFile(
    filePath,
    fs.readFileSync(filePath, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  const entries: CopyEntry[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'defineCopy'
    ) {
      const table = node.arguments[0];
      if (table !== undefined && ts.isObjectLiteralExpression(table)) {
        for (const property of table.properties) {
          if (!ts.isPropertyAssignment(property) || !ts.isIdentifier(property.name)) continue;
          if (!ts.isStringLiteralLike(property.initializer)) continue;
          entries.push({
            id: `${path.basename(filePath, '.ts')}.${property.name.text}`,
            text: property.initializer.text,
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return entries;
}

/** A copy template as a pattern: placeholders match anything, the written words must appear. */
function toPattern(template: string): RegExp {
  const escaped = template
    .split(/\{\w+\}/)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('[\\s\\S]+?');
  return new RegExp(escaped);
}

/** The ids of written sentences that appear nowhere in the text the played cases showed. */
export function findUnshownCopy(entries: readonly CopyEntry[], shownText: string): string[] {
  return entries
    .filter((entry) => /\p{Script=Han}/u.test(entry.text))
    .filter((entry) => !toPattern(entry.text).test(shownText))
    .map((entry) => entry.id)
    .sort();
}
