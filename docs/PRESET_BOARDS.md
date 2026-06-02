# Preset Board Reference

> **Authoritative source**: [`packages/game-engine/src/models/Template.ts`](../packages/game-engine/src/models/Template.ts) — `PRESET_TEMPLATES`
>
> Currently **25** preset boards in total, all 12-player configurations (Treasure Master / Thief+Cupid / Cursed Fox+Crow include bottom/reserve cards).

---

## Classic — 4 boards

Classic configurations suitable for beginners.

| Board Name              | Villager | Wolves                | Gods                       |
| ----------------------- | -------- | --------------------- | -------------------------- |
| Seer+Witch+Hunter+Idiot | ×4       | wolf ×4               | seer, witch, hunter, idiot |
| Wolf Queen+Guard        | ×4       | wolf ×3, wolfQueen    | seer, witch, knight, guard |
| Wolf King+Guard         | ×4       | wolf ×3, darkWolfKing | seer, witch, hunter, guard |
| White Wolf King+Guard   | ×4       | wolf ×3, wolfKing     | seer, witch, hunter, guard |

## Advanced — 9 boards

Includes advanced roles, requires some gameplay experience.

| Board Name               | Villager | Wolves                    | Gods                                 |
| ------------------------ | -------- | ------------------------- | ------------------------------------ |
| Gargoyle+GraveyardKeeper | ×4       | wolf ×3, gargoyle         | seer, witch, hunter, graveyardKeeper |
| Nightmare+Guard          | ×4       | wolf ×3, nightmare        | seer, witch, hunter, guard           |
| Blood Moon Hunter        | ×4       | wolf ×3, bloodMoon        | seer, witch, idiot, witcher          |
| Wolf King+Dreamcatcher   | ×4       | wolf ×3, darkWolfKing     | seer, witch, hunter, dreamcatcher    |
| Wolf King+Magician       | ×4       | wolf ×3, darkWolfKing     | seer, witch, hunter, magician        |
| Wolf Robot+Psychic       | ×4       | wolf ×3, wolfRobot        | psychic, witch, hunter, guard        |
| Spirit Knight            | ×4       | wolf ×3, spiritKnight     | seer, witch, hunter, guard           |
| Eternal Order            | ×4       | wolf ×3, eclipseWolfQueen | seer, witch, guard, sequencePrince   |
| Hidden Wolf+Crow         | ×4       | wolf ×3, hiddenWolf       | seer, witch, hunter, crow            |

## Special — 5 boards

Unique mechanic combinations offering different gameplay experiences.

| Board Name        | Villager | Wolves                    | Gods / Special                              |
| ----------------- | -------- | ------------------------- | ------------------------------------------- |
| Pure White+Shadow | ×4       | wolf ×3, wolfWitch        | guard, witch, hunter, pureWhite             |
| Mirror Seer       | ×3       | wolf ×3, darkWolfKing     | seer, mirrorSeer, witch, guard, knight      |
| Masquerade        | ×4       | wolf ×3, masquerade       | seer, witch, dancer, idiot                  |
| Awakened Gargoyle | ×4       | wolf ×2, awakenedGargoyle | seer, witch, hunter, guard, graveyardKeeper |
| All-In            | ×4       | wolf ×3, warden           | seer, witch, hunter, dreamcatcher           |

## Third Party — 7 boards

Includes third-party faction roles, adding faction-level strategy.

| Board Name                  | Villager | Wolves                | Gods                                               | Third Party / Reserve Cards       |
| --------------------------- | -------- | --------------------- | -------------------------------------------------- | --------------------------------- |
| Piper                       | ×3       | wolf ×4               | seer, witch, hunter, guard                         | piper                             |
| Seer+Witch+Hunter+Slacker   | ×3       | wolf ×4               | seer, witch, hunter, idiot                         | slacker                           |
| Seer+Witch+Hunter+WildChild | ×4       | wolf ×3               | seer, witch, hunter, idiot                         | wildChild                         |
| Shadow+Avenger              | ×2       | wolf ×3               | seer, witch, guard                                 | shadow, avenger, slacker          |
| Treasure Master             | ×5       | wolf ×3, darkWolfKing | psychic, poisoner, hunter, dreamcatcher, maskedMan | treasureMaster (+3 reserve cards) |
| Thief+Cupid                 | ×5       | wolf ×3               | seer, witch, hunter, idiot                         | thief (+2 reserve cards), cupid   |
| Cursed Fox+Crow             | ×4       | wolf ×2, darkWolfKing | seer, witch, hunter, crow                          | cursedFox                         |

---

## Maintenance Notes

- Update this document when adding new boards (refer to `.agents/skills/new-board/SKILL.md`)
- Board names do not include player count suffix (player count is derived from `roles.length`)
- Special roles do not repeat (except `villager` / `wolf`)
- `treasureMaster` requires 3 additional reserve cards; `thief` requires 2 additional reserve cards
