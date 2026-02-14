/**
 * Tests for logger utilities
 *
 * jest.setup.ts globally mocks @/utils/logger (silences console).
 * We use jest.requireActual to test the real mapAuthError implementation.
 */

const { mapAuthError } = jest.requireActual<typeof import('@/utils/logger')>('@/utils/logger');

describe('mapAuthError', () => {
  it('maps "invalid login credentials" to Chinese', () => {
    expect(mapAuthError('Invalid login credentials')).toBe('邮箱或密码错误');
  });

  it('maps "user already registered"', () => {
    expect(mapAuthError('User already registered')).toBe('该邮箱已注册');
  });

  it('maps "email not confirmed"', () => {
    expect(mapAuthError('Email not confirmed')).toBe('邮箱未验证，请查收验证邮件');
  });

  it('maps "password should be at least"', () => {
    expect(mapAuthError('Password should be at least 6 characters')).toBe('密码至少需要6个字符');
  });

  it('maps "unable to validate email address"', () => {
    expect(mapAuthError('Unable to validate email address: invalid format')).toBe('邮箱格式无效');
  });

  it('maps "anonymous sign-ins are disabled"', () => {
    expect(mapAuthError('Anonymous sign-ins are disabled')).toBe('匿名登录已禁用');
  });

  it('maps "signups not allowed"', () => {
    expect(mapAuthError('Signups not allowed for this instance')).toBe('注册功能已关闭');
  });

  it('maps "email rate limit exceeded"', () => {
    expect(mapAuthError('Email rate limit exceeded')).toBe('操作过于频繁，请稍后重试');
  });

  it('maps "only request this once every"', () => {
    expect(
      mapAuthError('For security purposes, you can only request this once every 60 seconds'),
    ).toBe('请求过于频繁，请稍等后重试');
  });

  it('maps network errors', () => {
    expect(mapAuthError('network error')).toBe('网络连接失败，请检查网络后重试');
    expect(mapAuthError('fetch failed')).toBe('网络连接失败，请检查网络后重试');
  });

  it('falls back to generic Chinese message for unknown English errors', () => {
    expect(mapAuthError('Something unexpected happened')).toBe('操作失败，请稍后重试');
  });

  it('returns original message if already Chinese', () => {
    expect(mapAuthError('自定义中文错误')).toBe('自定义中文错误');
  });

  it('is case-insensitive', () => {
    expect(mapAuthError('INVALID LOGIN CREDENTIALS')).toBe('邮箱或密码错误');
    expect(mapAuthError('user ALREADY registered')).toBe('该邮箱已注册');
  });
});
