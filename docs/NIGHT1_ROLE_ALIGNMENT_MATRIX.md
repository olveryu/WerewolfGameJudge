# Night-1 Role Alignment Matrix

> Updated: 2026-11-18
> Version: Handler→Facade→UI architecture

## Overview

This document records the complete behavioral alignment of all Night-1 roles/steps/actions.

## NIGHT_STEPS Order (Authoritative)

| Index | stepId                          | roleId             | audioKey                        | audioEndKey                     |
| ----- | ------------------------------- | ------------------ | ------------------------------- | ------------------------------- |
| 0     | `thiefChoose`                   | `thief`            | `thief`                         | (same)                          |
| 1     | `treasureMasterChoose`          | `treasureMaster`   | `treasureMaster`                | (same)                          |
| 2     | `cupidChooseLovers`             | `cupid`            | `cupid`                         | (same)                          |
| 3     | `cupidLoversReveal`             | `cupid`            | `cupidLoversReveal`             | `cupidLoversReveal`             |
| 4     | `magicianSwap`                  | `magician`         | `magician`                      | (same)                          |
| 5     | `slackerChooseIdol`             | `slacker`          | `slacker`                       | (same)                          |
| 6     | `wildChildChooseIdol`           | `wildChild`        | `wildChild`                     | (same)                          |
| 7     | `shadowChooseMimic`             | `shadow`           | `shadow`                        | (same)                          |
| 8     | `avengerConfirm`                | `avenger`          | `avenger`                       | (same)                          |
| 9     | `eclipseWolfQueenShelter`       | `eclipseWolfQueen` | `eclipseWolfQueen`              | (same)                          |
| 10    | `nightmareBlock`                | `nightmare`        | `nightmare`                     | (same)                          |
| 11    | `dreamcatcherDream`             | `dreamcatcher`     | `dreamcatcher`                  | (same)                          |
| 12    | `guardProtect`                  | `guard`            | `guard`                         | (same)                          |
| 13    | `silenceElderSilence`           | `silenceElder`     | `silenceElder`                  | (same)                          |
| 14    | `votebanElderBan`               | `votebanElder`     | `votebanElder`                  | (same)                          |
| 15    | `crowCurse`                     | `crow`             | `crow`                          | (same)                          |
| 16    | `wolfGirlConfess`               | `wolfGirl`         | `wolfGirlConfess`               | (same)                          |
| 17    | `wolfKill`                      | `wolf`             | `wolf`                          | (same)                          |
| 18    | `seedWolfInfect`                | `seedWolf`         | `seedWolf`                      | (same)                          |
| 19    | `wolfQueenCharm`                | `wolfQueen`        | `wolfQueen`                     | (same)                          |
| 20    | `hiddenWolfReveal`              | `hiddenWolf`       | `hiddenWolf`                    | (same)                          |
| 21    | `witchAction`                   | `witch`            | `witch`                         | (same)                          |
| 22    | `poisonerPoison`                | `poisoner`         | `poisoner`                      | (same)                          |
| 23    | `hunterConfirm`                 | `hunter`           | `hunter`                        | (same)                          |
| 24    | `darkWolfKingConfirm`           | `darkWolfKing`     | `darkWolfKing`                  | (same)                          |
| 25    | `wolfRobotLearn`                | `wolfRobot`        | `wolfRobot`                     | (same)                          |
| 26    | `seerCheck`                     | `seer`             | `seer`                          | (same)                          |
| 27    | `mirrorSeerCheck`               | `mirrorSeer`       | `mirrorSeer`                    | (same)                          |
| 28    | `drunkSeerCheck`                | `drunkSeer`        | `drunkSeer`                     | (same)                          |
| 29    | `wolfWitchCheck`                | `wolfWitch`        | `wolfWitch`                     | (same)                          |
| 30    | `gargoyleCheck`                 | `gargoyle`         | `gargoyle`                      | (same)                          |
| 31    | `pureWhiteCheck`                | `pureWhite`        | `pureWhite`                     | (same)                          |
| 32    | `psychicCheck`                  | `psychic`          | `psychic`                       | (same)                          |
| 33    | `awakenedGargoyleConvert`       | `awakenedGargoyle` | `awakenedGargoyle`              | (same)                          |
| 34    | `piperHypnotize`                | `piper`            | `piper`                         | (same)                          |
| 35    | `piperHypnotizedReveal`         | `piper`            | `piperHypnotizedReveal`         | `piperHypnotizedReveal`         |
| 36    | `awakenedGargoyleConvertReveal` | `awakenedGargoyle` | `awakenedGargoyleConvertReveal` | `awakenedGargoyleConvertReveal` |
| 37    | `seedWolfInfectReveal`          | `seedWolf`         | `seedWolfInfectReveal`          | `seedWolfInfectReveal`          |
| 38    | `wolfGirlConfessReveal`         | `wolfGirl`         | `wolfGirlConfessReveal`         | `wolfGirlConfessReveal`         |

**Contract guarantees**:

- Most steps have `audioKey === roleId`; exceptions: `cupidLoversReveal`, `piperHypnotizedReveal`, `awakenedGargoyleConvertReveal`, `seedWolfInfectReveal`, `wolfGirlConfessReveal` (independent audio)
- stepId is unique and order-stable (snapshot tested)

---

## Full Role Behavior Alignment Matrix

### 0. thiefChoose (Thief)

| Property            | Value                                                         | Description                                     |
| ------------------- | ------------------------------------------------------------- | ----------------------------------------------- |
| **schemaId**        | `thiefChoose`                                                 |                                                 |
| **kind**            | `chooseCard`                                                  | Choose 1 card from bottom cards                 |
| **constraints**     | None                                                          |                                                 |
| **canSkip**         | `false`                                                       | **Must choose**                                 |
| **prompt**          | "请选择一张底牌作为你的身份"                                  |                                                 |
| **revealKind**      | None                                                          |                                                 |
| **nightmare block** | ✅ Supported                                                  | Allows skip when blocked                        |
| **special rules**   | Must choose wolf faction card when one exists in bottom cards |                                                 |
| **result slot**     | `{ thiefChosenCard: RoleId, bottomCardStepRoles: RoleId[] }`  |                                                 |
| **failure reason**  | `必须选择一张底牌` / `底牌中有狼人阵营的牌时必须选择狼人`     |                                                 |
| **Resolver**        | Dedicated `thiefChooseResolver`                               | Validates cardIndex, wolf-card forced selection |

