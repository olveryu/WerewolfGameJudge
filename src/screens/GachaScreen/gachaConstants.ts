/**
 * gachaConstants — 扭蛋机动画常量。
 *
 * Phase 状态机 + 参考坐标系尺寸。
 * 物理参数 / 几何布局 / 颜色已内联到 CapsuleMachineCanvas DOM 组件。
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

// ─── Reference geometry ─────────────────────────────────────────────────

export const REF_W = 400;
export const REF_H = 600;
