import catalog from '../assets/catalog.json';

const assets = import.meta.glob<string>('../assets/symbols/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
});

export const SPOTMATCH_SYMBOLS = catalog.symbols.map((symbol) => {
  const url = assets[`../assets/${symbol.file}`];
  if (url === undefined) throw new Error(`Missing Spotmatch asset: ${symbol.id}`);
  return { id: symbol.id, name: symbol.name, url };
});

const INITIAL_POSITIONS = [
  { x: 14, y: 17 },
  { x: 50, y: 17 },
  { x: 86, y: 17 },
  { x: 32, y: 50 },
  { x: 68, y: 50 },
  { x: 14, y: 83 },
  { x: 50, y: 83 },
  { x: 86, y: 83 },
] as const;

/** Generate repeatable free positions, keeping 52px targets apart at the narrowest card size. */
export function spotmatchSymbolLayout(seed: number) {
  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  const positions: { x: number; y: number }[] = INITIAL_POSITIONS.map(({ x, y }) => ({ x, y }));
  for (let pass = 0; pass < 120; pass++) {
    for (let index = 0; index < positions.length; index++) {
      const candidate = { x: 10 + random() * 80, y: 17 + random() * 66 };
      if (
        positions.every(
          (other, otherIndex) =>
            index === otherIndex ||
            Math.abs(candidate.x - other.x) >= (52 / 282) * 100 ||
            Math.abs(candidate.y - other.y) >= (52 / 158) * 100,
        ) &&
        positions
          .map((position, positionIndex) => (positionIndex === index ? candidate.y : position.y))
          .sort((a, b) => a - b)
          .every((y, positionIndex, heights) => {
            const fourth = heights[positionIndex + 3];
            return fourth === undefined || fourth - y >= 22;
          })
      )
        positions[index] = candidate;
    }
  }
  for (let index = positions.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    const currentPosition = positions[index];
    const otherPosition = positions[other];
    if (currentPosition === undefined || otherPosition === undefined)
      throw new Error('Invalid Spotmatch layout');
    positions[index] = otherPosition;
    positions[other] = currentPosition;
  }
  return positions.map((position) => {
    const rotation = Math.floor(random() * 51) - 25;
    const angle = (Math.abs(rotation) * Math.PI) / 180;
    const maxScale = 94 / (Math.cos(angle) + Math.sin(angle));
    return { ...position, rotation, scale: Math.min(76 + random() * 14, maxScale) };
  });
}
