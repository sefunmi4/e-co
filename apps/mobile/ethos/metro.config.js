const fs = require('fs');
const Module = require('module');
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

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

function loadConfig() {
  if (fs.existsSync(projectReactNativePackageJson) || !fs.existsSync(workspaceReactNativePackageJson)) {
    return getDefaultConfig(projectRoot);
  }

  const originalResolveFilename = Module._resolveFilename;

  Module._resolveFilename = function patchedResolveFilename(request, parent, isMain, options) {
    if (request === 'react-native/package.json') {
      return workspaceReactNativePackageJson;
    }

    return originalResolveFilename.call(this, request, parent, isMain, options);
  };

  try {
    return getDefaultConfig(projectRoot);
  } finally {
    Module._resolveFilename = originalResolveFilename;
  }
}

const config = loadConfig();

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

config.resolver.disableHierarchicalLookup = true;

module.exports = config;
