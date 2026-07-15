/** Client-only Werewolf notepad state and view-model contracts. */

import type { Faction, RoleId, Team } from '@werewolf/game-engine/games/werewolf/public';

export interface RoleTagInfo {
  readonly roleId: RoleId;
  readonly shortName: string;
  readonly team: Team;
  readonly faction: Faction;
}

export interface WerewolfNotepadState {
  readonly playerNotes: Readonly<Record<number, string>>;
  readonly handStates: Readonly<Record<number, boolean>>;
  readonly roleGuesses: Readonly<Record<number, RoleId | null>>;
  readonly publicNoteLeft: string;
  readonly publicNoteRight: string;
}

export function createEmptyWerewolfNotepadState(): WerewolfNotepadState {
  return {
    playerNotes: {},
    handStates: {},
    roleGuesses: {},
    publicNoteLeft: '',
    publicNoteRight: '',
  };
}
