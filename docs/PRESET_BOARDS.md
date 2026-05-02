# 预设板子参考

> **权威来源**: [`packages/game-engine/src/models/Template.ts`](../packages/game-engine/src/models/Template.ts) — `PRESET_TEMPLATES`
>
> 当前共 **24 套**预设板子，全部为 12 人局（盗宝大师/盗贼丘比特/咒狐乌鸦 含底牌）。

---

## 经典（Classic）— 4 套

适合新手入门的经典配置。

| 板子名     | 村民 | 狼人                  | 神职                       |
| ---------- | ---- | --------------------- | -------------------------- |
| 预女猎白   | ×4   | wolf ×4               | seer, witch, hunter, idiot |
| 狼美守卫   | ×4   | wolf ×3, wolfQueen    | seer, witch, knight, guard |
| 狼王守卫   | ×4   | wolf ×3, darkWolfKing | seer, witch, hunter, guard |
| 白狼王守卫 | ×4   | wolf ×3, wolfKing     | seer, witch, hunter, guard |

## 进阶（Advanced）— 8 套

含进阶角色，需一定游戏经验。

| 板子名         | 村民 | 狼人                      | 神职                                 |
| -------------- | ---- | ------------------------- | ------------------------------------ |
| 石像鬼守墓人   | ×4   | wolf ×3, gargoyle         | seer, witch, hunter, graveyardKeeper |
| 噩梦之影守卫   | ×4   | wolf ×3, nightmare        | seer, witch, hunter, guard           |
| 血月猎魔       | ×4   | wolf ×3, bloodMoon        | seer, witch, idiot, witcher          |
| 狼王摄梦人     | ×4   | wolf ×3, darkWolfKing     | seer, witch, hunter, dreamcatcher    |
| 狼王魔术师     | ×4   | wolf ×3, darkWolfKing     | seer, witch, hunter, magician        |
| 机械狼人通灵师 | ×4   | wolf ×3, wolfRobot        | psychic, witch, hunter, guard        |
| 恶灵骑士       | ×4   | wolf ×3, spiritKnight     | seer, witch, hunter, guard           |
| 永序之轮       | ×4   | wolf ×3, eclipseWolfQueen | seer, witch, guard, sequencePrince   |

## 特色（Special）— 5 套

独特机制组合，带来不同游戏体验。

| 板子名     | 村民 | 狼人                      | 神职 / 特殊                                 |
| ---------- | ---- | ------------------------- | ------------------------------------------- |
| 纯白夜影   | ×4   | wolf ×3, wolfWitch        | guard, witch, hunter, pureWhite             |
| 灯影预言家 | ×3   | wolf ×3, darkWolfKing     | seer, mirrorSeer, witch, guard, knight      |
| 假面舞会   | ×4   | wolf ×3, masquerade       | seer, witch, dancer, idiot                  |
| 唯邻是从   | ×4   | wolf ×2, awakenedGargoyle | seer, witch, hunter, guard, graveyardKeeper |
| 孤注一掷   | ×4   | wolf ×3, warden           | seer, witch, hunter, dreamcatcher           |

## 第三方（ThirdParty）— 7 套

含第三方阵营角色，增加阵营博弈。

| 板子名     | 村民 | 狼人                  | 神职                                               | 第三方 / 底牌            |
| ---------- | ---- | --------------------- | -------------------------------------------------- | ------------------------ |
| 吹笛者     | ×3   | wolf ×4               | seer, witch, hunter, guard                         | piper                    |
| 预女猎白混 | ×3   | wolf ×4               | seer, witch, hunter, idiot                         | slacker                  |
| 预女猎白野 | ×4   | wolf ×3               | seer, witch, hunter, idiot                         | wildChild                |
| 影子复仇者 | ×2   | wolf ×3               | seer, witch, guard                                 | shadow, avenger, slacker |
| 盗宝大师   | ×5   | wolf ×3, darkWolfKing | psychic, poisoner, hunter, dreamcatcher, maskedMan | treasureMaster (+3 底牌) |
| 盗贼丘比特 | ×5   | wolf ×3               | seer, witch, hunter, idiot                         | thief (+2 底牌), cupid   |
| 咒狐乌鸦   | ×4   | wolf ×2, darkWolfKing | seer, witch, hunter, crow                          | cursedFox                |

---

## 维护说明

- 新增板子后同步更新此文档（参考 `.github/skills/new-board/SKILL.md`）
- 板子名不含人数后缀（人数由 `roles.length` 派生）
- 除 `villager` / `wolf` 外，特殊角色不重复
- `treasureMaster` 需额外 3 张底牌、`thief` 需额外 2 张底牌
