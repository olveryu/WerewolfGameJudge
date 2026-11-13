import { vi } from 'vitest';
import { z } from 'zod';

const requestSchema = z.object({
  contents: z.tuple([z.object({ parts: z.tuple([z.object({ text: z.string() })]) })]),
});
const payloadSchema = z.looseObject({ category: z.string() });

/** Replace model HTTP requests while preserving the real provider and workflow steps. */
export function mockWordSupplyModel(
  candidate: Record<string, unknown> | Record<string, unknown>[],
  review: unknown,
) {
  const requests: z.output<typeof payloadSchema>[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>().mockImplementation(async (_input, init) => {
      const request = requestSchema.parse(JSON.parse(z.string().parse(init?.body)));
      const payload = payloadSchema.parse(JSON.parse(request.contents[0].parts[0].text));
      requests.push(payload);
      let output: unknown;
      if (requests.length === 1)
        output = {
          candidates: (Array.isArray(candidate) ? candidate : [candidate]).map((item) => ({
            ...item,
            category: payload.category,
          })),
        };
      else if (requests.length === 2) output = { reviews: [review] };
      else throw new Error('Unexpected external HTTP request');
      return Response.json({
        candidates: [
          { finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(output) }] } },
        ],
      });
    }),
  );
  return requests;
}
