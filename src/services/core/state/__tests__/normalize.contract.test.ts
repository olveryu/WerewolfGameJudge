/**
 * Normalize Contract Tests - 归一化契约测试
 *
 * 验证 normalizeState 的关键不变量：
 * - seat-map keys 是 string
 * - wolfVotes -> wolfVoteStatus 派生
 * - legacy 兼容
 */

import { normalizeState, normalizeStateForTests, canonicalizeSeatKeyRecord } from '../normalize';

describe('canonicalizeSeatKeyRecord', () => {
  it('undefined 输入返回 undefined', () => {
    expect(canonicalizeSeatKeyRecord(undefined)).toBeUndefined();
  });

  it('number keys 转换为 string keys', () => {
    const input = { 1: 'a', 2: 'b' };
    const result = canonicalizeSeatKeyRecord(input);
    expect(result).toEqual({ '1': 'a', '2': 'b' });
  });

  it('string keys 保持不变', () => {
    const input = { '1': 'a', '2': 'b' };
    const result = canonicalizeSeatKeyRecord(input);
    expect(result).toEqual({ '1': 'a', '2': 'b' });
  });

  it('混合 keys 全部转为 string', () => {
    // TypeScript 类型系统不允许混合，但运行时可能发生
    const input = { 1: 'a', '2': 'b' } as Record<string | number, string>;
    const result = canonicalizeSeatKeyRecord(input);
    expect(Object.keys(result!)).toEqual(['1', '2']);
  });
});

describe('normalizeState', () => {
  describe('必填字段（fail-fast）', () => {
    it('缺少必填字段会 throw（避免掩盖状态损坏）', () => {
      expect(() => normalizeState({} as any)).toThrow(/missing required field/i);
    });
  });

  describe('wolfVotes → wolfVoteStatus 派生', () => {
    it('从 wolfVotes 派生 wolfVoteStatus', () => {
      const result = normalizeStateForTests({
        wolfVotes: { '1': 3, '2': 3 },
      });
      expect(result.wolfVotes).toEqual({ '1': 3, '2': 3 });
      expect(result.wolfVoteStatus).toEqual({ '1': true, '2': true });
    });

    it('wolfVotes 有 number keys 时规范化', () => {
      const result = normalizeStateForTests({
        wolfVotes: { 1: 3, 2: 3 } as Record<string, number>,
      });
      expect(result.wolfVotes).toEqual({ '1': 3, '2': 3 });
      expect(result.wolfVoteStatus).toEqual({ '1': true, '2': true });
    });

    it('wolfVotes 存在时覆盖 wolfVoteStatus', () => {
      const result = normalizeStateForTests({
        wolfVotes: { '1': 3 },
        wolfVoteStatus: { '1': false, '2': true }, // 应被覆盖
      });
      expect(result.wolfVoteStatus).toEqual({ '1': true });
      expect(result.wolfVoteStatus!['2']).toBeUndefined();
    });
  });

  describe('legacy 兼容：仅 wolfVoteStatus', () => {
    it('保留 legacy wolfVoteStatus（无 wolfVotes 时）', () => {
      const result = normalizeStateForTests({
        wolfVoteStatus: { '1': true, '2': false },
      });
      expect(result.wolfVotes).toBeUndefined();
      expect(result.wolfVoteStatus).toEqual({ '1': true, '2': false });
    });

    it('规范化 legacy wolfVoteStatus 的 number keys', () => {
      const result = normalizeStateForTests({
        wolfVoteStatus: { 1: true, 2: false } as Record<string, boolean>,
      });
      expect(result.wolfVoteStatus).toEqual({ '1': true, '2': false });
    });
  });

  describe('可选字段透传', () => {
    it('透传 actions', () => {
      const actions = [{ schemaId: 'wolfKill' as const, actorSeat: 1, timestamp: 123 }];
      const result = normalizeStateForTests({ actions });
      expect(result.actions).toBe(actions);
    });

    it('透传 witchContext', () => {
      const witchContext = { killedIndex: 3, canSave: true, canPoison: true };
      const result = normalizeStateForTests({ witchContext });
      expect(result.witchContext).toBe(witchContext);
    });

    it('透传 seerReveal', () => {
      const seerReveal = { targetSeat: 3, result: '狼人' as const };
      const result = normalizeStateForTests({ seerReveal });
      expect(result.seerReveal).toBe(seerReveal);
    });

    it('未提供的可选字段保持 undefined', () => {
      const result = normalizeStateForTests({});
      expect(result.actions).toBeUndefined();
      expect(result.witchContext).toBeUndefined();
      expect(result.seerReveal).toBeUndefined();
      expect(result.lastNightDeaths).toBeUndefined();
    });
  });

  describe('players 保持现状（Phase 1）', () => {
    it('players 透传，不做 key 规范化', () => {
      const players = {
        1: { uid: 'p1', seatNumber: 1, hasViewedRole: false },
        2: { uid: 'p2', seatNumber: 2, hasViewedRole: true },
      };
      const result = normalizeStateForTests({ players });
      // 注意：Record<number, ...> 在 JS 运行时会变成 string key
      // 但我们不主动规范化 players
      expect(result.players).toBe(players);
    });
  });
});
