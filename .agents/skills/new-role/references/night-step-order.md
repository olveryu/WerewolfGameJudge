# Night-step order — `NIGHT_STEP_ORDER`

Source: `packages/game-engine/src/games/werewolf/domain/models/roles/spec/nightStepIds.ts`
(`NIGHT_STEP_IDS`, exported as `NIGHT_STEP_ORDER`; re-exported by `plan.ts`).
There is no symbol named `NIGHT_STEP_ORDER_INTERNAL` anywhere in the engine package.
Count: 39 step ids. Order below is the file order, which is the execution order.

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
| 17  | `wolfGirlConfess`               | `wolfGirl`         |
| 18  | `wolfKill`                      | `wolf`             |
| 19  | `seedWolfInfect`                | `seedWolf`         |
| 20  | `wolfQueenCharm`                | `wolfQueen`        |
| 21  | `hiddenWolfReveal`              | `hiddenWolf`       |
| 22  | `witchAction`                   | `witch`            |
| 23  | `poisonerPoison`                | `poisoner`         |
| 24  | `hunterConfirm`                 | `hunter`           |
| 25  | `darkWolfKingConfirm`           | `darkWolfKing`     |
| 26  | `wolfRobotLearn`                | `wolfRobot`        |
| 27  | `seerCheck`                     | `seer`             |
| 28  | `mirrorSeerCheck`               | `mirrorSeer`       |
| 29  | `drunkSeerCheck`                | `drunkSeer`        |
| 30  | `wolfWitchCheck`                | `wolfWitch`        |
| 31  | `gargoyleCheck`                 | `gargoyle`         |
| 32  | `pureWhiteCheck`                | `pureWhite`        |
| 33  | `psychicCheck`                  | `psychic`          |
| 34  | `awakenedGargoyleConvert`       | `awakenedGargoyle` |
| 35  | `piperHypnotize`                | `piper`            |
| 36  | `piperHypnotizedReveal`         | `piper`            |
| 37  | `awakenedGargoyleConvertReveal` | `awakenedGargoyle` |
| 38  | `seedWolfInfectReveal`          | `seedWolf`         |
| 39  | `wolfGirlConfessReveal`         | `wolfGirl`         |

Every step id has exactly one resolver entry in `domain/resolvers/index.ts`
(39 ids, 39 resolver keys, verified by diff against that file).
