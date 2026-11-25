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
  blockedPrompt: '{reason}，请点击「{action}」',
  skippablePrompt: '{prompt}，如不使用请点击「{skip}」',
  confirmationTitle: '{phrase}？',
  reviewNotDone: '未{name}',
  viewAction: '查看{title}',
  seatListSeparator: '、',
  hintSeparator: '。',
  staleStep: '当前行动步骤已变化，请重新选择',
});

/** The one sentence shown when a submission no longer matches the current step. */
export const STEP_STALE_MESSAGE = STEP_COPY.staleStep;

/**
 * The whole status line of an actor whose skill cards are all greyed out: why, and the one
 * card left to press. It replaces the step's other hints.
 */
export function renderBlockedPrompt(reason: string, actionLabel: string): string {
  return renderCopy(STEP_COPY.blockedPrompt, { reason, action: actionLabel });
}

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
