/**
 * errorUtils Unit Tests — translateReasonCode + getUserFacingMessage
 */

import { getUserFacingMessage, translateReasonCode } from '../errorUtils';

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

  it('translates newly added reason codes', () => {
    expect(translateReasonCode('NETWORK_ERROR')).toBe('网络异常，请检查网络后重试');
    expect(translateReasonCode('SERVER_ERROR')).toBe('服务暂时不可用，请稍后重试');
    expect(translateReasonCode('TIMEOUT')).toBe('请求超时，请稍后重试');
    expect(translateReasonCode('NOT_CONNECTED')).toBe('未连接到房间');
    expect(translateReasonCode('not_ongoing')).toBe('游戏未在进行中');
    expect(translateReasonCode('userId_mismatch')).toBe('身份不匹配');
    expect(translateReasonCode('host_only')).toBe('仅房主可执行此操作');
    expect(translateReasonCode('MISSING_PARAMS')).toBe('请求参数缺失');
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

describe('getUserFacingMessage', () => {
  it('extracts reason from structured error objects', () => {
    expect(getUserFacingMessage({ reason: 'seat_taken' })).toBe('座位已被占用');
    expect(getUserFacingMessage({ reason: 'TIMEOUT' })).toBe('请求超时，请稍后重试');
  });

  it('translates Error.message if it matches a known reason code', () => {
    expect(getUserFacingMessage(new Error('CONFLICT_RETRY'))).toBe('操作冲突，请重试');
  });

  it('returns Chinese error messages as-is', () => {
    expect(getUserFacingMessage(new Error('邮箱或密码错误'))).toBe('邮箱或密码错误');
  });

  it('returns fallback for English error messages', () => {
    expect(getUserFacingMessage(new Error('Something went wrong'))).toBe('操作失败，请稍后重试');
  });

  it('returns fallback for null/undefined', () => {
    expect(getUserFacingMessage(null)).toBe('操作失败，请稍后重试');
    expect(getUserFacingMessage(undefined)).toBe('操作失败，请稍后重试');
  });

  it('returns custom fallback when provided', () => {
    expect(getUserFacingMessage(null, '自定义提示')).toBe('自定义提示');
  });

  it('ignores unknown reason codes in structured errors', () => {
    expect(getUserFacingMessage({ reason: 'some_unknown_code' })).toBe('操作失败，请稍后重试');
  });
});
