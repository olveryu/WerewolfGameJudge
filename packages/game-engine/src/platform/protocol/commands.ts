/** Canonical commands shared by every seated room game. */

export type RoomSeatCommand<TProfile> =
  | {
      readonly type: 'room.seat.take';
      readonly seat: number;
      readonly profile: TProfile;
    }
  | { readonly type: 'room.seat.leave' }
  | { readonly type: 'room.seat.kick'; readonly seat: number }
  | { readonly type: 'room.seat.clear' }
  | { readonly type: 'room.seat.fillBots' };

export interface RoomProfileUpdateCommand<TProfileUpdate> {
  readonly type: 'room.profile.update';
  readonly profile: TProfileUpdate;
}
