/**
 * appReady — App 初始化完成信号
 *
 * Module-level Promise，在 SplashScreen 隐藏后 resolve。
 * 用于让 usePageGuide 等延迟行为等待 app 真正可见后再触发。
 */
let resolve: () => void;
export const appReadyPromise = new Promise<void>((r) => {
  resolve = r;
});
export function signalAppReady(): void {
  resolve();
}
