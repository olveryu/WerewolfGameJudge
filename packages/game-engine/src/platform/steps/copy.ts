/** Define the only allowed source for user-facing copy in a step module. */
export function defineCopy<const T extends Readonly<Record<string, string>>>(table: T): T {
  return table;
}

export const STEP_COPY = defineCopy({
  skip: '不用技能',
  chooseOne: '请选择要{name}的玩家',
  chooseExact: '请选择{name}名要{action}的玩家',
  chooseRange: '请选择{name}名要{action}的玩家',
  clickAction: '请点击「{action}」',
  skippablePrompt: '{prompt}，如不使用请点击「{skip}」',
  confirmationTitle: '{phrase}？',
  reviewNotDone: '未{name}',
  viewAction: '查看{title}',
  seatListSeparator: '、',
  alreadySubmitted: '已提交',
  hintSeparator: '。',
});

export type CopyParams = Readonly<Record<string, string | number>>;

/** Render named placeholders and fail fast when a template parameter is missing. */
export function renderCopy(template: string, params: CopyParams = {}): string {
  return template.replace(/\{([^{}]+)\}/g, (_placeholder, key: string) => {
    if (!(key in params)) {
      throw new Error(`[FAIL-FAST] Missing copy parameter: ${key}`);
    }
    return String(params[key]);
  });
}
