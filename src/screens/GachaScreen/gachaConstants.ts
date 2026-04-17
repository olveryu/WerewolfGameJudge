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
export const BODY_T = DOME_CY + DOME_R; // same Y as HOLE_Y
export const BODY_B = 400;

export const CHUTE_TOP = 400; // same Y as BODY_B
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
  bg: '#F2F2F7',
  bgLight: '#E8E8F0',
  body: '#5B4FA0',
  bodyMid: '#6B5FB5',
  bodyEdge: 'rgba(255,255,255,0.25)',
  dome: 'rgba(100,130,200,0.06)',
  domeStroke: 'rgba(90,90,150,0.35)',
  domeHighlight: 'rgba(255,255,255,0.2)',
  chute: '#4A3F8A',
  chuteStroke: 'rgba(255,255,255,0.15)',
  floor: 'rgba(0,0,0,0.03)',
  floorLine: 'rgba(0,0,0,0.06)',
  shadow: 'rgba(0,0,0,0.12)',
  dialBody: '#7A70B0',
  dialHighlight: '#9A92CC',
  dialKnob: '#B0A8D8',
  dialStroke: 'rgba(255,255,255,0.3)',
  gate: 'rgba(255,200,50,0.4)',
  capsuleBottom: '#e0e0e0',
  capsuleRing: 'rgba(255,255,255,0.2)',
  capsuleHighlight: 'rgba(255,255,255,0.3)',
} as const;
