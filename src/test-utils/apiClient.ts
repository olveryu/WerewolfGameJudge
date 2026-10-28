/** Test double for the composed `apiClient`: resolve the next request with a raw JSON value. */
import type { JsonRequestSpec } from '@/platform/http/ApiClient';
import { apiClient } from '@/platform/http/client';

type JsonSpy = jest.SpiedFunction<typeof apiClient.json>;

/** Spy on `apiClient.json`; resolves each queued value through the request's own decoder. */
export function spyOnApiJson(): JsonSpy {
  return jest.spyOn(apiClient, 'json');
}

/** Queue one JSON response that is decoded by the next request's `decode`. */
export function respondWithJson(spy: JsonSpy, value: unknown): void {
  spy.mockImplementationOnce(async (spec: JsonRequestSpec<unknown>) => spec.decode(value));
}

/** Read the request spec of the Nth `apiClient.json` call. */
export function requestSpecAt(spy: JsonSpy, index: number): JsonRequestSpec<unknown> {
  const call = spy.mock.calls[index];
  if (call === undefined) throw new Error(`apiClient.json was not called ${index + 1} times`);
  return call[0];
}
