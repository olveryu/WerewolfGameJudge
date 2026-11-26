/** Exhaustiveness-checked command option lists for Worker game module boundaries. */

import type { z } from 'zod';

type Mutable<T> = T extends readonly unknown[]
  ? { -readonly [Index in keyof T]: Mutable<T[Index]> }
  : T extends object
    ? { -readonly [Key in keyof T]: Mutable<T[Key]> }
    : T;

/**
 * Build the identity over one command schema option list, checked
 * both ways against the game's command union: an option list that
 * misses a command or adds an unknown one is a compile error, so a
 * module's boundary schema cannot drift from the engine command
 * vocabulary. The command union is the explicit type argument; the
 * option tuple is inferred from the list itself:
 * `definePublicCommandOptions<GameCommand>()([...])`.
 */
export function definePublicCommandOptions<TCommand>(): <
  const TOptions extends readonly z.ZodType[],
>(
  options: TOptions &
    ([Mutable<TCommand>] extends [Mutable<z.output<TOptions[number]>>] ? unknown : never) &
    ([Mutable<z.output<TOptions[number]>>] extends [Mutable<TCommand>] ? unknown : never),
) => TOptions {
  return (options) => options;
}
