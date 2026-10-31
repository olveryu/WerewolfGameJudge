# Night-step order — `NIGHT_STEP_ORDER`

Source: `packages/game-engine/src/games/werewolf/domain/models/roles/spec/nightStepIds.ts`
(`NIGHT_STEP_IDS`, exported as `NIGHT_STEP_ORDER`; re-exported by `plan.ts`).
There is no symbol named `NIGHT_STEP_ORDER_INTERNAL` anywhere in the engine package.
Count: 37 step ids. Order below is the file order, which is the execution order.

| #   | Step id                         | Role               |
| --- | ------------------------------- | ------------------ |
| 1   | `thiefChoose`                   | `thief`            |
| 2   | `treasureMasterChoose`          | `treasureMaster`   |
| 3   | `cupidChooseLovers`             | `cupid`            |
| 4   | `cupidLoversReveal`             | `cupid`            |
| 5   | `magicianSwap`                  | `magician`         |
| 6   | `slackerChooseIdol`             | `slacker`          |
| 7   | `wildChildChooseIdol`           | `wildChild`        |
| 8   | `shadowChooseMimic`             | `shadow`           |
| 9   | `avengerConfirm`                | `avenger`          |
| 10  | `eclipseWolfQueenShelter`       | `eclipseWolfQueen` |
| 11  | `nightmareBlock`                | `nightmare`        |
| 12  | `dreamcatcherDream`             | `dreamcatcher`     |
| 13  | `guardProtect`                  | `guard`            |
| 14  | `silenceElderSilence`           | `silenceElder`     |
| 15  | `votebanElderBan`               | `votebanElder`     |
| 16  | `crowCurse`                     | `crow`             |
| 17  | `wolfKill`                      | `wolf`             |
| 18  | `seedWolfInfect`                | `seedWolf`         |
| 19  | `wolfQueenCharm`                | `wolfQueen`        |
| 20  | `hiddenWolfReveal`              | `hiddenWolf`       |
| 21  | `witchAction`                   | `witch`            |
| 22  | `poisonerPoison`                | `poisoner`         |
| 23  | `hunterConfirm`                 | `hunter`           |
| 24  | `darkWolfKingConfirm`           | `darkWolfKing`     |
| 25  | `wolfRobotLearn`                | `wolfRobot`        |
| 26  | `seerCheck`                     | `seer`             |
| 27  | `mirrorSeerCheck`               | `mirrorSeer`       |
| 28  | `drunkSeerCheck`                | `drunkSeer`        |
| 29  | `wolfWitchCheck`                | `wolfWitch`        |
| 30  | `gargoyleCheck`                 | `gargoyle`         |
| 31  | `pureWhiteCheck`                | `pureWhite`        |
| 32  | `psychicCheck`                  | `psychic`          |
| 33  | `awakenedGargoyleConvert`       | `awakenedGargoyle` |
| 34  | `piperHypnotize`                | `piper`            |
| 35  | `piperHypnotizedReveal`         | `piper`            |
| 36  | `awakenedGargoyleConvertReveal` | `awakenedGargoyle` |
| 37  | `seedWolfInfectReveal`          | `seedWolf`         |

Every step id has exactly one resolver entry in `domain/resolvers/index.ts`
(37 ids, 37 resolver keys, verified by diff against that file).
