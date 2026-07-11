import { canonicalJson } from '../canonicalJson';

describe('canonicalJson', () => {
  it('sorts object keys recursively without changing array order', () => {
    expect(canonicalJson({ z: [{ b: 2, a: 1 }], a: true })).toBe('{"a":true,"z":[{"a":1,"b":2}]}');
  });

  it('rejects values that cannot cross a JSON protocol boundary', () => {
    expect(() => canonicalJson({ value: Number.NaN })).toThrow('finite number');
    expect(() => canonicalJson({ value: undefined })).not.toThrow();
    expect(() => canonicalJson([undefined])).toThrow('must not be undefined');
    expect(() => canonicalJson(new Date())).toThrow('plain objects');
  });

  it('rejects circular references', () => {
    const value: { self?: unknown } = {};
    value.self = value;
    expect(() => canonicalJson(value)).toThrow('circular reference');
  });
});
