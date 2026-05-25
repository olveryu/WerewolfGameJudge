/**
 * appReady — App 初始化完成信号
 *
 * `signalAppReady()` is called after SplashScreen hides to signal app readiness.
 */
let resolve: () => void;
// Promise exists solely to capture the resolver; not consumed externally.
void new Promise<void>((r) => {
  resolve = r;
});

/** 标记 App 初始化完成（SplashScreen 隐藏后调用）。 */
export function signalAppReady(): void {
  resolve();
}
