import { type SceneStage, sharedSceneStage } from '@/scene/stage';

let stagePromise: Promise<SceneStage> | null = null;

/**
 * The app-wide scene stage as a stable promise for React's `use()`. Code is eager, but the
 * WebGL application is created only on first use; a rejection reaches the nearest error boundary.
 */
export function sceneStagePromise(): Promise<SceneStage> {
  stagePromise ??= sharedSceneStage();
  return stagePromise;
}
