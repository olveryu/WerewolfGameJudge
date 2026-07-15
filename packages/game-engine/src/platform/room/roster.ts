/** Shared room roster profile fields, independent of any game rules. */

export interface RosterEntry {
  displayName: string;
  avatarUrl?: string;
  avatarFrame?: string;
  /** Equipped seat flair gacha item ID. */
  seatFlair?: string;
  /** Equipped seat animation gacha item ID. */
  seatAnimation?: string;
  /** Equipped name style gacha item ID. */
  nameStyle?: string;
  /** Equipped reveal effect gacha item ID. */
  revealEffect?: string;
  level?: number;
}

export type RoomSeatProfile = Readonly<RosterEntry>;

export type RoomProfileUpdate = Readonly<Partial<Omit<RoomSeatProfile, 'level'>>>;
