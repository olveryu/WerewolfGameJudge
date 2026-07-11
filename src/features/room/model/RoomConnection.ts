/** Game-neutral result returned when entering a resolved room. */

export type RoomEntryResult =
  | { readonly success: true }
  | { readonly success: false; readonly error: string };
