/**
 * GeneratedAvatar — 程序化 SVG 头像组件
 *
 * 从 boring-avatars (MIT) fork 两种变体的核心算法，
 * 生成 SVG 字符串 → data URL → Image 渲染。不依赖 react-native-svg。
 *
 * - Common (`genC*`): **ring** — 多色同心环
 * - Rare (`genR*`): **beam** — 卡通圆脸 + 五官
 *
 * @see https://github.com/boringdesigners/boring-avatars
 */
import { memo, useMemo } from 'react';
import { Image } from 'react-native';

// ─── Constants ──────────────────────────────────────────────────────────

const GENERATED_COMMON_PREFIX = 'genC';
const GENERATED_RARE_PREFIX = 'genR';

const RING_SIZE = 90;
const RING_NUM_COLORS = 5;

const BEAM_SIZE = 36;

// ─── Color Palettes ─────────────────────────────────────────────────────
// Curated palettes from Nice Color Palettes (CC0).

const RING_PALETTES: readonly (readonly [string, string, string, string, string])[] = [
  ['#264653', '#2A9D8F', '#E9C46A', '#F4A261', '#E76F51'],
  ['#606C38', '#283618', '#FEFAE0', '#DDA15E', '#BC6C25'],
  ['#003049', '#D62828', '#F77F00', '#FCBF49', '#EAE2B7'],
  ['#0B132B', '#1C2541', '#3A506B', '#5BC0BE', '#6FFFE9'],
  ['#8ECAE6', '#219EBC', '#023047', '#FFB703', '#FB8500'],
  ['#2B2D42', '#8D99AE', '#EDF2F4', '#EF233C', '#D90429'],
  ['#F72585', '#7209B7', '#3A0CA3', '#4361EE', '#4CC9F0'],
  ['#390099', '#9E0059', '#FF0054', '#FF5400', '#FFBD00'],
  ['#5F0F40', '#9A031E', '#FB8B24', '#E36414', '#0F4C5C'],
  ['#10002B', '#240046', '#3C096C', '#7B2CBF', '#C77DFF'],
  ['#007F5F', '#2B9348', '#55A630', '#80B918', '#AACC00'],
  ['#0A0908', '#22333B', '#EAE0D5', '#C6AC8F', '#5E503F'],
];

const BEAM_PALETTES: readonly (readonly [string, string, string, string, string])[] = [
  ['#FC5C65', '#FD9644', '#FED330', '#26DE81', '#2BCBBA'],
  ['#45AAF2', '#4B7BEC', '#A55EEA', '#778CA3', '#D1D8E0'],
  ['#F78FB3', '#CF6A87', '#786FA6', '#574B90', '#303952'],
  ['#E77F67', '#F5CD79', '#546DE5', '#C44569', '#F8A5C2'],
  ['#63CDDA', '#3DC1D3', '#E15F41', '#F3A683', '#F7D794'],
  ['#6C5CE7', '#A29BFE', '#FD79A8', '#E84393', '#00CEC9'],
  ['#55E6C1', '#58B19F', '#B8E994', '#78E08F', '#38ADA9'],
  ['#FC427B', '#F97F51', '#25CCF7', '#EAB543', '#55E6C1'],
];

// ─── Hashing Utilities (from boring-avatars) ────────────────────────────

function hashCode(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    const character = name.codePointAt(i)!;
    hash = ((hash << 5) - hash + character) | 0;
  }
  return Math.abs(hash);
}

function getUnit(number: number, range: number, index?: number): number {
  const value = number % range;
  if (index && Math.floor((number / Math.pow(10, index)) % 10) % 2 === 0) {
    return -value;
  }
  return value;
}

function getBoolean(number: number, ntn: number): boolean {
  return Math.floor((number / Math.pow(10, ntn)) % 10) % 2 === 0;
}

function getRandomColor(number: number, colors: readonly string[], range: number): string {
  return colors[number % range]!;
}

function getContrast(hexcolor: string): string {
  const hex = hexcolor.startsWith('#') ? hexcolor.slice(1) : hexcolor;
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? '#000000' : '#FFFFFF';
}

// ─── Ring Generator ─────────────────────────────────────────────────────

function generateRingColors(name: string, palette: readonly string[]): string[] {
  const numFromName = hashCode(name);
  const range = palette.length;
  const shuffled = Array.from({ length: RING_NUM_COLORS }, (_, i) =>
    getRandomColor(numFromName + i, palette, range),
  );
  // Map 5 shuffled colors → 9 ring segments (as per boring-avatars algorithm)
  return [
    shuffled[0]!,
    shuffled[1]!,
    shuffled[1]!,
    shuffled[2]!,
    shuffled[2]!,
    shuffled[3]!,
    shuffled[3]!,
    shuffled[0]!,
    shuffled[4]!,
  ];
}

// ─── Beam Generator ─────────────────────────────────────────────────────

interface BeamData {
  wrapperColor: string;
  faceColor: string;
  backgroundColor: string;
  wrapperTranslateX: number;
  wrapperTranslateY: number;
  wrapperRotate: number;
  wrapperScale: number;
  isMouthOpen: boolean;
  isCircle: boolean;
  eyeSpread: number;
  mouthSpread: number;
  faceRotate: number;
  faceTranslateX: number;
  faceTranslateY: number;
}

