/**
 * Tests for logger utilities
 *
 * jest.setup.ts globally mocks @/utils/logger (silences console).
 * We use jest.requireActual to test the real mapAuthError implementation.
 */

const { mapAuthError, isExpectedAuthError } =
  jest.requireActual<typeof import('@/utils/logger')>('@/utils/logger');

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
    expect(mapAuthError('network error')).toBe('网络异常，请检查网络后重试');
    expect(mapAuthError('fetch failed')).toBe('网络异常，请检查网络后重试');
  });

  // CF API error mappings
  it('maps CF API "too many reset requests"', () => {
    expect(mapAuthError('too many reset requests, try again later')).toBe(
      '重置请求过于频繁，请稍后重试',
    );
  });

  it('maps CF API "too many login attempts"', () => {
    expect(mapAuthError('too many login attempts, try again later')).toBe(
      '登录尝试过于频繁，请稍后重试',
    );
  });

  it('maps CF API "email already registered"', () => {
    expect(mapAuthError('email already registered')).toBe('该邮箱已注册');
  });

  it('maps CF API "email and password required"', () => {
    expect(mapAuthError('email and password required')).toBe('请输入邮箱和密码');
  });

  it('maps CF API "email required"', () => {
    expect(mapAuthError('email required')).toBe('请输入邮箱');
  });

  it('maps CF API "invalid credentials"', () => {
    expect(mapAuthError('invalid credentials')).toBe('邮箱或密码错误');
  });

  it('maps CF API "invalid old password"', () => {
    expect(mapAuthError('invalid old password')).toBe('原密码错误');
  });

  it('maps CF API "invalid or expired code"', () => {
    expect(mapAuthError('invalid or expired code')).toBe('验证码无效或已过期');
  });

  it('maps CF API "failed to send email"', () => {
    expect(mapAuthError('failed to send email, try again later')).toBe('邮件发送失败，请稍后重试');
  });

  it('maps CF API "account has no password"', () => {
    expect(mapAuthError('account has no password (anonymous user)')).toBe('该账户未设置密码');
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

describe('isExpectedAuthError', () => {
  it('returns true for user-input errors', () => {
    expect(isExpectedAuthError('Invalid login credentials')).toBe(true);
    expect(isExpectedAuthError('User already registered')).toBe(true);
    expect(isExpectedAuthError('Email not confirmed')).toBe(true);
    expect(isExpectedAuthError('Password should be at least 6 characters')).toBe(true);
    expect(isExpectedAuthError('Unable to validate email address: invalid format')).toBe(true);
    expect(isExpectedAuthError('Signups not allowed for this instance')).toBe(true);
  });

  it('returns true for rate-limit errors', () => {
    expect(isExpectedAuthError('Email rate limit exceeded')).toBe(true);
    expect(isExpectedAuthError('you can only request this once every 60 seconds')).toBe(true);
    expect(isExpectedAuthError('too many reset requests, try again later')).toBe(true);
  });

  it('returns true for CF API user-input errors', () => {
    expect(isExpectedAuthError('email already registered')).toBe(true);
    expect(isExpectedAuthError('email and password required')).toBe(true);
    expect(isExpectedAuthError('email required')).toBe(true);
    expect(isExpectedAuthError('invalid credentials')).toBe(true);
    expect(isExpectedAuthError('invalid old password')).toBe(true);
    expect(isExpectedAuthError('invalid or expired code')).toBe(true);
    expect(isExpectedAuthError('account has no password (anonymous user)')).toBe(true);
  });

  it('returns false for unexpected errors', () => {
    expect(isExpectedAuthError('network error')).toBe(false);
    expect(isExpectedAuthError('Something unexpected happened')).toBe(false);
    expect(isExpectedAuthError('Internal server error')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(isExpectedAuthError('PASSWORD SHOULD BE AT LEAST 6 CHARACTERS')).toBe(true);
  });
});
