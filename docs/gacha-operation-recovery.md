# Gacha Operation Recovery

Draw and exchange requests persist their account, UUID, parameters and creation time before HTTP.
Each account has one unresolved local operation. Unknown delivery cannot replace it with a new UUID
or different parameters. An in-flight account lock rejects overlapping sends.

The recovery action on both product screens resends the original operation independently of current
ticket balance or ownership filters. A confirmed response or recognized business rejection clears
the pending record. Network/protocol failure retains it. Authentication changes reject delivery
and preserve the originating account's record.

## Retention Boundary

Automatic replay stops 24 hours after local operation creation, matching the minimum server replay
retention. The expiry dialog displays the operation ID and offers retaining it for investigation or
explicitly ending the wait after checking balances and collection. Ending the wait is not a successful
transaction acknowledgement and does not resend the old request. A later draw is a new user intent.
Browser storage deletion and simultaneous independent tabs/devices are outside this local journal's
single-operation guarantee; the server ledger still deduplicates identical UUIDs.

Migration 0050 adds request JSON to the existing atomic D1 ledger. Replay requires the same account,
operation and normalized parameters. Existing rows without parameter evidence remain stored but
return conflict instead of replaying unverifiable results. No balances or history are rewritten.

## Verification

- Client tests cover persistence across reconstruction, parameter conflicts, expiry, unknown delivery,
  overlapping requests, account changes and explicit business rejection.
- Worker runtime tests cover identical-key concurrency, changed parameters, owner isolation and
  legacy records without parameter evidence.
- Browser inspection confirmed interrupted request persistence and recovery after reload. The
  integrated browser's response interception did not complete a committed-response-loss rehearsal;
  this is not counted as verified end-to-end coverage.
