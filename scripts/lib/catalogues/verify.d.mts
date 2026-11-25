export interface CatalogueEntry {
  readonly id: string;
  readonly title: string;
  readonly packageName: string;
  readonly test: string;
  readonly baseline: string;
}

export interface CatalogueResult {
  readonly id: string;
  readonly title: string;
  readonly baseline: string;
  readonly status: 'updated' | 'unchanged' | 'changed';
  readonly baselineExisted: boolean;
  readonly reportDirectory: string;
}

export const REPOSITORY_DIRECTORY: string;
export function selectCatalogues(ids: readonly string[]): readonly CatalogueEntry[];
export function compareCatalogue(
  entry: CatalogueEntry,
  actual: string,
  options?: {
    readonly rootDirectory?: string;
    readonly reportDirectory?: string;
    readonly reviewedUpdate?: boolean;
  },
): CatalogueResult;
export function verifyCatalogue(id: string, actual: string): void;
