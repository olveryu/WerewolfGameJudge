import type { SceneStage } from '@/scene/stage';

let stagePromise: Promise<SceneStage> | null = null;

/**
 * The app-wide scene stage as a stable promise for React's `use()`. PixiJS loads in its own
 * chunk on first call; a rejection (no WebGL) reaches the nearest error boundary.
 */
export function sceneStagePromise(): Promise<SceneStage> {
  stagePromise ??= import('@/scene/stage').then(({ createSceneStage }) => createSceneStage());
  return stagePromise;
}
