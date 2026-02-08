# Night-1 Test Coverage Audit

> 生成日期：2026-01-23  
> 适用范围：Night-1 所有 NIGHT_STEPS 中的 schemaId

---

## 概述

本文档记录 Night-1 架构下每个 schema 的测试覆盖情况。

**测试门禁 标准**：每个 schemaId 至少需要覆盖以下之一：

1. Handler contract（锁 UI payload→ActionInput shape）
2. Resolver integration（锁 resolver 读取字段 + nightmare block edge）
3. boards integration（端到端测试）

---

## 覆盖矩阵

| schemaId              | kind       | constraints   | UI Payload Shape                                                                   | Handler Contract                                                     | Resolver Integration                         | Boards Integration                                                                                                                  | Single Source of Truth                                                      |
| --------------------- | ---------- | ------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `magicianSwap`        | swap       | `[]`          | `target=null, extra.targets: number[]`                                             | `wireProtocol.contract.test.ts`                                      | `night1.magician.swap_affects_seer.12p.integration.test.ts` | `wireProtocol.contract.test.ts`, `night1.magician.swap_affects_seer.12p.integration.test.ts`                                        | `currentNightResults.swappedSeats`                                          |
| `slackerChooseIdol`   | chooseSeat | `['notSelf']` | `target: number \| null`                                                           | `chooseSeat.batch.contract.test.ts`                                  | `chooseSeat.batch.contract.test.ts`          | ✅ `night1.steps.coverage.12p.integration.test.ts`                                                                                  | `result.idolTarget`                                                         |
| `wolfRobotLearn`      | chooseSeat | `['notSelf']` | `target: number \| null`                                                           | `chooseSeat.batch.contract.test.ts`                                  | `chooseSeat.batch.contract.test.ts`          | ✅ `night1.wolfRobot.*.12p.integration.test.ts` (3 files)                                                                           | `wolfRobotReveal`                                                           |
| `dreamcatcherDream`   | chooseSeat | `['notSelf']` | `target: number \| null`                                                           | `chooseSeat.batch.contract.test.ts`                                  | `chooseSeat.batch.contract.test.ts`          | ✅ `night1.dreamcatcher.dream.12p.integration.test.ts`                                                                              | `currentNightResults.dreamingSeat`                                          |
| `gargoyleCheck`       | chooseSeat | `[]`          | `target: number \| null`                                                           | `chooseSeat.batch.contract.test.ts`                                  | `chooseSeat.batch.contract.test.ts`          | ✅ `night1.gargoyle.check.12p.integration.test.ts`                                                                                  | `gargoyleReveal`                                                            |
| `nightmareBlock`      | chooseSeat | `[]`          | `target: number \| null`                                                           | `chooseSeat.batch.contract.test.ts`                                  | `chooseSeat.batch.contract.test.ts`          | ✅ `seer.integration.test.ts`, `night1.nightmare.*.12p.integration.test.ts`                                                         | `currentNightResults.blockedSeat`                                           |
| `guardProtect`        | chooseSeat | `[]`          | `target: number \| null`                                                           | `chooseSeat.batch.contract.test.ts`, `wireProtocol.contract.test.ts` | `chooseSeat.batch.contract.test.ts`          | ✅ `boundary.guard.test.ts`, `night1.guard.blocks_wolfkill.12p.integration.test.ts`                                                 | `currentNightResults.guardedSeat`                                           |
| `wolfKill`            | wolfVote   | `[]`          | `WOLF_VOTE { seat, target }`                                                       | `actionHandler.test.ts`, `wireProtocol.contract.test.ts`             | `wolfVote.integration.test.ts`               | ✅ `wolfVote.integration.test.ts`                                                                                                   | `currentNightResults.wolfVotesBySeat`                                       |
| `wolfQueenCharm`      | chooseSeat | `['notSelf']` | `target: number \| null`                                                           | `chooseSeat.batch.contract.test.ts`                                  | `chooseSeat.batch.contract.test.ts`          | ✅ `night1.wolfQueen.charm.12p.integration.test.ts`                                                                                 | `result.charmTarget`                                                        |
| `witchAction`         | compound   | -             | `target=null, extra.stepResults: { save: number \| null, poison: number \| null }` | `witchContract.test.ts`, `wireProtocol.contract.test.ts`             | `witchContract.test.ts`                      | ✅ `wireProtocol.contract.test.ts`, `night1.witch.save_poison_contracts.12p.integration.test.ts`                                    | `currentNightResults.savedSeat`, `currentNightResults.poisonedSeat`         |
| `seerCheck`           | chooseSeat | `[]`          | `target: number \| null`                                                           | `chooseSeat.batch.contract.test.ts`, `wireProtocol.contract.test.ts` | `seer.integration.test.ts`                   | ✅ `seer.integration.test.ts`, `magicianSwap.seerReveal.integration.test.ts`, `night1.standard.seer_reveal.12p.integration.test.ts` | `seerReveal`                                                                |
| `psychicCheck`        | chooseSeat | `[]`          | `target: number \| null`                                                           | `chooseSeat.batch.contract.test.ts`                                  | `chooseSeat.batch.contract.test.ts`          | ✅ `night1.psychic.reveal.12p.integration.test.ts`, `night1.steps.coverage.12p.integration.test.ts`                                 | `psychicReveal`                                                             |
| `hunterConfirm`       | confirm    | -             | `target=null, extra.confirmed: boolean`                                            | `wireProtocol.contract.test.ts`                                      | `actionHandler.test.ts`                      | ✅ `wireProtocol.contract.test.ts`                                                                                                  | `confirmStatus.hunter`                                                      |
| `darkWolfKingConfirm` | confirm    | -             | `target=null, extra.confirmed: boolean`                                            | `wireProtocol.contract.test.ts`                                      | `actionHandler.test.ts`                      | ✅ `wireProtocol.contract.test.ts`                                                                                                  | `confirmStatus.darkWolfKing`                                                |

