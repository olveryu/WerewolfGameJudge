# Room Shell Content Contract

`RoomShell` owns the shared header, connection/status ribbon, seat control banner, bottom actions, profile, invitation, and host-management surfaces. Game screens provide models and content, not another copy of those surfaces.

`content` is an explicit discriminated union:

- `seats`: `contextHeader`, `beforeSeatBoard`, `afterSeatBoard`, and `sideInspector` form the shared seat-board view. Optional visual content is explicitly `null`.
- `workspace`: `element` supplies one game-owned workspace. Seat-board slots are not accepted and are not silently ignored.

Werewolf and FibKing use `seats`. Pictionary uses `seats` in its lobby and `workspace` in its active phases. Header actions and game overlays remain independent of this choice.

This contract changes no game rules, session lifetime, viewport breakpoints, seat layout, or overlay behavior. It removes the implicit `gameWorkspace === null` mode switch and the redundant lobby props previously passed during Pictionary gameplay.

`type-tests/roomShellContent.tsx` checks both valid variants and rejects mixed or incomplete content. Browser room tests cover the rendered game flows.
