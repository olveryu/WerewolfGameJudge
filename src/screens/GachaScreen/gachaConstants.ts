/**
 * gachaConstants — 扭蛋机动画常量。
 *
 * 物理参数、几何布局（基于 400×600 参考坐标系）、颜色。
 * CapsuleMachine 按实际 Canvas 尺寸缩放。
 */

// ─── Phase state machine ────────────────────────────────────────────────

export const PHASE = {
  IDLE: 0,
  TUMBLING: 1,
  SETTLING: 2,
  WAITING_RESULTS: 3,
  GATE_OPEN: 4,
  DROPPING: 5,
  AUTO_OPEN_WAIT: 6,
  SINGLE_REVEALING: 7,
  MULTI_GATE_OPEN: 8,
  MULTI_DROPPING: 9,
  MULTI_OPENING: 10,
  DONE: 11,
} as const;

// ─── Physics ────────────────────────────────────────────────────────────

export const GRAVITY = 500;
export const DAMPING = 0.7;
export const FRICTION = 0.985;
export const NUM_BALLS = 28;
export const BALL_R = 14;
export const BALL_R_SINGLE = 18;
export const BALL_R_MULTI = 16;
export const COLLISION_PASSES = 3;
export const TUMBLE_DURATION = 2.2;
export const SETTLE_DURATION = 0.4;
export const TUMBLE_FORCE = 3000;

// ─── Reference geometry (400×600) ───────────────────────────────────────

export const REF_W = 400;
export const REF_H = 600;

export const DOME_CX = 200;
export const DOME_CY = 165;
export const DOME_R = 125;

export const HOLE_CX = 200;
export const HOLE_Y = DOME_CY + DOME_R; // 290
export const HOLE_HALF_W = 16;

export const BODY_L = 60;
export const BODY_R = 340;
export const BODY_T = HOLE_Y;
export const BODY_B = 400;

export const CHUTE_TOP = BODY_B;
export const CHUTE_BOT = 445;
export const FLOOR_Y = 540;
export const DIAL_Y = 345;

// ─── Ball colors ────────────────────────────────────────────────────────

export const BALL_COLORS = [
  '#e74c3c',
  '#3498db',
  '#2ecc71',
  '#f39c12',
  '#9b59b6',
  '#e67e22',
  '#1abc9c',
  '#e84393',
  '#00b894',
  '#6c5ce7',
  '#fdcb6e',
  '#fab1a0',
  '#74b9ff',
  '#a29bfe',
  '#fd79a8',
  '#55efc4',
  '#ff7675',
  '#0984e3',
  '#d63031',
  '#ffeaa7',
  '#00cec9',
  '#e17055',
  '#81ecec',
  '#636e72',
  '#b2bec3',
  '#dfe6e9',
  '#fd79a8',
  '#ffeaa7',
];

// ─── Machine visual colors ──────────────────────────────────────────────

export const MACHINE = {
  bg: '#0a0a1a',
  bgLight: '#1a1a3e',
  body: '#1e1e42',
  bodyMid: '#2e2e58',
  bodyEdge: 'rgba(255,255,255,0.18)',
  dome: 'rgba(200,220,255,0.08)',
  domeStroke: 'rgba(255,255,255,0.3)',
  domeHighlight: 'rgba(255,255,255,0.13)',
  chute: '#161630',
  chuteStroke: 'rgba(255,255,255,0.1)',
  floor: 'rgba(255,255,255,0.03)',
  floorLine: 'rgba(255,255,255,0.08)',
  shadow: 'rgba(0,0,0,0.3)',
  dialBody: '#4a4a6a',
  dialHighlight: '#7a7a9a',
  dialKnob: '#9a9ab0',
  dialStroke: 'rgba(255,255,255,0.22)',
  gate: 'rgba(255,200,50,0.3)',
  capsuleBottom: '#e0e0e0',
  capsuleRing: 'rgba(255,255,255,0.2)',
  capsuleHighlight: 'rgba(255,255,255,0.3)',
} as const;

// ─── Rarity visual mapping ─────────────────────────────────────────────

export const RARITY_VISUAL: Record<string, { color: string; glow: string; label: string }> = {
  common: { color: '#9E9E9E', glow: 'rgba(158,158,158,0.3)', label: '普通' },
  rare: { color: '#4A90D9', glow: 'rgba(74,144,217,0.4)', label: '稀有' },
  epic: { color: '#9B59B6', glow: 'rgba(155,89,182,0.5)', label: '史诗' },
  legendary: { color: '#F5A623', glow: 'rgba(245,166,35,0.5)', label: '传说' },
};

// ─── Dark theme colors (GachaScreen / TenResultOverlay) ─────────────────

export const DARK = {
  bg: '#0a0a1a',
  card: '#1a1a38',
  text: '#FFFFFF',
  textMuted: 'rgba(255,255,255,0.6)',
  textDim: 'rgba(255,255,255,0.5)',
  textDimmer: 'rgba(255,255,255,0.35)',
  accent: '#F59E0B',
  success: '#22C55E',
  golden: '#9A7500',
  overlay: 'rgba(0,0,0,0.6)',
  panelBg: 'rgba(10,10,26,0.95)',
  panelBorder: 'rgba(255,255,255,0.08)',
  subtleBg: 'rgba(255,255,255,0.06)',
  subtleBorder: 'rgba(255,255,255,0.06)',
  buttonBg: 'rgba(255,255,255,0.1)',
  cellBg: 'rgba(255,255,255,0.04)',
  cellBorder: 'rgba(255,255,255,0.08)',
  tenOverlayBg: 'rgba(5,5,20,0.92)',
  titleWarm: '#f0e0c0',
} as const;
