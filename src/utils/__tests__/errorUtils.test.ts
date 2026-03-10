/**
 * errorUtils Unit Tests — translateReasonCode
 */

import { translateReasonCode } from '../errorUtils';

describe('translateReasonCode', () => {
  it('translates known reason codes to Chinese', () => {
    expect(translateReasonCode('game_in_progress')).toBe('游戏进行中，无法操作');
    expect(translateReasonCode('not_authenticated')).toBe('身份验证失败');
    expect(translateReasonCode('no_state')).toBe('房间不存在或已解散');
    expect(translateReasonCode('invalid_seat')).toBe('座位不存在');
    expect(translateReasonCode('seat_taken')).toBe('座位已被占用');
    expect(translateReasonCode('not_seated')).toBe('你还没有入座');
    expect(translateReasonCode('invalid_status')).toBe('当前状态不允许此操作');
    expect(translateReasonCode('role_count_mismatch')).toBe('角色数量与座位数不匹配');
    expect(translateReasonCode('forbidden_while_audio_playing')).toBe('请等待语音播放完毕');
    expect(translateReasonCode('CONFLICT_RETRY')).toBe('操作冲突，请重试');
    expect(translateReasonCode('ROOM_NOT_FOUND')).toBe('房间不存在或已解散');
    expect(translateReasonCode('INTERNAL_ERROR')).toBe('服务器内部错误');
  });

  it('returns default fallback for unknown reason codes', () => {
    expect(translateReasonCode('unknown_code')).toBe('请稍后重试');
  });

  it('returns default fallback for undefined/null', () => {
    expect(translateReasonCode(undefined)).toBe('请稍后重试');
    expect(translateReasonCode(null)).toBe('请稍后重试');
  });

  it('returns custom fallback when provided', () => {
    expect(translateReasonCode('unknown_code', '操作失败')).toBe('操作失败');
    expect(translateReasonCode(undefined, '操作失败')).toBe('操作失败');
  });
});
