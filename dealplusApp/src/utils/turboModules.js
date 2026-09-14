import { TurboModuleRegistry } from 'react-native';

/** Safe check — never uses getEnforcing, so a missing native module cannot crash JS. */
export const hasTurboModule = (name) => {
  try {
    return TurboModuleRegistry.get(name) != null;
  } catch {
    return false;
  }
};

/** Jest has no native binaries; skip the presence check so package mocks still load. */
export const shouldLoadNativePackage = (turboModuleName) =>
  hasTurboModule(turboModuleName) || process.env.NODE_ENV === 'test';
