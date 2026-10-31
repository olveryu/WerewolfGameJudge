# Role index — regenerated from `ROLE_SPECS`

Source: `packages/game-engine/src/games/werewolf/domain/models/roles/spec/specs.ts`.
Count: 47 roles. Faction values are the `Faction` enum (`Wolf` / `God` / `Villager` / `Special`);
team values are the `Team` enum (`Wolf` / `Good` / `Third`).
Regenerate from `specs.ts` before use (`ROLE_SPECS` is the source).

| Role id            | Display name | Short name | Faction  | Team  | Night steps                                                |
| ------------------ | ------------ | ---------- | -------- | ----- | ---------------------------------------------------------- |
| `villager`         | 平民         | 民         | Villager | Good  | —                                                          |
| `mirrorSeer`       | 灯影预言家   | 灯         | Villager | Good  | `mirrorSeerCheck`                                          |
| `drunkSeer`        | 酒鬼预言家   | 酒         | Villager | Good  | `drunkSeerCheck`                                           |
| `seer`             | 预言家       | 预         | God      | Good  | `seerCheck`                                                |
| `witch`            | 女巫         | 女         | God      | Good  | `witchAction`                                              |
| `poisoner`         | 毒师         | 毒         | God      | Good  | `poisonerPoison`                                           |
| `hunter`           | 猎人         | 猎         | God      | Good  | `hunterConfirm`                                            |
| `guard`            | 守卫         | 守         | God      | Good  | `guardProtect`                                             |
| `idiot`            | 愚者         | 愚         | God      | Good  | —                                                          |
| `knight`           | 骑士         | 骑         | God      | Good  | —                                                          |
| `magician`         | 魔术师       | 术         | God      | Good  | `magicianSwap`                                             |
| `witcher`          | 猎魔人       | 魔         | God      | Good  | —                                                          |
| `psychic`          | 通灵师       | 通         | God      | Good  | `psychicCheck`                                             |
| `dreamcatcher`     | 摄梦人       | 摄         | God      | Good  | `dreamcatcherDream`                                        |
| `graveyardKeeper`  | 守墓人       | 墓         | God      | Good  | —                                                          |
| `pureWhite`        | 纯白之女     | 纯         | God      | Good  | `pureWhiteCheck`                                           |
| `dancer`           | 舞者         | 舞         | God      | Good  | —                                                          |
| `silenceElder`     | 禁言长老     | 禁         | God      | Good  | `silenceElderSilence`                                      |
| `votebanElder`     | 禁票长老     | 票         | God      | Good  | `votebanElderBan`                                          |
| `crow`             | 乌鸦         | 鸦         | God      | Good  | `crowCurse`                                                |
| `maskedMan`        | 蒙面人       | 蒙         | God      | Good  | —                                                          |
| `sequencePrince`   | 定序王子     | 序         | God      | Good  | —                                                          |
| `wolf`             | 狼人         | 狼         | Wolf     | Wolf  | `wolfKill`                                                 |
| `seedWolf`         | 种狼         | 种         | Wolf     | Wolf  | `seedWolfInfect`, `seedWolfInfectReveal`                   |
| `wolfQueen`        | 狼美人       | 美         | Wolf     | Wolf  | `wolfQueenCharm`                                           |
| `wolfKing`         | 白狼王       | 白         | Wolf     | Wolf  | —                                                          |
| `darkWolfKing`     | 狼王         | 王         | Wolf     | Wolf  | `darkWolfKingConfirm`                                      |
| `nightmare`        | 噩梦之影     | 魇         | Wolf     | Wolf  | `nightmareBlock`                                           |
| `gargoyle`         | 石像鬼       | 石         | Wolf     | Wolf  | `gargoyleCheck`                                            |
| `awakenedGargoyle` | 觉醒石像鬼   | 石         | Wolf     | Wolf  | `awakenedGargoyleConvert`, `awakenedGargoyleConvertReveal` |
| `bloodMoon`        | 血月使徒     | 血         | Wolf     | Wolf  | —                                                          |
| `wolfRobot`        | 机械狼人     | 机         | Wolf     | Wolf  | `wolfRobotLearn`                                           |
| `wolfWitch`        | 狼巫         | 巫         | Wolf     | Wolf  | `wolfWitchCheck`                                           |
| `spiritKnight`     | 恶灵骑士     | 灵         | Wolf     | Wolf  | —                                                          |
| `masquerade`       | 假面         | 假         | Wolf     | Wolf  | —                                                          |
| `warden`           | 典狱长       | 狱         | Wolf     | Wolf  | —                                                          |
| `eclipseWolfQueen` | 蚀时狼妃     | 蚀         | Wolf     | Wolf  | `eclipseWolfQueenShelter`                                  |
| `hiddenWolf`       | 隐狼         | 隐         | Wolf     | Good  | `hiddenWolfReveal`                                         |
| `slacker`          | 混血儿       | 混         | Special  | Third | `slackerChooseIdol`                                        |
| `wildChild`        | 野孩子       | 野         | Special  | Third | `wildChildChooseIdol`                                      |
| `piper`            | 吹笛者       | 笛         | Special  | Third | `piperHypnotize`, `piperHypnotizedReveal`                  |
| `shadow`           | 影子         | 影         | Special  | Third | `shadowChooseMimic`                                        |
| `avenger`          | 复仇者       | 仇         | Special  | Third | `avengerConfirm`                                           |
| `thief`            | 盗贼         | 窃         | Special  | Good  | `thiefChoose`                                              |
| `cupid`            | 丘比特       | 丘         | Special  | Good  | `cupidChooseLovers`, `cupidLoversReveal`                   |
| `treasureMaster`   | 盗宝大师     | 盗         | Special  | Third | `treasureMasterChoose`                                     |
| `cursedFox`        | 咒狐         | 狐         | Special  | Third | —                                                          |

## Roles with no night steps

These roles declare no `nightSteps` entry (or an empty list) and therefore contribute
no step to `NIGHT_STEPS`, derived from the spec file:

- `villager` (平民)
- `idiot` (愚者)
- `knight` (骑士)
- `witcher` (猎魔人)
- `graveyardKeeper` (守墓人)
- `dancer` (舞者)
- `maskedMan` (蒙面人)
- `sequencePrince` (定序王子)
- `wolfKing` (白狼王)
- `bloodMoon` (血月使徒)
- `spiritKnight` (恶灵骑士)
- `masquerade` (假面)
- `warden` (典狱长)
- `cursedFox` (咒狐)

## Notes verified against the spec file

- `shortName` values are all one character, but they are not unique: `gargoyle` and
  `awakenedGargoyle` both use `石`. The contract check is non-empty only
  (`v2Specs.contract.test.ts`). Do not state uniqueness as a rule.
- `hiddenWolf` has faction `Wolf` and team `Good`; `thief` and `cupid` have faction
  `Special` and team `Good`. Do not infer team from faction.