function generateBeamData(name: string, palette: readonly string[]): BeamData {
  const numFromName = hashCode(name);
  const range = palette.length;
  const wrapperColor = getRandomColor(numFromName, palette, range);
  const preTranslateX = getUnit(numFromName, 10, 1);
  const wrapperTranslateX = preTranslateX < 5 ? preTranslateX + BEAM_SIZE / 9 : preTranslateX;
  const preTranslateY = getUnit(numFromName, 10, 2);
  const wrapperTranslateY = preTranslateY < 5 ? preTranslateY + BEAM_SIZE / 9 : preTranslateY;

  return {
    wrapperColor,
    faceColor: getContrast(wrapperColor),
    backgroundColor: getRandomColor(numFromName + 13, palette, range),
    wrapperTranslateX,
    wrapperTranslateY,
    wrapperRotate: getUnit(numFromName, 360),
    wrapperScale: 1 + getUnit(numFromName, BEAM_SIZE / 12) / 10,
    isMouthOpen: getBoolean(numFromName, 2),
    isCircle: getBoolean(numFromName, 1),
    eyeSpread: getUnit(numFromName, 5),
    mouthSpread: getUnit(numFromName, 3),
    faceRotate: getUnit(numFromName, 10, 3),
    faceTranslateX:
      wrapperTranslateX > BEAM_SIZE / 6 ? wrapperTranslateX / 2 : getUnit(numFromName, 8, 1),
    faceTranslateY:
      wrapperTranslateY > BEAM_SIZE / 6 ? wrapperTranslateY / 2 : getUnit(numFromName, 7, 2),
  };
}

// ─── Palette Selection ──────────────────────────────────────────────────

function selectPalette<T>(seed: string, palettes: readonly T[]): T {
  return palettes[hashCode(seed) % palettes.length]!;
}

// ─── Ring SVG Builder ────────────────────────────────────────────────────

function buildRingSvg(seed: string): string {
  const palette = selectPalette(seed, RING_PALETTES);
  const c = generateRingColors(seed, palette);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${RING_SIZE} ${RING_SIZE}"><mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="${RING_SIZE}" height="${RING_SIZE}"><rect width="${RING_SIZE}" height="${RING_SIZE}" rx="${RING_SIZE * 2}" fill="#FFF"/></mask><g mask="url(#m)"><path d="M0 0h90v45H0z" fill="${c[0]}"/><path d="M0 45h90v45H0z" fill="${c[1]}"/><path d="M83 45a38 38 0 00-76 0h76z" fill="${c[2]}"/><path d="M83 45a38 38 0 01-76 0h76z" fill="${c[3]}"/><path d="M77 45a32 32 0 10-64 0h64z" fill="${c[4]}"/><path d="M77 45a32 32 0 11-64 0h64z" fill="${c[5]}"/><path d="M71 45a26 26 0 00-52 0h52z" fill="${c[6]}"/><path d="M71 45a26 26 0 01-52 0h52z" fill="${c[7]}"/><circle cx="45" cy="45" r="23" fill="${c[8]}"/></g></svg>`;
}

// ─── Beam SVG Builder ────────────────────────────────────────────────────

function buildBeamSvg(seed: string): string {
  const palette = selectPalette(seed, BEAM_PALETTES);
  const d = generateBeamData(seed, palette);
  const S = BEAM_SIZE;
  const half = S / 2;
  const bodyRx = d.isCircle ? S : S / 6;

  let mouth: string;
  if (d.isMouthOpen) {
    mouth = `<path d="M15 ${19 + d.mouthSpread}c2 1 4 1 6 0" stroke="${d.faceColor}" fill="none" stroke-linecap="round"/>`;
  } else {
    mouth = `<path d="M13,${19 + d.mouthSpread} a1,0.75 0 0,0 10,0" fill="${d.faceColor}"/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}"><mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="${S}" height="${S}"><rect width="${S}" height="${S}" rx="${S * 2}" fill="#FFF"/></mask><g mask="url(#m)"><rect width="${S}" height="${S}" fill="${d.backgroundColor}"/><rect x="0" y="0" width="${S}" height="${S}" transform="translate(${d.wrapperTranslateX} ${d.wrapperTranslateY}) rotate(${d.wrapperRotate} ${half} ${half}) scale(${d.wrapperScale})" fill="${d.wrapperColor}" rx="${bodyRx}"/><g transform="translate(${d.faceTranslateX} ${d.faceTranslateY}) rotate(${d.faceRotate} ${half} ${half})">${mouth}<rect x="${14 - d.eyeSpread}" y="14" width="1.5" height="2" rx="1" fill="${d.faceColor}"/><rect x="${20 + d.eyeSpread}" y="14" width="1.5" height="2" rx="1" fill="${d.faceColor}"/></g></g></svg>`;
}

// ─── Public API ─────────────────────────────────────────────────────────

export function isGeneratedAvatar(id: string): boolean {
  return id.startsWith(GENERATED_COMMON_PREFIX) || id.startsWith(GENERATED_RARE_PREFIX);
}

function getGeneratedVariant(id: string): 'ring' | 'beam' {
  return id.startsWith(GENERATED_RARE_PREFIX) ? 'beam' : 'ring';
}

interface GeneratedAvatarProps {
  seed: string;
  size: number;
}

/**
 * Renders a procedurally generated SVG avatar.
 * Dispatches to ring (Common) or beam (Rare) SVG builder based on seed prefix.
 */
export const GeneratedAvatar = memo<GeneratedAvatarProps>(({ seed, size }) => {
  const uri = useMemo(() => {
    const variant = getGeneratedVariant(seed);
    const svg = variant === 'beam' ? buildBeamSvg(seed) : buildRingSvg(seed);
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }, [seed]);

  return <Image source={{ uri }} style={{ width: size, height: size }} />;
});

GeneratedAvatar.displayName = 'GeneratedAvatar';