---

## 测试文件索引

### Handler Contract Tests

| 文件                                                                       | 覆盖的 schemaId                                                                                                                            |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/services/engine/handlers/__tests__/chooseSeat.batch.contract.test.ts` | seerCheck, guardProtect, psychicCheck, dreamcatcherDream, nightmareBlock, gargoyleCheck, wolfRobotLearn, wolfQueenCharm, slackerChooseIdol |
| `src/services/engine/handlers/__tests__/witchContract.test.ts`             | witchAction                                                                                                                                |
| `src/services/engine/handlers/__tests__/actionHandler.test.ts`             | wolfKill, hunterConfirm, darkWolfKingConfirm                                                                                               |
| `src/services/__tests__/boards/wireProtocol.contract.test.ts`              | magicianSwap, witchAction, hunterConfirm, darkWolfKingConfirm, wolfKill, seerCheck, guardProtect                                           |

### Resolver Integration Tests

| 文件                                                                       | 覆盖的 schemaId                         |
| -------------------------------------------------------------------------- | --------------------------------------- |
| `src/services/__tests__/boards/seer.integration.test.ts`                   | seerCheck (+ nightmareBlock edge)       |
| `src/services/__tests__/boards/wolfVote.integration.test.ts`               | wolfKill                                |
| `src/services/engine/handlers/__tests__/chooseSeat.batch.contract.test.ts` | 所有 chooseSeat (nightmare block guard) |

### Boards Integration Tests

| 文件                                                                        | 覆盖的 schemaId                                                         |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `src/services/__tests__/boards/night1.magician.swap_affects_seer.12p.integration.test.ts` | magicianSwap, seerCheck                                                 |
| `src/services/__tests__/boards/wolfVote.integration.test.ts`                | wolfKill                                                                |
| `src/services/__tests__/boards/seer.integration.test.ts`                    | seerCheck                                                               |
| `src/services/__tests__/boards/boundary.guard.test.ts`                      | guardProtect                                                            |
| `src/services/__tests__/boards/wireProtocol.contract.test.ts`               | magicianSwap, witchAction, wolfKill, seerCheck, guardProtect            |
| `src/services/__tests__/boards/magicianSwap.seerReveal.integration.test.ts` | magicianSwap, seerCheck (swap→reveal chain)                             |

---

## 覆盖率统计

| 类别                 | 已覆盖 | 总数 | 覆盖率      |
| -------------------- | ------ | ---- | ----------- |
| Handler Contract     | 14/14  | 14   | 100%        |
| Resolver Integration | 14/14  | 14   | 100%        |
| Boards Integration   | 14/14  | 14   | **100%** ✅ |

> ✅ **所有 schemaId 现在都有 Boards Integration 测试覆盖**（2026-01-31 审计）

---

## 关键回归测试

### Swap → Reveal 链路

`magicianSwap.seerReveal.integration.test.ts` 验证：

- magician 交换 seat A (villager) 和 seat B (wolf)
- seer 查验 seat A
- **断言**：`seerReveal.result` 必须反映交换后的阵营（wolf）

此测试确保身份映射链路 `swap → getRoleAfterSwap → reveal` 正确。

---

## 更新记录

| 日期       | 变更                                                                 |
| ---------- | -------------------------------------------------------------------- |
| 2026-01-23 | 初始版本，Commit 5 审计完成                                          |
| 2026-01-31 | 更新：所有 6 个角色的 Boards Integration 测试已确认存在，覆盖率 100% |
