import {
  FIB_DEFAULT_PLAYERS,
  FIB_MAX_PLAYERS,
  FIB_MIN_PLAYERS,
} from '@game-judge/game-engine/games/fibking/public';

import { parseFibPlayerCountInput } from '../fibPlayerCount';

describe('parseFibPlayerCountInput', () => {
  it('keeps the product default at eight and accepts the minimum of four', () => {
    expect(FIB_DEFAULT_PLAYERS).toBe(8);
    expect(FIB_MIN_PLAYERS).toBe(4);
    expect(parseFibPlayerCountInput(String(FIB_MIN_PLAYERS))).toEqual({
      kind: 'valid',
      value: 4,
    });
  });

  it('accepts the product maximum', () => {
    expect(FIB_MAX_PLAYERS).toBe(20);
    expect(parseFibPlayerCountInput(String(FIB_MAX_PLAYERS))).toEqual({
      kind: 'valid',
      value: FIB_MAX_PLAYERS,
    });
  });

  it('rejects counts above the product maximum', () => {
    expect(parseFibPlayerCountInput(String(FIB_MAX_PLAYERS + 1))).toEqual({
      kind: 'invalid',
      reason: '最多支持 20 人',
    });
  });

  it('rejects unsafe integers at the representation boundary', () => {
    expect(parseFibPlayerCountInput('9007199254740992')).toEqual({
      kind: 'invalid',
      reason: '人数超出当前设备可精确表示的范围',
    });
  });

  it.each(['', '-4', '4.5', '四'])('rejects non-digit input %p', (value) => {
    expect(parseFibPlayerCountInput(value)).toEqual({
      kind: 'invalid',
      reason: '人数必须是整数',
    });
  });

  it('rejects counts below the domain minimum', () => {
    expect(parseFibPlayerCountInput('3')).toEqual({
      kind: 'invalid',
      reason: '至少需要 4 人',
    });
  });
});
