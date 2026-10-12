/** Bounded Gemini structured-output transport shared by the editorial word providers. */
import { z } from 'zod';

const REQUEST_TIMEOUT_MS = 120_000;
const responseSchema = z.object({
  candidates: z
    .array(
      z.object({
        finishReason: z.literal('STOP'),
        content: z.object({
          parts: z.array(z.object({ text: z.string(), thought: z.boolean().optional() })).min(1),
        }),
      }),
    )
    .length(1),
});

/**
 * One non-retried structured request; `providerLabel` names the calling game
 * in every error so failures stay attributable in logs.
 */
export async function requestStructuredOutput<Output>(options: {
  readonly apiKey: string;
  readonly model: string;
  readonly providerLabel: string;
  readonly schema: z.ZodType<Output>;
  readonly systemPrompt: string;
  readonly payload: unknown;
  readonly fetchImpl?: typeof fetch;
}): Promise<Output> {
  const fetchImpl = options.fetchImpl ?? fetch;
  if (options.apiKey.length === 0)
    throw new Error(`${options.providerLabel} provider requires GEMINI_API_KEY`);
  const signal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetchImpl.call(
      globalThis,
      `https://generativelanguage.googleapis.com/v1beta/models/${options.model}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': options.apiKey },
        signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: options.systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: JSON.stringify(options.payload) }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseJsonSchema: z.toJSONSchema(options.schema, {
              target: 'openapi-3.0',
              override: ({ jsonSchema }) => {
                delete jsonSchema.minLength;
                delete jsonSchema.maxLength;
                delete jsonSchema.minItems;
                delete jsonSchema.maxItems;
              },
            }),
          },
        }),
      },
    );
  } catch {
    throw new Error(
      signal.aborted
        ? `${options.providerLabel} provider [timedOut]`
        : `${options.providerLabel} provider [requestFailed]`,
    );
  }
  if (!response.ok) throw new Error(`${options.providerLabel} provider HTTP ${response.status}`);
  try {
    const value: unknown = await response.json();
    const first = responseSchema.parse(value).candidates[0];
    if (first === undefined) throw new Error('Missing provider candidate');
    const content: unknown = JSON.parse(
      first.content.parts
        .filter((part) => part.thought !== true)
        .map((part) => part.text)
        .join(''),
    );
    return options.schema.parse(content);
  } catch {
    throw new Error(`${options.providerLabel} provider [invalidOutput]`);
  }
}