### 0b. treasureMasterChoose (Treasure Master)

| Property            | Value                                                                                   | Description                                                     |
| ------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| **schemaId**        | `treasureMasterChoose`                                                                  |                                                                 |
| **kind**            | `chooseCard`                                                                            | Choose 1 from 3 bottom cards                                    |
| **constraints**     | None                                                                                    |                                                                 |
| **canSkip**         | `false`                                                                                 | **Must choose**                                                 |
| **prompt**          | "请选择一张底牌作为你的身份"                                                            |                                                                 |
| **revealKind**      | None                                                                                    |                                                                 |
| **nightmare block** | ✅ Supported                                                                            | Allows skip when blocked                                        |
| **special rules**   | **Cannot choose wolf faction cards**; bottom cards fixed at 1 wolf + 1 god + 1 villager |                                                                 |
| **result slot**     | `{ treasureMasterChosenCard: RoleId, effectiveTeam, bottomCardStepRoles: RoleId[] }`    |                                                                 |
| **failure reason**  | `必须选择一张底牌` / `不能选择狼人阵营底牌`                                             |                                                                 |
| **Resolver**        | Dedicated `treasureMasterChooseResolver`                                                | Validates cardIndex, no-wolf-card check, computes effectiveTeam |

### 0c. cupidChooseLovers (Cupid)

| Property            | Value                                                  | Description                                   |
| ------------------- | ------------------------------------------------------ | --------------------------------------------- |
| **schemaId**        | `cupidChooseLovers`                                    |                                               |
| **kind**            | `multiChooseSeat`                                      | Choose 2 targets                              |
| **constraints**     | `[]`                                                   | Can choose self                               |
| **minTargets**      | `2`                                                    |                                               |
| **maxTargets**      | `2`                                                    |                                               |
| **canSkip**         | `false`                                                | **Must choose**                               |
| **prompt**          | "请选择两名玩家成为情侣，可以选择自己"                 |                                               |
| **revealKind**      | None                                                   |                                               |
| **nightmare block** | ✅ Supported                                           |                                               |
| **result slot**     | `{ loverSeats: [seatA, seatB] }`                       | Sorted before storage                         |
| **failure reason**  | `必须选择两名玩家` / `不能选择同一玩家` / `目标不存在` |                                               |
| **Resolver**        | Dedicated `cupidChooseLoversResolver`                  | Validates exactly 2, no duplicates, all exist |

### 0d. cupidLoversReveal (Lovers Reveal)

| Property              | Value                                  | Description                 |
| --------------------- | -------------------------------------- | --------------------------- |
| **schemaId**          | `cupidLoversReveal`                    |                             |
| **kind**              | `groupConfirm`                         | All-player confirm          |
| **requireAllAcks**    | `true`                                 | All players must confirm    |
| **prompt**            | "所有玩家请睁眼，请看手机确认情侣信息" |                             |
| **loverText**         | "你是情侣之一，你的另一半是：{seat}号" |                             |
| **notLoverText**      | "你不是情侣"                           |                             |
| **confirmButtonText** | "我知道了"                             |                             |
| **nightmare block**   | ❌ N/A                                 | groupConfirm needs no check |
| **failure reason**    | None                                   | Always valid                |

### 1. magicianSwap (Magician)

| Property            | Value                                         | Description                                 |
| ------------------- | --------------------------------------------- | ------------------------------------------- |
| **schemaId**        | `magicianSwap`                                |                                             |
| **kind**            | `swap`                                        | Choose two seats to swap identities         |
| **constraints**     | `[]`                                          | No constraints, can choose any two          |
| **canSkip**         | `true`                                        | Can skip                                    |
| **prompt**          | "请选择要交换的两名玩家"                      |                                             |
| **revealKind**      | None                                          | No reveal popup                             |
| **nightmare block** | ✅ Supported                                  | Resolver checks `blockedSeat === actorSeat` |
| **result slot**     | `currentNightResults.swappedSeats`            | `[seatA, seatB]`                            |
| **UI target limit** | Any two different seats                       |                                             |
| **failure reason**  | `必须选择两名交换对象` / `不能选择同一个玩家` |                                             |

### 2. slackerChooseIdol (Slacker)

| Property            | Value                            | Description            |
| ------------------- | -------------------------------- | ---------------------- |
| **schemaId**        | `slackerChooseIdol`              |                        |
| **kind**            | `chooseSeat`                     |                        |
| **constraints**     | `['notSelf']`                    | Cannot choose self     |
| **canSkip**         | `false`                          | **Must choose**        |
| **prompt**          | "请选择你的榜样"                 |                        |
| **revealKind**      | None                             |                        |
| **nightmare block** | ✅ Supported                     | Blocked → `result: {}` |
| **result slot**     | `result.idolTarget` (no updates) |                        |
| **UI target limit** | Exclude self                     |                        |
| **failure reason**  | `必须选择榜样` / `不能选择自己`  |                        |

### 3. shadowChooseMimic (Shadow)

| Property            | Value                                                                                                           | Description                   |
| ------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| **schemaId**        | `shadowChooseMimic`                                                                                             |                               |
| **kind**            | `chooseSeat`                                                                                                    |                               |
| **constraints**     | `['notSelf']`                                                                                                   | Cannot choose self            |
| **canSkip**         | `false`                                                                                                         | **Must choose**               |
| **prompt**          | "请选择你要模仿的玩家"                                                                                          |                               |
| **revealKind**      | None                                                                                                            |                               |
| **nightmare block** | ✅ Supported                                                                                                    | Blocked → valid no-op (skip)  |
| **result slot**     | `currentNightResults.shadowMimicTarget` + `avengerFaction`                                                      | Also computes avenger faction |
| **UI target limit** | Exclude self                                                                                                    |                               |
| **failure reason**  | `必须选择模仿目标` / `不能选择自己` / `目标玩家不存在`                                                          |                               |
| **special logic**   | Choose avenger → bound (Team.Third); choose wolf faction → avenger is good; choose good/third → avenger is wolf |                               |

### 4. avengerConfirm (Avenger)

| Property             | Value                                      | Description                           |
| -------------------- | ------------------------------------------ | ------------------------------------- |
| **schemaId**         | `avengerConfirm`                           |                                       |
| **kind**             | `confirm`                                  | View faction info                     |
| **constraints**      | None                                       |                                       |
| **canSkip**          | `true`                                     | Can skip                              |
| **prompt**           | "请点击下方按钮查看你的阵营信息"           |                                       |
| **revealKind**       | None (shows faction via `confirmStatusUi`) | Three outcomes: good/wolf/bound third |
| **nightmare block**  | Handler-level handling                     |                                       |
| **result slot**      | No state change                            | View-only, always valid               |
| **bottomActionText** | `'查看阵营'`                               |                                       |

