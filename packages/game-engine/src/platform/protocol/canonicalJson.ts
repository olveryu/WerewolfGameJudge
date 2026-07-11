/** Deterministic JSON encoding for idempotency identities and protocol fingerprints. */

function encodeString(value: string): string {
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw new Error('Failed to encode JSON string');
  return encoded;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function encodeCanonicalJson(value: unknown, path: string, ancestors: Set<object>): string {
  if (value === null) return 'null';

  switch (typeof value) {
    case 'string':
      return encodeString(value);
    case 'boolean':
      return value ? 'true' : 'false';
    case 'number':
      if (!Number.isFinite(value)) {
        throw new Error(`${path} must contain a finite number`);
      }
      return JSON.stringify(value);
    case 'object': {
      if (ancestors.has(value)) throw new Error(`${path} contains a circular reference`);
      ancestors.add(value);

      const encoded = Array.isArray(value)
        ? `[${value
            .map((item, index) => {
              if (item === undefined) throw new Error(`${path}[${index}] must not be undefined`);
              return encodeCanonicalJson(item, `${path}[${index}]`, ancestors);
            })
            .join(',')}]`
        : (() => {
            if (!isRecord(value)) throw new Error(`${path} must contain only JSON objects`);
            const prototype = Reflect.getPrototypeOf(value);
            if (prototype !== Object.prototype && prototype !== null) {
              throw new Error(`${path} must contain only plain objects`);
            }
            const fields = Object.keys(value)
              .sort()
              .flatMap((key) => {
                const field = value[key];
                return field === undefined
                  ? []
                  : [
                      `${encodeString(key)}:${encodeCanonicalJson(
                        field,
                        `${path}.${key}`,
                        ancestors,
                      )}`,
                    ];
              });
            return `{${fields.join(',')}}`;
          })();

      ancestors.delete(value);
      return encoded;
    }
    case 'undefined':
    case 'bigint':
    case 'function':
    case 'symbol':
      throw new Error(`${path} contains a non-JSON value`);
  }
  throw new Error(`${path} has an unsupported value`);
}

/** Encode JSON-compatible data with recursively sorted object keys. */
export function canonicalJson(value: unknown): string {
  return encodeCanonicalJson(value, '$', new Set());
}
