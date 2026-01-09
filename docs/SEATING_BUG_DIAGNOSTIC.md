# Seating Bug Diagnostic Report

> Generated from E2E diagnostic tests

## Executive Summary

The E2E diagnostic tests have identified **4 critical bugs** in the seating system:

| Bug ID | Severity | Description |
|--------|----------|-------------|
| BUG-1 | High | HOST 入座后看不到 "我" 标识 |
| BUG-2 | High | 点击已占用座位没有冲突提示，直接显示 "入座" 模态框 |
| BUG-3 | Critical | HOST 看不到其他玩家的入座状态（座位仍显示 "空"） |
| BUG-4 | Medium | 行为不一致：Joiner 能看到自己的 "我"，但 HOST 看不到 |

## Diagnostic Evidence

### DIAG-1: Single Player Seating

**Test Scenario:** HOST 创建房间并尝试入座座位 1

**Layer A - Objective Evidence:**
```
Seat 1 BEFORE: {"seatContent":"1","hasPlayerName":true,"isEmpty":false}
Seat 1 AFTER:  {"seatContent":"1","hasPlayerName":true,"isEmpty":false}
```
- ✅ Seat shows as occupied (hasPlayerName=true, isEmpty=false)

**Layer B - Bug Symptom Evidence:**
```
B1 - "我" visible: false ❌
B2 - Re-click modal: 站起=false, 入座=true ❌
```
- ❌ "我" label not visible after taking seat
- ❌ Re-clicking seat shows "入座" instead of "站起"

**Console Logs Analysis:**
```
[HOST] [BroadcastService] Broadcasting as host: STATE_UPDATE (x5)
[HOST] [GameStateService] Initialized as Host for room: 5586
```
- ⚠️ **NO [SeatService] logs** - seating logic may not go through SeatService
- ⚠️ No `mySeatNumber` sync visible in logs

### DIAG-2: Two Player Seat Conflict

**Test Scenario:** 
1. HOST A 创建房间并入座座位 1
2. JOINER B 加入房间
3. JOINER B 尝试点击已占用的座位 1
4. JOINER B 入座座位 2
5. 检查双方视图

**Evidence Collected:**

| Observation | Expected | Actual | Status |
|-------------|----------|--------|--------|
| HOST A seat 1 state | "1我" | "1" (hasPlayerName=true) | ❌ Missing "我" |
| JOINER B sees HOST seat 1 | occupied | hasPlayerName=true, isEmpty=false | ✅ |
| Conflict on occupied seat | 冲突提示 | hasEnterModal=true | ❌ No conflict msg |
| JOINER B seat 2 state | "2我" | "2我" (visible=true) | ✅ |
| HOST A sees JOINER B seat 2 | occupied | "2空" (isEmpty=true) | ❌ Not synced |

**Message Flow Analysis:**
```
[JOINER-B] [BroadcastService] Sending to host: JOIN
[HOST-A] [BroadcastService] Received player message: JOIN
[HOST-A] [BroadcastService] Broadcasting as host: STATE_UPDATE
[HOST-A] [BroadcastService] Received host broadcast: STATE_UPDATE
[JOINER-B] [BroadcastService] Received host broadcast: STATE_UPDATE
```
- ✅ JOIN message sent and received
- ✅ HOST broadcasts STATE_UPDATE
- ❌ But HOST A's UI doesn't reflect JOINER B's seating

## Root Cause Hypothesis

Based on the evidence:

### Hypothesis 1: `mySeatNumber` not syncing locally

The absence of `[SeatService]` logs suggests:
- Seating state (`mySeatNumber`) may be set only via broadcast
- Local state is not persisted/synced correctly
- The UI reads from a different state source than what's being updated

### Hypothesis 2: HOST state override

The HOST is both:
1. Broadcasting STATE_UPDATE
2. Receiving its own broadcast

This could cause:
- Race condition between local state and broadcast state
- HOST's local seating state being overwritten by its own broadcast (which doesn't include other players' seats)

### Hypothesis 3: JOIN payload incomplete

The JOIN message may not include:
- The seat number being claimed
- Proper acknowledgment/confirmation flow

## Recommended Investigation

1. **Add logging to SeatService** - Verify if/when `mySeatNumber` is being set
2. **Trace STATE_UPDATE payload** - Check if seat assignments are included in broadcast
3. **Check `useGameRoom` hook** - Verify how seat state is derived from game state
4. **Audit JOIN handler** - Ensure HOST properly updates seat assignments on JOIN

## Test Files

- `e2e/basic.spec.ts` - 6 tests ✅
- `e2e/seating.basic.spec.ts` - 2 diagnostic tests ✅

## Screenshots

Available in Playwright report:
- `01-room-created.png`
- `02-seat-modal.png`
- `03-after-confirm.png`
- `04-reclick-seat-modal.png`
- `A-01-host-seated.png`
- `B-01-joined-room.png`
- `B-02-click-occupied-seat.png`
- `B-03-seated-at-2.png`
- `A-02-after-b-joins.png`