### 4.5. eclipseWolfQueenShelter (Eclipse Wolf Queen)

| Property            | Value                                                                                               | Description                                      |
| ------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| **schemaId**        | `eclipseWolfQueenShelter`                                                                           |                                                  |
| **kind**            | `chooseSeat`                                                                                        | Choose a player to shelter                       |
| **constraints**     | None                                                                                                | Can choose anyone (including self)               |
| **canSkip**         | `true`                                                                                              | Can skip                                         |
| **prompt**          | "请选择要放逐的玩家，如不使用请点击「不用技能」"                                                    |                                                  |
| **revealKind**      | None                                                                                                |                                                  |
| **nightmare block** | ✅ Supported                                                                                        | Allows skip when blocked                         |
| **special rules**   | God-faction skills targeting sheltered player → effect redirects to caster (`applyShelterRedirect`) | Only affects god skills; wolf faction unaffected |
| **result slot**     | `{ shelteredSeat: number }`                                                                         | writeSlot → `currentNightResults.shelteredSeat`  |
| **failure reason**  | `目标玩家不存在`                                                                                    |                                                  |

### 5. wolfRobotLearn (Wolf Robot)

| Property            | Value                                             | Description                     |
| ------------------- | ------------------------------------------------- | ------------------------------- |
| **schemaId**        | `wolfRobotLearn`                                  |                                 |
| **kind**            | `chooseSeat`                                      |                                 |
| **constraints**     | `['notSelf']`                                     |                                 |
| **canSkip**         | `true`                                            |                                 |
| **prompt**          | "请选择要学习的玩家"                              |                                 |
| **revealKind**      | `wolfRobot`                                       | Popup shows target identity     |
| **nightmare block** | ✅ Supported                                      |                                 |
| **magician swap**   | ✅ Supported                                      | Checks post-swap identity       |
| **result slot**     | `wolfRobotReveal: { targetSeat, result: RoleId }` |                                 |
| **ack blocking**    | ✅                                                | `pendingRevealAcks += schemaId` |
| **UI target limit** | Exclude self                                      |                                 |
| **failure reason**  | `不能选择自己` / `目标玩家不存在`                 |                                 |

### 6. dreamcatcherDream (Dreamcatcher)

| Property            | Value                              | Description |
| ------------------- | ---------------------------------- | ----------- |
| **schemaId**        | `dreamcatcherDream`                |             |
| **kind**            | `chooseSeat`                       |             |
| **constraints**     | `['notSelf']`                      |             |
| **canSkip**         | `true`                             |             |
| **prompt**          | "请选择要摄梦的玩家"               |             |
| **revealKind**      | None                               |             |
| **nightmare block** | ✅ Supported                       |             |
| **result slot**     | `currentNightResults.dreamingSeat` |             |
| **UI target limit** | Exclude self                       |             |
| **failure reason**  | `不能选择自己`                     |             |

### 7. gargoyleCheck (Gargoyle)

| Property            | Value                                            | Description               |
| ------------------- | ------------------------------------------------ | ------------------------- |
| **schemaId**        | `gargoyleCheck`                                  |                           |
| **kind**            | `chooseSeat`                                     |                           |
| **constraints**     | `['notSelf']`                                    | Cannot check self         |
| **canSkip**         | `true`                                           |                           |
| **prompt**          | "请选择要查验的玩家"                             |                           |
| **revealKind**      | `gargoyle`                                       | Popup shows full identity |
| **nightmare block** | ✅ Supported                                     |                           |
| **magician swap**   | ✅ Supported                                     |                           |
| **result slot**     | `gargoyleReveal: { targetSeat, result: RoleId }` |                           |
| **ack blocking**    | ✅                                               |                           |
| **UI target limit** | All seats                                        |                           |
| **failure reason**  | `目标玩家不存在`                                 |                           |

### 8. nightmareBlock (Nightmare)

| Property            | Value                                                 | Description                         |
| ------------------- | ----------------------------------------------------- | ----------------------------------- |
| **schemaId**        | `nightmareBlock`                                      |                                     |
| **kind**            | `chooseSeat`                                          |                                     |
| **constraints**     | `[]`                                                  | Can block self (neutral judge rule) |
| **canSkip**         | `true`                                                |                                     |
| **prompt**          | "请选择要封锁的玩家"                                  |                                     |
| **revealKind**      | None                                                  |                                     |
| **nightmare block** | ❌ N/A                                                | Nightmare itself cannot be blocked  |
| **special rules**   | Blocking wolf → `wolfKillDisabled=true`               |                                     |
| **result slot**     | `currentNightResults.blockedSeat`, `wolfKillDisabled` |                                     |
| **UI target limit** | All seats                                             |                                     |
| **failure reason**  | `目标玩家不存在`                                      |                                     |

### 9. guardProtect (Guard)

| Property            | Value                             | Description                         |
| ------------------- | --------------------------------- | ----------------------------------- |
| **schemaId**        | `guardProtect`                    |                                     |
| **kind**            | `chooseSeat`                      |                                     |
| **constraints**     | `[]`                              | Can guard self (neutral judge rule) |
| **canSkip**         | `true`                            |                                     |
| **prompt**          | "请选择要守护的玩家"              |                                     |
| **revealKind**      | None                              |                                     |
| **nightmare block** | ✅ Supported                      |                                     |
| **result slot**     | `currentNightResults.guardedSeat` |                                     |
| **UI target limit** | All seats                         |                                     |
| **failure reason**  | None (canSkip=true)               |                                     |

### 9b. crowCurse (Crow)

| Property            | Value                             | Description                         |
| ------------------- | --------------------------------- | ----------------------------------- |
| **schemaId**        | `crowCurse`                       |                                     |
| **kind**            | `chooseSeat`                      |                                     |
| **constraints**     | `['notSelf']`                     | Cannot choose self                  |
| **canSkip**         | `true`                            |                                     |
| **prompt**          | "请选择要诅咒的玩家"              |                                     |
| **revealKind**      | None                              |                                     |
| **nightmare block** | ✅ Supported                      |                                     |
| **result slot**     | `currentNightResults.cursedSeat`  | Cursed player gets +1 vote next day |
| **UI target limit** | Exclude self                      |                                     |
| **failure reason**  | `不能选择自己` / `目标玩家不存在` |                                     |
| **Resolver**        | generic (writeSlot → cursedSeat)  |                                     |

