# Outbox Failure and Recovery

## Terminal Delivery

- Normal delivery is limited to seven attempts. Claims persist a watchdog alarm before execution.
- An interrupted seventh attempt remains pending and is leased for terminalization, not executed an eighth time.
- The game module supplies a pure internal failure command. FibKing selection enters `preparationFailed` only while the same round is still preparing. Superseded rounds require no state transition.
- The runtime commits the internal command, receipt, and failed outbox row in one DO transaction. Broadcast follows commit. A terminalization error rolls back the domain transition and receipt; the watchdog keeps recovery scheduled.
- Failed rows retain the original effect identity and payload. Werewolf settlement failure does not change the completed game's domain state.

## Administrative Settlement Replay

The existing `X-Admin-Token` credential protects both endpoints. Never include it in source code, URLs, or incident logs.

`POST /admin/effect-replays` accepts:

```json
{
  "roomCode": "1234",
  "roomId": "<immutable DO identifier>",
  "creationId": "<room creation identifier>",
  "id": "<new UUID for this recovery request>",
  "effectId": "<original failed effect identifier>",
  "reason": "<incident reference and repaired dependency>"
}
```

Only game-owned effects explicitly permitted by their module can be replayed. Currently this permits Werewolf game-ended settlement only. Platform effects and FibKing terminal failures are not replayable through this endpoint.

The operation atomically records the request and original failed row in `effect_replays`, resets the original row to pending, and installs an alarm. It does not accept a replacement payload or allocate a new effect ID. HTTP 202 acknowledges durable acceptance, not completion.

Retry uncertain HTTP delivery with the same UUID, effect ID, and reason. Reusing the UUID with different parameters fails. A completed request remains a replay of its original acceptance; another execution requires a new UUID and an effect that is failed again.

`POST /admin/effect-replays/read` accepts `roomCode`, `roomId`, `creationId`, and `id`. The response contains the audit entry or `null`. Status progresses from `pending` to `succeeded` or `failed`, including completion time and terminal error. A successful replay removes the outbox row but preserves its audit entry.

Settlement continues to use its original deterministic reward seed, participant fingerprint, D1 result ledger, roster command ID, and user-event IDs. Recovery returns previously committed rewards instead of awarding twice. Existing eligibility rules are unchanged.

## Retention and Operations

- DO schema version 2 adds the audit table without replacing room state, receipts, or outbox rows.
- `requested_by` is `admin-token`, the shared authenticated principal. The reason identifies the operator or incident by convention; it is not independently authenticated personal identity.
- Audits live in the room DO and are deleted with explicitly deleted/expired room storage. Export required incident records before room expiry. This is not a permanent cross-room audit service.
- Fix the failing dependency before replay. Do not edit payloads, mint replacement effect IDs, or manually credit balances to work around the ledger.
- Existing already-failed FibKing rows are not automatically resurrected. The terminalization fix applies to pending delivery and subsequent failures.

## Verification

Real DO tests cover final-attempt interruption, failure before the game handler, terminal write rollback, durable watchdog recovery, schema-one migration, administrator authorization, and replay acceptance through audited completion. Settlement tests verify exact replay, participant mismatch rejection, concurrency, and corrupt-ledger rejection.
