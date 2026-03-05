/**
 * Mock for expo-file-system module (v55 class-based API)
 * Used by Jest via moduleNameMapper
 */

class MockFile {
  uri: string;
  constructor(...uris: unknown[]) {
    this.uri = uris.map(String).join('/');
  }
  write = jest.fn();
  delete = jest.fn();
  text = jest.fn().mockResolvedValue('');
  base64 = jest.fn().mockResolvedValue('');
}

class MockDirectory {
  uri: string;
  constructor(...uris: unknown[]) {
    this.uri = uris.map(String).join('/');
  }
}

export const File = MockFile;
export const Directory = MockDirectory;
export const Paths = {
  cache: new MockDirectory('/mock-cache'),
  document: new MockDirectory('/mock-document'),
  bundle: new MockDirectory('/mock-bundle'),
};

export const EncodingType = {
  UTF8: 'utf8',
  Base64: 'base64',
} as const;