### 10. wolfKill (Wolf Kill)

| Property                      | Value                                     | Description                                                                                                        |
| ----------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **schemaId**                  | `wolfKill`                                |                                                                                                                    |
| **kind**                      | `wolfVote`                                | Special: multi-wolf voting mechanism                                                                               |
| **constraints**               | `[]`                                      | Neutral judge: can attack any seat                                                                                 |
| **meeting.canSeeEachOther**   | `true`                                    | Wolves can see each other                                                                                          |
| **meeting.resolution**        | `majority`                                | Majority vote takes effect                                                                                         |
| **meeting.allowEmptyVote**    | `true`                                    | Can forfeit attack                                                                                                 |
| **prompt**                    | "请选择袭击目标"                          |                                                                                                                    |
| **emptyVoteText**             | "放弃袭击"                                |                                                                                                                    |
| **revealKind**                | None                                      |                                                                                                                    |
| **wolfKillDisabled**          | ✅ Checked                                | Nightmare blocking wolf disables attack                                                                            |
| **result slot**               | `currentNightResults.wolfVotesBySeat`     |                                                                                                                    |
| **UI target limit**           | All seats (including wolf teammates/self) |                                                                                                                    |
| **Host authoritative reject** | ✅                                        | Immune targets rejected by Host/Resolver; unified "action invalid" hint via `actionRejected` (UI does not disable) |
| **failure reason**            | `目标玩家不存在`                          |                                                                                                                    |

### 10b. seedWolfInfect (Seed Wolf Infection)

| Property               | Value                                                 | Description                                                      |
| ---------------------- | ----------------------------------------------------- | ---------------------------------------------------------------- |
| **schemaId**           | `seedWolfInfect`                                      |                                                                  |
| **kind**               | `confirm`                                             | Confirm infection of the authoritative wolf-kill target          |
| **canSkip**            | `true`                                                | Seed Wolf may retain the skill                                   |
| **prompt**             | "请查看狼人袭击目标并选择是否发动感染"                |                                                                  |
| **availability**       | Non-wolf target selected by the wolf vote             | No target and wolf targets cannot be infected                    |
| **nightmare block**    | ✅ Supported                                          |                                                                  |
| **result slot**        | `currentNightResults.seedWolfInfectionTarget`         | Records intent; final outcome is deferred                        |
| **final resolution**   | Target must retain `wolfKill` as a final death source | Guard or Witch save makes infection fail                         |
| **conversion effect**  | Cancel wolf-kill death, change target role to `wolf`  | Target's Night-1 action, effects, and private reveal are removed |
| **poison interaction** | Poison remains independent                            | A converted target still dies when it also has a poison source   |
| **failure reason**     | `本夜没有可感染的狼人袭击目标`                        |                                                                  |

### 11. wolfQueenCharm (Wolf Queen)

| Property            | Value                             | Description |
| ------------------- | --------------------------------- | ----------- |
| **schemaId**        | `wolfQueenCharm`                  |             |
| **kind**            | `chooseSeat`                      |             |
| **constraints**     | `['notSelf']`                     |             |
| **canSkip**         | `true`                            |             |
| **prompt**          | "请选择要魅惑的玩家"              |             |
| **revealKind**      | None                              |             |
| **nightmare block** | ✅ Supported                      |             |
| **result slot**     | `result.charmTarget` (no updates) |             |
| **UI target limit** | Exclude self                      |             |
| **failure reason**  | `不能选择自己` / `目标玩家不存在` |             |

### 11b. hiddenWolfReveal (Hidden Wolf)

| Property             | Value                                                             | Description                                                           |
| -------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------- |
| **schemaId**         | `hiddenWolfReveal`                                                |                                                                       |
| **kind**             | `confirm`                                                         | View wolf teammates info                                              |
| **constraints**      | None                                                              |                                                                       |
| **canSkip**          | `true`                                                            | Can skip                                                              |
| **prompt**           | "请点击下方按钮查看你的狼同伴"                                    |                                                                       |
| **bottomActionText** | `'查看同伴'`                                                      |                                                                       |
| **revealKind**       | None (shows wolf teammates via `confirmStatusUi`)                 | Shows wolf teammate seat numbers                                      |
| **nightmare block**  | ❌ N/A                                                            | confirm type needs no check                                           |
| **result slot**      | `confirmStatus: { kind: 'wolfTeammates', ... }`                   | View-only, always valid                                               |
| **special rules**    | team=Good (seer checks as good); doesn't participate in wolf vote | `recognition: { canSeeWolves: false, participatesInWolfVote: false }` |
| **UI behavior**      | Click button to view wolf teammate seat list                      |                                                                       |
| **failure reason**   | None                                                              | Always valid                                                          |

### 12. witchAction (Witch)

| Property            | Value                                                                      | Description                    |
| ------------------- | -------------------------------------------------------------------------- | ------------------------------ |
| **schemaId**        | `witchAction`                                                              |                                |
| **kind**            | `compound`                                                                 | Compound action: save + poison |
| **steps**           |                                                                            |                                |
| - save              | `confirmTarget`, constraints=`['notSelf']`                                 | Cannot self-save               |
| - poison            | `chooseSeat`, constraints=`[]`                                             | Can poison any seat            |
| **canSkip**         | Both steps can be skipped                                                  |                                |
| **prompt**          | "女巫请行动"                                                               |                                |
| **revealKind**      | None                                                                       |                                |
| **nightmare block** | ✅ Supported                                                               |                                |
| **special rules**   | Cannot use both on same night                                              |                                |
| **witchContext**    | `{ killedIndex, canSave, canPoison }`                                      | Set by Host                    |
| **result slot**     | `currentNightResults.savedSeat`, `poisonedSeat`                            |                                |
| **UI target limit** | save: killed player (not self); poison: any                                |                                |
| **failure reason**  | `女巫不能自救` / `只能救被狼人袭击的玩家` / `同一晚不能同时使用解药和毒药` |                                |

### 12b. poisonerPoison (Poisoner)

