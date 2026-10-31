# Preset rules — `PRESET_TEMPLATES`

Location: `packages/game-engine/src/games/werewolf/domain/models/Template.ts`.

## Schema

```ts
interface PresetTemplate {
  name: string;
  roles: RoleId[];
  category: TemplateCategory;
}
```

`TemplateCategory`: `Classic` (`classic`), `Advanced` (`advanced`),
`Special` (`special`), `ThirdParty` (`thirdParty`), with Chinese
labels 经典 / 进阶 / 特色 / 第三方 (`TEMPLATE_CATEGORY_LABELS`).
A preset entry has no player-count field: the count is derived.

## Player count — read this before assuming 12

Seat count is `getPlayerCount(roles)` = `roles.length` minus the
bottom-card count (`getBottomCardCount`). Current state, counted at
drafting time: 26 presets, and every one seats 12 players. The
`roles` arrays are 12 long except two: `盗贼丘比特` has 14 entries
(12 seats + 2 bottom cards) and `盗宝大师` has 15 (12 seats + 3).
Filenames such as `night1.thiefCupid.14p` / `night1.treasureMaster.choose.15p`
count `roles` entries including bottom cards, not seats; the
`night1.shadow.avenger.11p` filename is misnamed — the file contains
12 roles. Nothing in `Template.ts` or `validateTemplateRoles`
requires 12 seats (`MINIMUM_PLAYERS = 1`); the uniform 12 is a
property of the current list, not a rule. State the seat count from
`getPlayerCount`, never from `roles.length` alone.

## Ordering convention (observed, not contract-enforced)

Current entries list villagers first, then wolves, then special
wolves and god roles, then special roles, with a bottom-card actor
last (for example `盗宝大师` ends with `treasureMaster`;
`盗贼丘比特` ends with `thief`, `cupid`). Follow it for readability;
no test enforces the order.

## Validation and contract checks

`validateTemplateRoles` rejects: more than one bottom-card actor;
fewer than `MINIMUM_PLAYERS` seats; a repeated role that has night
steps (except `wolf`); a `treasureMaster` board without a regular
wolf, a god role, and a villager; and any board with no legal
bottom-card deal. The contract test
(`models/__tests__/Template.contract.test.ts`) additionally checks
per preset: the name has no trailing player-count suffix, the
derived player count matches, every role id is valid, the action
order follows the night plan, wolves are 1–4, special roles (other
than villagers and wolves) are not duplicated, and the name is
non-empty. The same file's `EXPECTED_TEMPLATE_NAMES` list (26 names)
must contain the new preset, or the count assertion fails.

## Bottom cards

`BottomCards.ts`: `BOTTOM_CARD_COUNTS` gives `treasureMaster: 3`,
`thief: 2`. At most one bottom-card actor per board. A treasure-master
deal must be exactly one wolf, one god, and one villager, must include
`wolf`, and must not include the actor or `cupid`; a thief deal may
include at most one wolf. `getValidBottomCardDeals` decides legality.

## Count surfaces to update

When a preset is added, the total changes from 26 to 27 in every
place that cites it: `README.md`, `README.en.md`, and
`docs/PRESET_BOARDS.md` (each cites 26 at drafting time), plus
`EXPECTED_TEMPLATE_NAMES` in the contract test. Derive the new
number from `PRESET_TEMPLATES.length` at that moment. There is no `src/config/guideContent.ts` file.
