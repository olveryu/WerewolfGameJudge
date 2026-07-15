import { getModuleSpecifiers, getRuntimeModuleSpecifiers } from './moduleSpecifiers';

describe('getModuleSpecifiers', () => {
  it('collects every supported TypeScript module reference syntax', () => {
    const source = `
      import type { TypeOnly } from './type-only';
      import './side-effect';
      export { value } from './re-export';
      export type * from './type-re-export';
      import equalsImport = require('./import-equals');
      type ImportedType = import('./import-type').ImportedType;
      const dynamicImport = import('./dynamic');
      const commonJs = require('./commonjs');
      const resolved = require.resolve('./resolved');
      const moduleRequire = module.require('./module-require');
    `;

    expect(getModuleSpecifiers('fixture.ts', source)).toEqual([
      './type-only',
      './side-effect',
      './re-export',
      './type-re-export',
      './import-equals',
      './import-type',
      './dynamic',
      './commonjs',
      './resolved',
      './module-require',
    ]);
  });

  it('rejects a computed module path instead of silently skipping it', () => {
    expect(() => getModuleSpecifiers('fixture.ts', "import('./' + moduleName)")).toThrow(
      '[FAIL-FAST] fixture.ts contains a non-literal module path',
    );
  });
});

describe('getRuntimeModuleSpecifiers', () => {
  it('excludes erased imports and keeps every executable module dependency', () => {
    const source = `
      import type { TypeOnly } from './type-only';
      import { type NamedTypeOnly } from './named-type-only';
      import { type MixedType, mixedValue } from './mixed';
      import defaultValue from './default';
      import * as namespace from './namespace';
      import './side-effect';
      export type { ExportedType } from './type-re-export';
      export { type NamedExportType } from './named-type-re-export';
      export { type MixedExportType, mixedExportValue } from './mixed-re-export';
      export * from './star-re-export';
      import equalsImport = require('./import-equals');
      type ImportedType = import('./import-type').ImportedType;
      const dynamicImport = import('./dynamic');
      const commonJs = require('./commonjs');
    `;

    expect(getRuntimeModuleSpecifiers('fixture.ts', source)).toEqual([
      './mixed',
      './default',
      './namespace',
      './side-effect',
      './mixed-re-export',
      './star-re-export',
      './import-equals',
      './dynamic',
      './commonjs',
    ]);
  });

  it('rejects a computed runtime module path instead of silently skipping it', () => {
    expect(() => getRuntimeModuleSpecifiers('fixture.ts', "require('./' + moduleName)")).toThrow(
      '[FAIL-FAST] fixture.ts contains a non-literal module path',
    );
  });
});
