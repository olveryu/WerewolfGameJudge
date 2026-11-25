export interface SeatSwap {
  readonly first: number;
  readonly second: number;
}

export interface LocationLayer {
  readonly swap: SeatSwap | null;
}

export interface TargetSelection {
  readonly chosenSeat: number;
  readonly landingSeat: number;
}

export function resolveTargetSelection(
  chosenSeat: number,
  location: LocationLayer,
): TargetSelection {
  return { chosenSeat, landingSeat: getLandingSeat(chosenSeat, location) };
}

export function resolveSelectedSeat(seat: number, location: LocationLayer): number {
  return getLandingSeat(seat, location);
}

function getLandingSeat(seat: number, location: LocationLayer): number {
  if (location.swap === null) return seat;
  if (seat === location.swap.first) return location.swap.second;
  if (seat === location.swap.second) return location.swap.first;
  return seat;
}
