/** Cloudflare request metadata boundary contracts. */

import { describe, expect, it } from 'vitest';

import { readCloudflareRequestMetadata } from '../requestMetadata';

describe('readCloudflareRequestMetadata', () => {
  it('reads the Cloudflare fields consumed by the Worker', () => {
    const request = new Request('https://test.local', {
      cf: {
        country: 'US',
        colo: 'IAD',
        continent: 'NA',
        asOrganization: 'Example Network',
      },
    });

    expect(readCloudflareRequestMetadata(request)).toEqual({
      country: 'US',
      colo: 'IAD',
      continent: 'NA',
      asOrganization: 'Example Network',
    });
  });

  it('keeps unavailable local request metadata absent', () => {
    expect(readCloudflareRequestMetadata(new Request('https://test.local'))).toEqual({
      country: undefined,
      colo: undefined,
      continent: undefined,
      asOrganization: undefined,
    });
    expect(readCloudflareRequestMetadata(undefined)).toEqual({
      country: undefined,
      colo: undefined,
      continent: undefined,
      asOrganization: undefined,
    });
  });

  it('fails fast when a Cloudflare string field has the wrong type', () => {
    const request = new Request('https://test.local', { cf: { country: 123 } });

    expect(() => readCloudflareRequestMetadata(request)).toThrow(
      'request.cf.country must be a string',
    );
  });

  it('fails fast when the continent is outside Cloudflare continent codes', () => {
    const request = new Request('https://test.local', { cf: { continent: 'XX' } });

    expect(() => readCloudflareRequestMetadata(request)).toThrow(
      'request.cf.continent must be a Cloudflare continent code',
    );
  });
});