| Property            | Value                                                                                | Description         |
| ------------------- | ------------------------------------------------------------------------------------ | ------------------- |
| **schemaId**        | `poisonerPoison`                                                                     |                     |
| **kind**            | `chooseSeat`                                                                         |                     |
| **constraints**     | `[]`                                                                                 | Can choose any seat |
| **canSkip**         | `true`                                                                               |                     |
| **prompt**          | "请选择要毒杀的玩家"                                                                 |                     |
| **revealKind**      | None                                                                                 |                     |
| **nightmare block** | ✅ Supported                                                                         |                     |
| **special rules**   | One-time poison (uses: 1); when poisoner is present, wolves cannot attack on night 1 |                     |
| **result slot**     | `currentNightResults.poisonedSeat`                                                   |                     |
| **UI target limit** | All seats                                                                            |                     |
| **failure reason**  | `目标玩家不存在`                                                                     |                     |
| **Resolver**        | generic (writeSlot → poisonedSeat)                                                   |                     |

### 13. seerCheck (Seer)

| Property            | Value                                                  | Description         |
| ------------------- | ------------------------------------------------------ | ------------------- |
| **schemaId**        | `seerCheck`                                            |                     |
| **kind**            | `chooseSeat`                                           |                     |
| **constraints**     | `['notSelf']`                                          | Cannot check self   |
| **canSkip**         | `true`                                                 |                     |
| **prompt**          | "请选择要查验的玩家"                                   |                     |
| **revealKind**      | `seer`                                                 | Popup shows faction |
| **nightmare block** | ✅ Supported                                           |                     |
| **magician swap**   | ✅ Supported                                           |                     |
| **result slot**     | `seerReveal: { targetSeat, result: '好人' \| '狼人' }` |                     |
| **ack blocking**    | ✅                                                     |                     |
| **UI target limit** | All seats                                              |                     |
| **failure reason**  | `目标玩家不存在`                                       |                     |

### 14. psychicCheck (Psychic)

| Property            | Value                                           | Description               |
| ------------------- | ----------------------------------------------- | ------------------------- |
| **schemaId**        | `psychicCheck`                                  |                           |
| **kind**            | `chooseSeat`                                    |                           |
| **constraints**     | `['notSelf']`                                   | Cannot check self         |
| **canSkip**         | `true`                                          |                           |
| **prompt**          | "请选择要通灵的玩家"                            |                           |
| **revealKind**      | `psychic`                                       | Popup shows full identity |
| **nightmare block** | ✅ Supported                                    |                           |
| **magician swap**   | ✅ Supported                                    |                           |
| **result slot**     | `psychicReveal: { targetSeat, result: RoleId }` |                           |
| **ack blocking**    | ✅                                              |                           |
| **UI target limit** | All seats                                       |                           |
| **failure reason**  | `目标玩家不存在`                                |                           |

### 15. hunterConfirm (Hunter)

| Property             | Value                                    | Description                       |
| -------------------- | ---------------------------------------- | --------------------------------- |
| **schemaId**         | `hunterConfirm`                          |                                   |
| **kind**             | `confirm`                                | Confirm only, no target selection |
| **prompt**           | "请点击下方按钮查看技能发动状态"         |                                   |
| **bottomActionText** | "发动状态"                               |                                   |
| **revealKind**       | None                                     |                                   |
| **nightmare block**  | ❌ N/A                                   | confirm type needs no check       |
| **result slot**      | `confirmStatus: { kind: 'hunter', ... }` |                                   |
| **UI behavior**      | Click button to confirm                  |                                   |
| **failure reason**   | None                                     | Always valid                      |

### 16. darkWolfKingConfirm (Dark Wolf King)

| Property             | Value                                          | Description  |
| -------------------- | ---------------------------------------------- | ------------ |
| **schemaId**         | `darkWolfKingConfirm`                          |              |
| **kind**             | `confirm`                                      |              |
| **prompt**           | "请点击下方按钮查看技能发动状态"               |              |
| **bottomActionText** | "发动状态"                                     |              |
| **revealKind**       | None                                           |              |
| **nightmare block**  | ❌ N/A                                         |              |
| **result slot**      | `confirmStatus: { kind: 'darkWolfKing', ... }` |              |
| **UI behavior**      | Click button to confirm                        |              |
| **failure reason**   | None                                           | Always valid |

### 17. wildChildChooseIdol (Wild Child)

| Property            | Value                            | Description            |
| ------------------- | -------------------------------- | ---------------------- |
| **schemaId**        | `wildChildChooseIdol`            |                        |
| **kind**            | `chooseSeat`                     |                        |
| **constraints**     | `['notSelf']`                    | Cannot choose self     |
| **canSkip**         | `false`                          | **Must choose**        |
| **prompt**          | "请选择你的榜样"                 |                        |
| **revealKind**      | None                             |                        |
| **nightmare block** | ✅ Supported                     | Blocked → `result: {}` |
| **result slot**     | `result.idolTarget` (no updates) |                        |
| **UI target limit** | Exclude self                     |                        |
| **failure reason**  | `必须选择榜样` / `不能选择自己`  |                        |

### 18. silenceElderSilence (Silence Elder)

| Property            | Value                              | Description         |
| ------------------- | ---------------------------------- | ------------------- |
| **schemaId**        | `silenceElderSilence`              |                     |
| **kind**            | `chooseSeat`                       |                     |
| **constraints**     | `[]`                               | Can choose any seat |
| **canSkip**         | `true`                             |                     |
| **prompt**          | "请选择要禁言的玩家"               |                     |
| **revealKind**      | None                               |                     |
| **nightmare block** | ✅ Supported                       |                     |
| **result slot**     | `currentNightResults.silencedSeat` |                     |
| **UI target limit** | All seats                          |                     |
| **failure reason**  | `目标玩家不存在`                   |                     |

### 19. votebanElderBan (Voteban Elder)

| Property            | Value                                | Description         |
| ------------------- | ------------------------------------ | ------------------- |
| **schemaId**        | `votebanElderBan`                    |                     |
| **kind**            | `chooseSeat`                         |                     |
| **constraints**     | `[]`                                 | Can choose any seat |
| **canSkip**         | `true`                               |                     |
| **prompt**          | "请选择要禁票的玩家"                 |                     |
| **revealKind**      | None                                 |                     |
| **nightmare block** | ✅ Supported                         |                     |
| **result slot**     | `currentNightResults.voteBannedSeat` |                     |
| **UI target limit** | All seats                            |                     |
| **failure reason**  | `目标玩家不存在`                     |                     |

### 20. mirrorSeerCheck (Mirror Seer)

