/**
 * GeneratedAvatar — 程序化 SVG 头像组件
 *
 * 从 boring-avatars (MIT) fork 两种变体的核心算法，
 * 适配 react-native-svg 渲染。
 *
 * - Common (`genC*`): **ring** — 多色同心环
 * - Rare (`genR*`): **beam** — 卡通圆脸 + 五官
 *
 * @see https://github.com/boringdesigners/boring-avatars
 */
import { memo, useMemo } from 'react';
import Svg, { Circle, G, Mask, Path, Rect } from 'react-native-svg';

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

// ─── Ring Component ─────────────────────────────────────────────────────

interface RingAvatarProps {
  seed: string;
  size: number;
}

const RingAvatar = memo<RingAvatarProps>(({ seed, size }) => {
  const ringColors = useMemo(() => {
    const palette = selectPalette(seed, RING_PALETTES);
    return generateRingColors(seed, palette);
  }, [seed]);

  return (
    <Svg viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`} width={size} height={size}>
      <Mask
        id="ringMask"
        maskUnits="userSpaceOnUse"
        x={0}
        y={0}
        width={RING_SIZE}
        height={RING_SIZE}
      >
        <Rect width={RING_SIZE} height={RING_SIZE} rx={RING_SIZE * 2} fill="#FFFFFF" />
      </Mask>
      <G mask="url(#ringMask)">
        <Path d="M0 0h90v45H0z" fill={ringColors[0]} />
        <Path d="M0 45h90v45H0z" fill={ringColors[1]} />
        <Path d="M83 45a38 38 0 00-76 0h76z" fill={ringColors[2]} />
        <Path d="M83 45a38 38 0 01-76 0h76z" fill={ringColors[3]} />
        <Path d="M77 45a32 32 0 10-64 0h64z" fill={ringColors[4]} />
        <Path d="M77 45a32 32 0 11-64 0h64z" fill={ringColors[5]} />
        <Path d="M71 45a26 26 0 00-52 0h52z" fill={ringColors[6]} />
        <Path d="M71 45a26 26 0 01-52 0h52z" fill={ringColors[7]} />
        <Circle cx={45} cy={45} r={23} fill={ringColors[8]} />
      </G>
    </Svg>
  );
});

RingAvatar.displayName = 'RingAvatar';

// ─── Beam Component ─────────────────────────────────────────────────────

interface BeamAvatarProps {
  seed: string;
  size: number;
}

const BeamAvatar = memo<BeamAvatarProps>(({ seed, size }) => {
  const data = useMemo(() => {
    const palette = selectPalette(seed, BEAM_PALETTES);
    return generateBeamData(seed, palette);
  }, [seed]);

  const S = BEAM_SIZE;
  const half = S / 2;

  return (
    <Svg viewBox={`0 0 ${S} ${S}`} width={size} height={size}>
      <Mask id="beamMask" maskUnits="userSpaceOnUse" x={0} y={0} width={S} height={S}>
        <Rect width={S} height={S} rx={S * 2} fill="#FFFFFF" />
      </Mask>
      <G mask="url(#beamMask)">
        {/* Background */}
        <Rect width={S} height={S} fill={data.backgroundColor} />

        {/* Body shape */}
        <Rect
          x={0}
          y={0}
          width={S}
          height={S}
          transform={`translate(${data.wrapperTranslateX} ${data.wrapperTranslateY}) rotate(${data.wrapperRotate} ${half} ${half}) scale(${data.wrapperScale})`}
          fill={data.wrapperColor}
          rx={data.isCircle ? S : S / 6}
        />

        {/* Face */}
        <G
          transform={`translate(${data.faceTranslateX} ${data.faceTranslateY}) rotate(${data.faceRotate} ${half} ${half})`}
        >
          {/* Mouth */}
          {data.isMouthOpen ? (
            <Path
              d={`M15 ${19 + data.mouthSpread}c2 1 4 1 6 0`}
              stroke={data.faceColor}
              fill="none"
              strokeLinecap="round"
            />
          ) : (
            <Path d={`M13,${19 + data.mouthSpread} a1,0.75 0 0,0 10,0`} fill={data.faceColor} />
          )}

          {/* Left eye */}
          <Rect
            x={14 - data.eyeSpread}
            y={14}
            width={1.5}
            height={2}
            rx={1}
            stroke="none"
            fill={data.faceColor}
          />

          {/* Right eye */}
          <Rect
            x={20 + data.eyeSpread}
            y={14}
            width={1.5}
            height={2}
            rx={1}
            stroke="none"
            fill={data.faceColor}
          />
        </G>
      </G>
    </Svg>
  );
});

BeamAvatar.displayName = 'BeamAvatar';

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
 * Dispatches to RingAvatar (Common) or BeamAvatar (Rare) based on seed prefix.
 */
export const GeneratedAvatar = memo<GeneratedAvatarProps>(({ seed, size }) => {
  const variant = getGeneratedVariant(seed);
  if (variant === 'beam') {
    return <BeamAvatar seed={seed} size={size} />;
  }
  return <RingAvatar seed={seed} size={size} />;
});

GeneratedAvatar.displayName = 'GeneratedAvatar';
