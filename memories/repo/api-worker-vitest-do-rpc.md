# API Worker Vitest + Durable Object RPC Notes

- `packages/api-worker/vitest.config.mts` has `include: ['src/__tests__/**/*.test.ts']`; running
  `pnpm -F @werewolf/api-worker test -- src/__tests__/fibRoom.test.ts` still collects the worker
  test batch in this setup. Use `-t` only as a name filter, not as proof that one file was isolated.
- For `GameRoom` generic engine fail-fast before `initState`, direct first RPC through the stub can
  hang in the Workers test pool. Use `runInDurableObject(stub, instance => instance.engineAction(...))`
  to verify the DO method branch itself; initialized generic RPC paths are still covered through the
  real stub.