| Property            | Value                                                        | Description                    |
| ------------------- | ------------------------------------------------------------ | ------------------------------ |
| **schemaId**        | `mirrorSeerCheck`                                            |                                |
| **kind**            | `chooseSeat`                                                 |                                |
| **constraints**     | `['notSelf']`                                                | Cannot check self              |
| **canSkip**         | `true`                                                       |                                |
| **prompt**          | "请选择要查验的玩家"                                         |                                |
| **revealKind**      | `mirrorSeer`                                                 | Popup shows faction (reversed) |
| **nightmare block** | ✅ Supported                                                 |                                |
| **magician swap**   | ✅ Supported                                                 |                                |
| **result slot**     | `mirrorSeerReveal: { targetSeat, result: '好人' \| '狼人' }` |                                |
| **ack blocking**    | ✅                                                           |                                |
| **UI target limit** | All seats                                                    |                                |
| **failure reason**  | `目标玩家不存在`                                             |                                |

### 21. drunkSeerCheck (Drunk Seer)

| Property            | Value                                                       | Description                        |
| ------------------- | ----------------------------------------------------------- | ---------------------------------- |
| **schemaId**        | `drunkSeerCheck`                                            |                                    |
| **kind**            | `chooseSeat`                                                |                                    |
| **constraints**     | `['notSelf']`                                               | Cannot check self                  |
| **canSkip**         | `true`                                                      |                                    |
| **prompt**          | "请选择要查验的玩家"                                        |                                    |
| **revealKind**      | `drunkSeer`                                                 | Popup shows faction (may be wrong) |
| **nightmare block** | ✅ Supported                                                |                                    |
| **magician swap**   | ✅ Supported                                                |                                    |
| **result slot**     | `drunkSeerReveal: { targetSeat, result: '好人' \| '狼人' }` |                                    |
| **ack blocking**    | ✅                                                          |                                    |
| **UI target limit** | All seats                                                   |                                    |
| **failure reason**  | `目标玩家不存在`                                            |                                    |

### 22. wolfWitchCheck (Wolf Witch)

| Property            | Value                                                       | Description         |
| ------------------- | ----------------------------------------------------------- | ------------------- |
| **schemaId**        | `wolfWitchCheck`                                            |                     |
| **kind**            | `chooseSeat`                                                |                     |
| **constraints**     | `['notSelf']`                                               | Cannot check self   |
| **canSkip**         | `true`                                                      |                     |
| **prompt**          | "请选择要查验的玩家"                                        |                     |
| **revealKind**      | `wolfWitch`                                                 | Popup shows faction |
| **nightmare block** | ✅ Supported                                                |                     |
| **magician swap**   | ✅ Supported                                                |                     |
| **result slot**     | `wolfWitchReveal: { targetSeat, result: '好人' \| '狼人' }` |                     |
| **ack blocking**    | ✅                                                          |                     |
| **UI target limit** | All seats                                                   |                     |
| **failure reason**  | `目标玩家不存在`                                            |                     |

### 23. pureWhiteCheck (Pure White)

| Property            | Value                                             | Description               |
| ------------------- | ------------------------------------------------- | ------------------------- |
| **schemaId**        | `pureWhiteCheck`                                  |                           |
| **kind**            | `chooseSeat`                                      |                           |
| **constraints**     | `['notSelf']`                                     | Cannot check self         |
| **canSkip**         | `true`                                            |                           |
| **prompt**          | "请选择要查验的玩家"                              |                           |
| **revealKind**      | `pureWhite`                                       | Popup shows full identity |
| **nightmare block** | ✅ Supported                                      |                           |
| **magician swap**   | ✅ Supported                                      |                           |
| **result slot**     | `pureWhiteReveal: { targetSeat, result: RoleId }` |                           |
| **ack blocking**    | ✅                                                |                           |
| **UI target limit** | All seats                                         |                           |
| **failure reason**  | `目标玩家不存在`                                  |                           |

### 24. awakenedGargoyleConvert (Awakened Gargoyle)

| Property            | Value                                                  | Description              |
| ------------------- | ------------------------------------------------------ | ------------------------ |
| **schemaId**        | `awakenedGargoyleConvert`                              |                          |
| **kind**            | `chooseSeat`                                           | Choose target to convert |
| **constraints**     | `['notSelf']`                                          | Cannot choose self       |
| **canSkip**         | `false`                                                | **Must choose**          |
| **prompt**          | "请选择要转化的玩家"                                   |                          |
| **revealKind**      | None                                                   |                          |
| **nightmare block** | ✅ Supported                                           |                          |
| **result slot**     | `currentNightResults.convertedSeat`                    |                          |
| **UI target limit** | Exclude self                                           |                          |
| **failure reason**  | `必须选择转化目标` / `不能选择自己` / `目标玩家不存在` |                          |

### 25. piperHypnotize (Piper)

| Property            | Value                                 | Description                          |
| ------------------- | ------------------------------------- | ------------------------------------ |
| **schemaId**        | `piperHypnotize`                      |                                      |
| **kind**            | `multiChooseSeat`                     | Choose multiple targets to hypnotize |
| **constraints**     | `['notSelf']`                         | Cannot choose self                   |
| **minTargets**      | `1`                                   |                                      |
| **maxTargets**      | `2`                                   | Up to 2 per night                    |
| **canSkip**         | `true`                                | Can skip                             |
| **prompt**          | "请选择要催眠的玩家（最多2人）"       |                                      |
| **revealKind**      | None                                  |                                      |
| **nightmare block** | ✅ Supported                          |                                      |
| **result slot**     | `currentNightResults.hypnotizedSeats` |                                      |
| **UI target limit** | Exclude self                          |                                      |
| **failure reason**  | `不能选择自己` / `目标玩家不存在`     |                                      |

### 25b. piperHypnotizedReveal (Hypnotized Reveal)

| Property              | Value                                  | Description                 |
| --------------------- | -------------------------------------- | --------------------------- |
| **schemaId**          | `piperHypnotizedReveal`                |                             |
| **kind**              | `groupConfirm`                         | All-player confirm          |
| **requireAllAcks**    | `true`                                 | All players must confirm    |
| **prompt**            | "所有玩家请睁眼，请看手机确认催眠信息" |                             |
| **hypnotizedText**    | "你被催眠了"                           |                             |
| **notHypnotizedText** | "你没有被催眠"                         |                             |
| **confirmButtonText** | "我知道了"                             |                             |
| **nightmare block**   | ❌ N/A                                 | groupConfirm needs no check |
| **failure reason**    | None                                   | Always valid                |

