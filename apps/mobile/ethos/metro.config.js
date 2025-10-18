const fs = require('fs');
const Module = require('module');
const path = require('path');
const { getDefaultConfig } = require('@expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../../..');

const projectReactNativePackageJson = path.join(
  projectRoot,
  'node_modules/react-native/package.json',
);
const workspaceReactNativePackageJson = path.join(
  workspaceRoot,
  'node_modules/react-native/package.json',
);

if (!fs.existsSync(projectReactNativePackageJson) && !fs.existsSync(workspaceReactNativePackageJson)) {
  throw new Error(
    'React Native could not be resolved. Please install dependencies with "npm install --workspace apps/mobile/ethos".',
  );
}

const originalResolveFilename = Module._resolveFilename;
let shouldUseWorkspaceReactNative = false;

Module._resolveFilename = function patchedResolveFilename(request, parent, isMain, options) {
  if (request === 'metro/src/stores/FileStore') {
    return originalResolveFilename.call(this, 'metro/private/stores/FileStore', parent, isMain, options);
  }

  if (request === 'metro-cache/src/stores/FileStore') {
    return originalResolveFilename.call(this, 'metro-cache/private/stores/FileStore', parent, isMain, options);
  }

  if (request === 'metro/src/DeltaBundler/Serializers/sourceMapString') {
    return originalResolveFilename.call(
      this,
      'metro/private/DeltaBundler/Serializers/sourceMapString',
      parent,
      isMain,
      options,
    );
  }

  if (request === 'metro/src/lib/TerminalReporter') {
    return originalResolveFilename.call(this, 'metro/private/lib/TerminalReporter', parent, isMain, options);
  }

  if (shouldUseWorkspaceReactNative && request === 'react-native/package.json') {
    return workspaceReactNativePackageJson;
  }

  return originalResolveFilename.call(this, request, parent, isMain, options);
};

async function loadConfig(useWorkspaceReactNative) {
  shouldUseWorkspaceReactNative = useWorkspaceReactNative;
  try {
    return await getDefaultConfig(projectRoot);
  } finally {
    shouldUseWorkspaceReactNative = false;
  }
}

module.exports = (async () => {
  const hasProjectReactNative = fs.existsSync(projectReactNativePackageJson);
  const hasWorkspaceReactNative = fs.existsSync(workspaceReactNativePackageJson);
  const useWorkspaceReactNative = !hasProjectReactNative && hasWorkspaceReactNative;

  const config = await loadConfig(useWorkspaceReactNative);

  config.watchFolders = [workspaceRoot];
  config.resolver.nodeModulesPaths = [
    path.resolve(projectRoot, 'node_modules'),
    path.resolve(workspaceRoot, 'node_modules'),
  ];

  config.resolver.disableHierarchicalLookup = true;

  return config;
})();
