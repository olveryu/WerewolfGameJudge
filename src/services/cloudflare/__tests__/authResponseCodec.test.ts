import { parseAccessTokenClaims } from '../accessTokenClaims';
import {
  parseAnonymousAuthResponse,
  parseClaimAuthResponse,
  parseCurrentUserResponse,
  parseEmailAuthResponse,
  parseRefreshResponse,
  parseResetPasswordResponse,
} from '../authResponseCodec';
import { isAccessTokenExpired } from '../cfFetch';

const USER_METADATA = {
  display_name: null,
  avatar_url: null,
  custom_avatar_url: null,
  avatar_frame: null,
  seat_flair: null,
  name_style: null,
  equipped_effect: null,
  seat_animation: null,
} as const;

function createUnsignedAccessToken(claims: object): string {
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(claims)}.signature`;
}

describe('auth response codecs', () => {
  it('accepts each exact Worker auth success shape', () => {
    expect(
      parseAnonymousAuthResponse({
        access_token: 'access',
        refresh_token: 'refresh',
        user: {
          id: 'anonymous-user',
          email: null,
          is_anonymous: true,
          has_wechat: false,
          user_metadata: USER_METADATA,
        },
      }).user.is_anonymous,
    ).toBe(true);

    const emailResponse = {
      access_token: 'access',
      refresh_token: 'refresh',
      user: {
        id: 'email-user',
        email: 'user@example.com',
        is_anonymous: false,
        has_wechat: false,
        user_metadata: USER_METADATA,
      },
    };
    expect(parseEmailAuthResponse(emailResponse).user.email).toBe('user@example.com');
    expect(parseResetPasswordResponse({ success: true, ...emailResponse }).user.id).toBe(
      'email-user',
    );
    expect(
      parseClaimAuthResponse({
        ...emailResponse,
        user: { ...emailResponse.user, has_wechat: true },
      }).user.has_wechat,
    ).toBe(true);
    expect(parseRefreshResponse({ access_token: 'next', refresh_token: 'rotated' })).toEqual({
      access_token: 'next',
      refresh_token: 'rotated',
    });
    expect(
      parseCurrentUserResponse({
        data: {
          user: emailResponse.user,
        },
      }).data.user.id,
    ).toBe('email-user');
  });

  it.each([
    {
      access_token: 'access',
      refresh_token: 'refresh',
      user: {
        id: 'anonymous-user',
        email: null,
        is_anonymous: true,
        has_wechat: false,
        user_metadata: USER_METADATA,
        extra: true,
      },
    },
    {
      access_token: 'access',
      refresh_token: 'refresh',
      user: {
        id: 'anonymous-user',
        email: null,
        is_anonymous: false,
        has_wechat: false,
        user_metadata: USER_METADATA,
      },
    },
  ])('rejects a non-canonical anonymous response', (value) => {
    expect(() => parseAnonymousAuthResponse(value)).toThrow();
  });
});

describe('access token claims', () => {
  afterEach(() => jest.restoreAllMocks());

  it('parses the exact claims issued by the Worker', () => {
    const token = createUnsignedAccessToken({ sub: 'user-1', ver: 2, iat: 100, exp: 200 });
    expect(parseAccessTokenClaims(token)).toEqual({ sub: 'user-1', ver: 2, iat: 100, exp: 200 });
  });

  it('uses the documented 30-second freshness buffer', () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    const fresh = createUnsignedAccessToken({ sub: 'user-1', ver: 0, iat: 900, exp: 1_060 });
    const expiring = createUnsignedAccessToken({ sub: 'user-1', ver: 0, iat: 900, exp: 1_020 });

    expect(isAccessTokenExpired(fresh)).toBe(false);
    expect(isAccessTokenExpired(expiring)).toBe(true);
    expect(isAccessTokenExpired('not-a-jwt')).toBe(true);
  });

  it('rejects unissued claims instead of treating arbitrary JWT JSON as a session', () => {
    const token = createUnsignedAccessToken({
      sub: 'user-1',
      ver: 0,
      iat: 100,
      exp: 200,
      role: 'admin',
    });
    expect(() => parseAccessTokenClaims(token)).toThrow();
  });
});