### 26. awakenedGargoyleConvertReveal (Convert Reveal)

| Property              | Value                                  | Description                 |
| --------------------- | -------------------------------------- | --------------------------- |
| **schemaId**          | `awakenedGargoyleConvertReveal`        |                             |
| **kind**              | `groupConfirm`                         | All-player confirm          |
| **requireAllAcks**    | `true`                                 | All players must confirm    |
| **prompt**            | "所有玩家请睁眼，请看手机确认转化信息" |                             |
| **convertedText**     | "你已被转化为石像鬼阵营"               |                             |
| **notConvertedText**  | "你没有被转化"                         |                             |
| **confirmButtonText** | "我知道了"                             |                             |
| **nightmare block**   | ❌ N/A                                 | groupConfirm needs no check |
| **failure reason**    | None                                   | Always valid                |

### 27. seedWolfInfectReveal (Seed Wolf Infection Reveal)

| Property              | Value                                  | Description                                    |
| --------------------- | -------------------------------------- | ---------------------------------------------- |
| **schemaId**          | `seedWolfInfectReveal`                 |                                                |
| **kind**              | `groupConfirm`                         | Final Night-1 step                             |
| **requireAllAcks**    | `true`                                 | Every seated player must confirm               |
| **prompt**            | "所有玩家请睁眼，请看手机确认感染信息" |                                                |
| **outcomes**          | `notUsed` / `failed` / `converted`     | Computed immediately before entering this step |
| **convertedText**     | "你已被种狼感染并转化为普通狼人"       | Shown only to the converted player             |
| **notConvertedText**  | "你未被感染"                           | Shown to all other players                     |
| **confirmButtonText** | "知道了"                               |                                                |
| **nightmare block**   | ❌ N/A                                 | Group confirm needs no check                   |
| **failure reason**    | None                                   | Always valid                                   |

## Night Bottom-Action Button Matrix

