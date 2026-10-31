# Resolver map — every step id has exactly one resolver

Source: `packages/game-engine/src/games/werewolf/domain/resolvers/index.ts`
(`RESOLVERS` registry). Verified: 37 step ids in
`NIGHT_STEP_ORDER`, 37 keys in `RESOLVERS`, no id missing and no extra key.

## Generic resolvers

Use `createGenericResolver('<roleId>')` for these steps (23 entries in
`RESOLVERS`). Standalone files exist where the logic is not
expressible declaratively (`resolvers/index.ts`, 'Custom resolvers'
section).

| Step id                   | Role               |
| ------------------------- | ------------------ |
| `guardProtect`            | `guard`            |
| `dreamcatcherDream`       | `dreamcatcher`     |
| `silenceElderSilence`     | `silenceElder`     |
| `votebanElderBan`         | `votebanElder`     |
| `crowCurse`               | `crow`             |
| `wolfQueenCharm`          | `wolfQueen`        |
| `eclipseWolfQueenShelter` | `eclipseWolfQueen` |
| `slackerChooseIdol`       | `slacker`          |
| `wildChildChooseIdol`     | `wildChild`        |
| `seerCheck`               | `seer`             |
| `mirrorSeerCheck`         | `mirrorSeer`       |
| `drunkSeerCheck`          | `drunkSeer`        |
| `psychicCheck`            | `psychic`          |
| `gargoyleCheck`           | `gargoyle`         |
| `pureWhiteCheck`          | `pureWhite`        |
| `wolfWitchCheck`          | `wolfWitch`        |
| `nightmareBlock`          | `nightmare`        |
| `wolfRobotLearn`          | `wolfRobot`        |
| `hunterConfirm`           | `hunter`           |
| `darkWolfKingConfirm`     | `darkWolfKing`     |
| `avengerConfirm`          | `avenger`          |
| `hiddenWolfReveal`        | `hiddenWolf`       |
| `poisonerPoison`          | `poisoner`         |

## Standalone resolvers

One file per role (or role family) in `domain/resolvers/`, registered by
name in `RESOLVERS`. These exist because the logic is not expressible
declaratively.

| Step id(s)                                                 | File                  |
| ---------------------------------------------------------- | --------------------- |
| `witchAction`                                              | `witch.ts`            |
| `wolfKill`                                                 | `wolf.ts`             |
| `magicianSwap`                                             | `magician.ts`         |
| `shadowChooseMimic`                                        | `shadow.ts`           |
| `awakenedGargoyleConvert`, `awakenedGargoyleConvertReveal` | `awakenedGargoyle.ts` |
| `piperHypnotize`, `piperHypnotizedReveal`                  | `piper.ts`            |
| `seedWolfInfect`, `seedWolfInfectReveal`                   | `seedWolf.ts`         |
| `treasureMasterChoose`                                     | `treasureMaster.ts`   |
| `thiefChoose`                                              | `thief.ts`            |
| `cupidChooseLovers`, `cupidLoversReveal`                   | `cupid.ts`            |

A new step needs a `RESOLVERS` entry in all cases. A new role whose step
fits the generic pattern needs no new resolver file. Re-check this map
against `resolvers/index.ts` before writing.
