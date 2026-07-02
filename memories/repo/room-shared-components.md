# Room Shared Components Notes

- When moving RoomScreen primitives into `src/components/room`, update all internal imports to the
  shared path and delete old re-export stubs. `knip` reports those transitional files as unused
  files/exports, so keeping re-export shells inside `src/screens/RoomScreen` breaks
  `pnpm run quality`.
