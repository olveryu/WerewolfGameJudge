/**
 * geminiConfig — shared Gemini / Workers AI constants.
 *
 * Single source for the model ids, OpenAI-compatible base, and timeout used by both the
 * public chat proxy (geminiProxy) and the fibking word generator (fibWordSource).
 */

export const GEMINI_OPENAI_BASE = 'https://generativelanguage.googleapis.com/v1beta/openai';
export const GEMINI_MODEL = 'gemini-3.1-flash-lite';
export const WORKERS_AI_MODEL = '@cf/google/gemma-4-26b-a4b-it';
export const GEMINI_TIMEOUT_MS = 15_000;
