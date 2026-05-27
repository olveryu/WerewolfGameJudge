/**
 * appReady — app initialization completion signal
 *
 * `signalAppReady()` is called after SplashScreen hides to signal app readiness.
 */
let resolve: () => void;
// Promise exists solely to capture the resolver; not consumed externally.
void new Promise<void>((r) => {
  resolve = r;
});

/** Signal that app initialization is complete (called after SplashScreen hides). */
export function signalAppReady(): void {
  resolve();
}
