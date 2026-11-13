/** Bounded Gemini native structured output, shared by editorial providers. */
import { z } from 'zod';

import { type AiContext, parseAiOutput, readAiJson } from './aiError';
import { requestGemini } from './geminiRequest';

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

interface StructuredOutputOptions<Output> {
  readonly apiKey: string;
  readonly model: string;
  readonly context: Omit<AiContext, 'model'>;
  readonly schema: z.ZodType<Output>;
  readonly systemPrompt: string;
  readonly payload: unknown;
  readonly fetchImpl?: typeof fetch;
}

/** The provider schema stays complete; a custom decoder owns all local output validation. */
export function requestStructuredOutput<Output, Result>(
  options: StructuredOutputOptions<Output> & { readonly parseOutput: (output: unknown) => Result },
): Promise<Result>;
export function requestStructuredOutput<Output>(
  options: StructuredOutputOptions<Output>,
): Promise<Output>;
export async function requestStructuredOutput<Output, Result>(
  options: StructuredOutputOptions<Output> & {
    readonly parseOutput?: (output: unknown) => Result;
  },
): Promise<Output | Result> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const context = { ...options.context, model: options.model };
  const signal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const privateValues = [options.apiKey, options.systemPrompt, options.payload];
  const body = JSON.stringify({
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
  });
  return requestGemini({
    context,
    protocol: 'native',
    requestBytes: new TextEncoder().encode(body).byteLength,
    apiKey: options.apiKey,
    signal,
    privateValues,
    request: () =>
      fetchImpl.call(
        globalThis,
        `https://generativelanguage.googleapis.com/v1beta/models/${options.model}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': options.apiKey },
          signal,
          body,
        },
      ),
    parseResponse: async (response) => {
      const value = await readAiJson(context, response, signal, privateValues);
      const first = parseAiOutput(
        context,
        'responseEnvelope',
        () => responseSchema.parse(value).candidates[0],
      );
      if (first === undefined) throw new Error('Missing validated provider candidate');
      const content = parseAiOutput(context, 'contentJson', (): unknown =>
        JSON.parse(
          first.content.parts
            .filter((part) => part.thought !== true)
            .map((part) => part.text)
            .join(''),
        ),
      );
      return parseAiOutput(context, 'outputValidation', () => {
        return options.parseOutput === undefined
          ? options.schema.parse(content)
          : options.parseOutput(content);
      });
    },
  });
}
