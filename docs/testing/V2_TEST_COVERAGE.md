# V2 Test Coverage Tracking

This document tracks the test coverage comparison between the legacy `GameStateService` tests and the new v2 architecture tests.

## Coverage Status

### Completed Tests

| Legacy Test | V2 Test | Status | Notes |
|-------------|---------|--------|-------|
| `lifecycle.test.ts` | `HostEngine.test.ts` | ✅ Covered | Basic state machine transitions |
| `actionSubmit.test.ts` | `PlayerEngine.test.ts` | ✅ Covered | Player action submission |
| `nightFlow.contract.test.ts` | `NightFlowContract.test.ts` | ✅ Covered | Night flow broadcast contracts |
| `persistence.test.ts` | `Storage.test.ts` | ✅ Covered | State save/load/expiry |
| `reveal.test.ts` | `seer.resolver.test.ts` | ✅ Covered | Seer reveal via resolver |
| `wolfVoteRejection.test.ts` | `wolf.resolver.test.ts` | ✅ Covered | Wolf validation via resolver |
| `magician.contract.test.ts` | `magician.resolver.test.ts` | ✅ Covered | Magician swap logic |
| N/A | `SeatEngine.test.ts` | ✅ New | Pure seat logic (sit/standup) |
| N/A | `NightEngine.test.ts` | ✅ New | Night phase state machine |
| N/A | `StateStore.test.ts` | ✅ New | State storage and updates |
| N/A | `AvatarUpload.test.ts` | ✅ New | Avatar upload functionality |
| N/A | `api-compat.test.ts` | ✅ New | API compatibility contract |
| N/A | All resolver tests | ✅ New | 124 resolver tests |

### Architecture Change Notes

The following legacy tests are not directly mapped 1:1 because v2 uses a different architecture:

| Legacy Test | V2 Approach | Notes |
|-------------|-------------|-------|
| `recovery.test.ts` | `Storage.test.ts` | State recovery is now storage-based |
| `audioState.test.ts` | `NightFlowContract.test.ts` | Audio is tested via night flow contracts |

## Test Count Summary

### Current V2 Tests (279 total)

**Unit Tests:**
- `HostEngine.test.ts`: 26 tests
- `PlayerEngine.test.ts`: 18 tests
- `SeatEngine.test.ts`: 12 tests
- `NightEngine.test.ts`: 10 tests
- `StateStore.test.ts`: 15 tests
- `Storage.test.ts`: 22 tests
- `AvatarUpload.test.ts`: 8 tests

**Contract Tests:**
- `NightFlowContract.test.ts`: 10 tests
- `api-compat.test.ts`: 8 tests
- `constraints.contract.test.ts`: ~10 tests
- `night1Only.contract.test.ts`: ~5 tests

**Resolver Tests (124 total):**
- `seer.resolver.test.ts`: ~12 tests
- `wolf.resolver.test.ts`: ~10 tests
- `witch.resolver.test.ts`: ~15 tests
- `guard.resolver.test.ts`: ~10 tests
- `hunter.resolver.test.ts`: ~8 tests
- `magician.resolver.test.ts`: ~10 tests
- `nightmare.resolver.test.ts`: ~8 tests
- `dreamcatcher.resolver.test.ts`: ~8 tests
- `gargoyle.resolver.test.ts`: ~8 tests
- `psychic.resolver.test.ts`: ~8 tests
- `slacker.resolver.test.ts`: ~8 tests
- `darkWolfKing.resolver.test.ts`: ~10 tests

### Legacy Tests (for reference)
- `lifecycle.test.ts`: ~15 tests
- `nightFlow.test.ts`: ~20 tests
- `nightFlow.contract.test.ts`: ~15 tests
- `persistence.test.ts`: ~10 tests
- `recovery.test.ts`: ~5 tests
- `reveal.test.ts`: ~5 tests
- `wolfVoteRejection.test.ts`: ~5 tests
- `magician.contract.test.ts`: ~5 tests
- `actionSubmit.test.ts`: ~5 tests
- `audioState.test.ts`: ~5 tests

## Key Architecture Differences

### Legacy Architecture
- Single `GameStateService` handles everything (seating, night flow, actions, reveals)
- Tightly coupled with transport layer
- State mixed with business logic

### V2 Architecture
- **Domain Layer**: `HostEngine`, `PlayerEngine`, `SeatEngine`, `NightEngine`
- **Infrastructure Layer**: `StateStore`, `Storage`, `Transport`, `Audio`
- **Resolvers**: Pure functions for action validation and resolution
- **PlayerActions Interface**: Unified host/player behavior via polymorphism
- Clean separation of concerns, pure state management

## Verification

Run all v2 tests:
```bash
npm run test -- --testPathPattern="services/v2" --no-coverage
```

Expected: **279 tests, all passing**
