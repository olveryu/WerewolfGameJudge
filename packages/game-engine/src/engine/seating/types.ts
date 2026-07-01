/**
 * Generic seating types shared by game adapters.
 *
 * The kernel owns only seat CRUD invariants. Game-specific phase, host, profile,
 * reducer action, and public error wording stay in each adapter.
 */

export interface BaseSeat {
  userId: string;
  seat: number;
}

export type SeatMap<TSeat extends BaseSeat> = Record<number, TSeat | null | undefined>;

export const SEAT_KERNEL_INVALID_SEAT = 'INVALID_SEAT' as const;
export const SEAT_KERNEL_SEAT_TAKEN = 'SEAT_TAKEN' as const;
export const SEAT_KERNEL_NOT_SEATED = 'NOT_SEATED' as const;
export const SEAT_KERNEL_SEAT_EMPTY = 'SEAT_EMPTY' as const;

export type SeatKernelReason =
  | typeof SEAT_KERNEL_INVALID_SEAT
  | typeof SEAT_KERNEL_SEAT_TAKEN
  | typeof SEAT_KERNEL_NOT_SEATED
  | typeof SEAT_KERNEL_SEAT_EMPTY;

export interface SeatChange<TSeat extends BaseSeat> {
  seat: number;
  previous: TSeat | null;
  value: TSeat | null;
}

export type SeatOpResult<TSeat extends BaseSeat> =
  | { kind: 'success'; changes: readonly SeatChange<TSeat>[] }
  | { kind: 'error'; reason: SeatKernelReason };
