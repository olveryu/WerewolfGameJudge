/** Parse Cloudflare-owned metadata from an incoming Worker request. */

interface CloudflareRequestMetadata {
  readonly country: string | undefined;
  readonly colo: string | undefined;
  readonly continent: ContinentCode | undefined;
  readonly asOrganization: string | undefined;
}

function parseOptionalString(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    throw new TypeError(`request.cf.${field} must be a string`);
  }
  return value;
}

function parseContinent(value: unknown): ContinentCode | undefined {
  const continent = parseOptionalString(value, 'continent');
  switch (continent) {
    case undefined:
    case 'AF':
    case 'AN':
    case 'AS':
    case 'EU':
    case 'NA':
    case 'OC':
    case 'SA':
      return continent;
    default:
      throw new TypeError('request.cf.continent must be a Cloudflare continent code');
  }
}

export function readCloudflareRequestMetadata(
  request: Request | undefined,
): CloudflareRequestMetadata {
  const cf = request?.cf;
  return {
    country: parseOptionalString(cf?.country, 'country'),
    colo: parseOptionalString(cf?.colo, 'colo'),
    continent: parseContinent(cf?.continent),
    asOrganization: parseOptionalString(cf?.asOrganization, 'asOrganization'),
  };
}
