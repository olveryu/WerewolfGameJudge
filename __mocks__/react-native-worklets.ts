/**
 * Jest mock for react-native-worklets
 *
 * Reanimated v4 depends on react-native-worklets which tries to
 * initialize native modules. This mock stubs them out for Jest.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

const NOOP = () => {};

// ── Set up required globals that Reanimated expects ─────────────────────
const _global = global as any;

// Animation timestamp — needed by valueSetter.ts / core.ts
if (!_global._getAnimationTimestamp) {
  _global._getAnimationTimestamp = () => Date.now();
}
if (!_global.__frameTimestamp) {
  _global.__frameTimestamp = undefined;
}

// Worklet-to-JS bridge stubs
if (!_global._scheduleOnJS) {
  _global._scheduleOnJS = (fn: any, ...args: any[]) => {
    if (typeof fn === 'function') fn(...args);
  };
  _global._scheduleOnRuntime = NOOP;
}

// Shared value setter stub — needed to avoid crash on `.value = ...`
if (!_global._makeShareableClone) {
  _global._makeShareableClone = (v: any) => v;
}
if (!_global._notifyAboutProgress) {
  _global._notifyAboutProgress = NOOP;
}
if (!_global._notifyAboutEnd) {
  _global._notifyAboutEnd = NOOP;
}
if (!_global._setGestureState) {
  _global._setGestureState = NOOP;
}

// ReanimatedModule stubs
if (!_global.__reanimatedModuleProxy) {
  _global.__reanimatedModuleProxy = {
    scheduleOnUI: NOOP,
    executeOnUIRuntimeSync: (_shareable: any) => undefined,
    createWorkletRuntime: () => ({}),
    scheduleOnRuntime: NOOP,
    registerSensor: () => -1,
    unregisterSensor: NOOP,
    registerEventHandler: () => -1,
    unregisterEventHandler: NOOP,
    subscribeForKeyboardEvents: () => -1,
    unsubscribeFromKeyboardEvents: NOOP,
    enableLayoutAnimations: NOOP,
    registerSharedValue: NOOP,
    getViewProp: () => '',
    configureLayoutAnimationBatch: NOOP,
    setShouldAnimateExitingForTag: NOOP,
    jsiConfigureProps: NOOP,
    markNodeAsRemovable: NOOP,
    unmarkNodeAsRemovable: NOOP,
    getAnimationTimestamp: () => Date.now(),
    progressLayoutAnimation: NOOP,
    endLayoutAnimation: NOOP,
    makeShareableClone: (v: any) => v,
  };
}

const WorkletsModule = {
  makeShareableClone: (_value: any, _shouldPersistRemote: boolean) => ({
    __hostObjectShareableJSRef: {},
  }),
  scheduleOnUI: NOOP,
  executeOnUIRuntimeSync: (_shareable: any) => undefined,
  createWorkletRuntime: (_name: string, _initializer: any) => ({}),
  scheduleOnRuntime: NOOP,
  registerSensor: () => -1,
  unregisterSensor: NOOP,
  registerEventHandler: () => -1,
  unregisterEventHandler: NOOP,
  subscribeForKeyboardEvents: () => -1,
  unsubscribeFromKeyboardEvents: NOOP,
  enableLayoutAnimations: NOOP,
  registerSharedValue: NOOP,
  getViewProp: (_viewTag: number, _propName: string, _callback: any) => '',
  configureLayoutAnimationBatch: NOOP,
  setShouldAnimateExitingForTag: NOOP,
  jsiConfigureProps: NOOP,
  markNodeAsRemovable: NOOP,
  unmarkNodeAsRemovable: NOOP,
  getAnimationTimestamp: () => Date.now(),
  progressLayoutAnimation: NOOP,
  endLayoutAnimation: NOOP,
};

module.exports = {
  WorkletsModule,
  isShareableRef: () => false,
  makeShareable: <T>(value: T) => value,
  makeShareableCloneRecursive: <T>(value: T) => value,
  makeShareableCloneOnUIRecursive: <T>(value: T) => value,
  shareableMappingCache: { get: () => undefined, set: NOOP },
  getDynamicFeatureFlag: () => false,
  getStaticFeatureFlag: () => false,
  setDynamicFeatureFlag: NOOP,
  isSynchronizable: () => false,
  createSerializable: (value: any) => ({ value }),
  isSerializableRef: () => false,
  registerCustomSerializable: NOOP,
  serializableMappingCache: { get: () => undefined, set: NOOP },
  createSynchronizable: (value: any) => ({ value }),
  getRuntimeKind: () => 'RN',
  RuntimeKind: { RN: 'RN', UI: 'UI', WORKLET: 'WORKLET' },
  createWorkletRuntime: () => ({}),
  runOnRuntime: NOOP,
  scheduleOnRuntime: NOOP,
  callMicrotasks: NOOP,
  executeOnUIRuntimeSync: (_fn: any) => undefined,
  runOnJS: (fn: any) => fn,
  runOnUI: (fn: any) => fn,
  runOnUIAsync: (fn: any) => fn,
  runOnUISync: (fn: any) => fn,
  scheduleOnRN: NOOP,
  scheduleOnUI: NOOP,
  unstable_eventLoopTask: NOOP,
  isWorkletFunction: () => false,
};
