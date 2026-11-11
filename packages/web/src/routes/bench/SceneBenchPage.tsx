import { lazy, Suspense } from 'react';

// The bench is a developer page: its code and the scene layer it draws stay out of the start-up
// entry and download only when `/__bench/scene` is opened.
const SceneBench = lazy(() =>
  import('./SceneBench').then((module) => ({ default: module.SceneBench })),
);

/** Route component for `/__bench/scene`; see `SceneBench` for the benchmark and its query options. */
export function SceneBenchPage() {
  return (
    <Suspense fallback={null}>
      <SceneBench />
    </Suspense>
  );
}
