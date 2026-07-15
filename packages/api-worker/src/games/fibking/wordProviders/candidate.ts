/** Strict candidate validation shared by every Fib word provider adapter. */

import {
  FIB_DEFINITION_MAX_LENGTH,
  FIB_DEFINITION_MIN_LENGTH,
  FIB_WORD_MAX_LENGTH,
  FIB_WORD_MIN_LENGTH,
  type FibWordSource,
} from '@werewolf/game-engine/games/fibking/public';
import { z } from 'zod';

import type { FibWordCandidate } from './types';

const fibWordCandidatePayloadSchema = z.strictObject({
  word: z.string().trim().min(FIB_WORD_MIN_LENGTH).max(FIB_WORD_MAX_LENGTH),
  definition: z.string().trim().min(FIB_DEFINITION_MIN_LENGTH).max(FIB_DEFINITION_MAX_LENGTH),
});

export const FIB_WORD_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['word', 'definition'],
  properties: {
    word: {
      type: 'string',
      minLength: FIB_WORD_MIN_LENGTH,
      maxLength: FIB_WORD_MAX_LENGTH,
    },
    definition: {
      type: 'string',
      minLength: FIB_DEFINITION_MIN_LENGTH,
      maxLength: FIB_DEFINITION_MAX_LENGTH,
    },
  },
} as const;

export function parseFibWordCandidate(
  value: unknown,
  source: FibWordSource,
  avoidWords: readonly string[],
): FibWordCandidate {
  const payload = fibWordCandidatePayloadSchema.parse(value);
  if (avoidWords.includes(payload.word)) {
    throw new Error(`Fib word provider ${source} returned an avoided word: ${payload.word}`);
  }
  return { ...payload, source };
}

export function parseFibWordCandidateJson(
  value: string,
  source: FibWordSource,
  avoidWords: readonly string[],
): FibWordCandidate {
  return parseFibWordCandidate(JSON.parse(value), source, avoidWords);
}
