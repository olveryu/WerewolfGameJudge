export interface WerewolfStepAudioKeys {
  readonly begin: string | null;
  readonly end: string | null;
}

export type WerewolfStepAudio<TContext> = ((context: TContext) => WerewolfStepAudioKeys) & {
  readonly keys: WerewolfStepAudioKeys;
};

/** Declare the filename keys and provide the runtime audio resolver for a Werewolf step. */
export function defineWerewolfStepAudio<TContext>(
  begin: string | null,
  end: string | null = begin,
): WerewolfStepAudio<TContext> {
  const keys = { begin, end };
  return Object.assign((_context: TContext) => keys, { keys });
}