This section covers the role-owned buttons in the Werewolf room's bottom action panel during
night steps. It follows the shared [Room Action Hierarchy](room-shell-contract.md#room-action-hierarchy).

- **Primary** is the focused, immediate step action or the button that opens the step's action or
  status dialog. A seat tap that opens a confirmation dialog is not a bottom primary button.
- **Secondary** is an optional step action, such as skipping or an alternate vote action. It is
  not a weaker version of a required choice.
- `查看身份` is added as a secondary button for seated players during an ongoing night; it is
  primary while viewing identity in the assigned/ready phase. It is intentionally not repeated
  in every row below.
- A `—` means the step has no role-owned button in that tier. The shared `更多操作` entry may
  still occupy the panel's focus slot when there is no player primary action.
- Dialog confirmations are not bottom-panel tiers. This applies to seat confirmations, the
  group-reveal acknowledgement, status-dialog infection skip, and card selection confirmation.
  The wolf-robot hunter-status gate is the exception called out in its row.
- This is a night-action matrix, not a claim that roles without a night step have no daytime or
  death-triggered ability. Contextual seat actions and other surfaces are outside this table.

The role-step rows, labels, and schema kinds are checked against `ROLE_SPECS` and `SCHEMAS` by
`packages/web/src/__tests__/nightButtonRoleMatrix.contract.test.ts`. Keep the matrix in the same
change as role-step or button-schema changes.

### Role-specific night steps

<!-- night-role-step-buttons:start -->

| Role ID            | Role       | Night step                      | Schema kind       | Primary bottom button                                   | Secondary bottom button                    |
| ------------------ | ---------- | ------------------------------- | ----------------- | ------------------------------------------------------- | ------------------------------------------ |
| `thief`            | 盗贼       | `thiefChoose`                   | `chooseCard`      | 选择底牌                                                | —                                          |
| `treasureMaster`   | 盗宝大师   | `treasureMasterChoose`          | `chooseCard`      | 选择底牌                                                | —                                          |
| `cupid`            | 丘比特     | `cupidChooseLovers`             | `multiChooseSeat` | 确认连接（{count}人） when targets are selected         | —                                          |
| `cupid`            | 丘比特     | `cupidLoversReveal`             | `groupConfirm`    | 情侣状态                                                | —; acknowledgement is in the reveal dialog |
| `magician`         | 魔术师     | `magicianSwap`                  | `swap`            | —; second seat opens the confirmation flow              | 不用技能                                   |
| `slacker`          | 混血儿     | `slackerChooseIdol`             | `chooseSeat`      | —; seat tap opens the confirmation flow                 | —                                          |
| `wildChild`        | 野孩子     | `wildChildChooseIdol`           | `chooseSeat`      | —; seat tap opens the confirmation flow                 | —                                          |
| `shadow`           | 影子       | `shadowChooseMimic`             | `chooseSeat`      | —; seat tap opens the confirmation flow                 | —                                          |
| `avenger`          | 复仇者     | `avengerConfirm`                | `confirm`         | 查看阵营                                                | —                                          |
| `eclipseWolfQueen` | 蚀时狼妃   | `eclipseWolfQueenShelter`       | `chooseSeat`      | —; seat tap opens the confirmation flow                 | 不用技能                                   |
| `nightmare`        | 噩梦之影   | `nightmareBlock`                | `chooseSeat`      | —; seat tap opens the confirmation flow                 | 不用技能                                   |
| `dreamcatcher`     | 摄梦人     | `dreamcatcherDream`             | `chooseSeat`      | —; seat tap opens the confirmation flow                 | 不用技能                                   |
| `guard`            | 守卫       | `guardProtect`                  | `chooseSeat`      | —; seat tap opens the confirmation flow                 | 不用技能                                   |
| `silenceElder`     | 禁言长老   | `silenceElderSilence`           | `chooseSeat`      | —; seat tap opens the confirmation flow                 | 不用技能                                   |
| `votebanElder`     | 禁票长老   | `votebanElderBan`               | `chooseSeat`      | —; seat tap opens the confirmation flow                 | 不用技能                                   |
| `crow`             | 乌鸦       | `crowCurse`                     | `chooseSeat`      | —; seat tap opens the confirmation flow                 | 不用技能                                   |
| `wolfGirl`         | 狼女孩     | `wolfGirlConfess`               | `chooseSeat`      | —; seat tap opens the confirmation flow                 | —                                          |
| `wolf`             | 狼人       | `wolfKill`                      | `wolfVote`        | —; seat tap starts the vote flow                        | See shared wolf-vote buttons               |
| `seedWolf`         | 种狼       | `seedWolfInfect`                | `confirm`         | 感染                                                    | —; 不用技能 is inside the status dialog    |
| `wolfQueen`        | 狼美人     | `wolfQueenCharm`                | `chooseSeat`      | —; seat tap opens the confirmation flow                 | 不用技能                                   |
| `hiddenWolf`       | 隐狼       | `hiddenWolfReveal`              | `confirm`         | 查看同伴                                                | —                                          |
| `witch`            | 女巫       | `witchAction`                   | `compound`        | 对袭击目标用解药 when saving is available               | 不用技能                                   |
| `poisoner`         | 毒师       | `poisonerPoison`                | `chooseSeat`      | —; seat tap opens the confirmation flow                 | 不用技能                                   |
| `hunter`           | 猎人       | `hunterConfirm`                 | `confirm`         | 发动状态                                                | —                                          |
| `darkWolfKing`     | 狼王       | `darkWolfKingConfirm`           | `confirm`         | 发动状态                                                | —                                          |
| `wolfRobot`        | 机械狼人   | `wolfRobotLearn`                | `chooseSeat`      | — while selecting; 查看技能状态 after learning a hunter | 不用技能 while selecting                   |
| `seer`             | 预言家     | `seerCheck`                     | `chooseSeat`      | —; seat tap opens the confirmation flow                 | 不用技能                                   |
| `mirrorSeer`       | 灯影预言家 | `mirrorSeerCheck`               | `chooseSeat`      | —; seat tap opens the confirmation flow                 | 不用技能                                   |
| `drunkSeer`        | 酒鬼预言家 | `drunkSeerCheck`                | `chooseSeat`      | —; seat tap opens the confirmation flow                 | 不用技能                                   |
| `wolfWitch`        | 狼巫       | `wolfWitchCheck`                | `chooseSeat`      | —; seat tap opens the confirmation flow                 | 不用技能                                   |
| `gargoyle`         | 石像鬼     | `gargoyleCheck`                 | `chooseSeat`      | —; seat tap opens the confirmation flow                 | 不用技能                                   |
| `pureWhite`        | 纯白之女   | `pureWhiteCheck`                | `chooseSeat`      | —; seat tap opens the confirmation flow                 | 不用技能                                   |
| `psychic`          | 通灵师     | `psychicCheck`                  | `chooseSeat`      | —; seat tap opens the confirmation flow                 | 不用技能                                   |
| `awakenedGargoyle` | 觉醒石像鬼 | `awakenedGargoyleConvert`       | `chooseSeat`      | —; seat tap opens the confirmation flow                 | —                                          |
| `piper`            | 吹笛者     | `piperHypnotize`                | `multiChooseSeat` | 确认催眠（{count}人） when targets are selected         | 不用技能                                   |
| `piper`            | 吹笛者     | `piperHypnotizedReveal`         | `groupConfirm`    | 催眠状态                                                | —; acknowledgement is in the reveal dialog |
| `awakenedGargoyle` | 觉醒石像鬼 | `awakenedGargoyleConvertReveal` | `groupConfirm`    | 转化状态                                                | —; acknowledgement is in the reveal dialog |
| `seedWolf`         | 种狼       | `seedWolfInfectReveal`          | `groupConfirm`    | 感染状态                                                | —; acknowledgement is in the reveal dialog |
| `wolfGirl`         | 狼女孩     | `wolfGirlConfessReveal`         | `groupConfirm`    | 表白状态                                                | —; acknowledgement is in the reveal dialog |

<!-- night-role-step-buttons:end -->

### Shared wolf-vote buttons

<!-- shared-wolf-vote-buttons:start -->

| Roles with `recognition.participatesInWolfVote`                                                                                                                                  | Primary bottom button            | Secondary bottom buttons        |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | ------------------------------- |
| `wolf`, `seedWolf`, `wolfQueen`, `wolfKing`, `darkWolfKing`, `nightmare`, `awakenedGargoyle`, `bloodMoon`, `wolfWitch`, `spiritKnight`, `warden`, `eclipseWolfQueen`, `wolfGirl` | —; seat tap starts the vote flow | 放弃袭击; 取消投票 after voting |

<!-- shared-wolf-vote-buttons:end -->

When a server hint allows only an empty vote, `取消投票` is hidden and the empty-vote button
is labeled `确认放弃袭击`. A thief who chooses a wolf-voting card joins according to that
effective role; treasureMaster is excluded even if the chosen card is a wolf.

### Roles without a role-specific Night-1 step

<!-- night-roles-without-step:start -->

| Role ID           | Role     | Night-1 coverage                                                                |
| ----------------- | -------- | ------------------------------------------------------------------------------- |
| `villager`        | 平民     | No role-specific Night-1 step; no daytime/death ability is implied by this row. |
| `idiot`           | 愚者     | No role-specific Night-1 step; no daytime/death ability is implied by this row. |
| `knight`          | 骑士     | No role-specific Night-1 step; no daytime/death ability is implied by this row. |
| `witcher`         | 猎魔人   | No role-specific Night-1 step; no daytime/death ability is implied by this row. |
| `graveyardKeeper` | 守墓人   | No role-specific Night-1 step; no daytime/death ability is implied by this row. |
| `dancer`          | 舞者     | No role-specific Night-1 step; no daytime/death ability is implied by this row. |
| `maskedMan`       | 蒙面人   | No role-specific Night-1 step; no daytime/death ability is implied by this row. |
| `sequencePrince`  | 定序王子 | No role-specific Night-1 step; no daytime/death ability is implied by this row. |
| `wolfKing`        | 白狼王   | No role-specific Night-1 step; still receives shared wolf-vote buttons.         |
| `bloodMoon`       | 血月使徒 | No role-specific Night-1 step; still receives shared wolf-vote buttons.         |
| `spiritKnight`    | 恶灵骑士 | No role-specific Night-1 step; still receives shared wolf-vote buttons.         |
| `masquerade`      | 假面     | No role-specific Night-1 step; no daytime/death ability is implied by this row. |
| `warden`          | 典狱长   | No role-specific Night-1 step; still receives shared wolf-vote buttons.         |
| `cursedFox`       | 咒狐     | No role-specific Night-1 step; no daytime/death ability is implied by this row. |

<!-- night-roles-without-step:end -->
