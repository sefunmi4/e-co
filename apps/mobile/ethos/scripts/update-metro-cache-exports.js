const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const visitedNodeModules = new Set();
const initialDirs = new Set([projectRoot]);

let currentDir = projectRoot;
for (let i = 0; i < 3; i += 1) {
  currentDir = path.dirname(currentDir);
  initialDirs.add(currentDir);
}

const packageDirsToVisit = Array.from(initialDirs);
const packageJsonTargets = [];
const targetPackages = ['metro-cache', 'metro-transform-worker'];

while (packageDirsToVisit.length > 0) {
  const packageDir = packageDirsToVisit.pop();
  const nodeModulesDir = path.join(packageDir, 'node_modules');

  if (!fs.existsSync(nodeModulesDir) || visitedNodeModules.has(nodeModulesDir)) {
    continue;
  }

  visitedNodeModules.add(nodeModulesDir);

  for (const packageName of targetPackages) {
    const packageJsonPath = path.join(nodeModulesDir, packageName, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      packageJsonTargets.push({ packageName, packageJsonPath });
    }
  }

  for (const entry of fs.readdirSync(nodeModulesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }

    const entryPath = path.join(nodeModulesDir, entry.name);

    if (entry.name.startsWith('@')) {
      for (const scopedEntry of fs.readdirSync(entryPath, { withFileTypes: true })) {
        if (scopedEntry.isDirectory()) {
          packageDirsToVisit.push(path.join(entryPath, scopedEntry.name));
        }
      }
    } else {
      packageDirsToVisit.push(entryPath);
    }
  }
}

if (packageJsonTargets.length === 0) {
  console.warn('Metro package.json files not found, skipping export patch');
  process.exit(0);
}

const exportMappings = {
  './src': './src/index.js',
  './src/*': './src/*.js',
  './src/*.js': './src/*.js',
};

let modifiedCount = 0;

for (const { packageName, packageJsonPath } of packageJsonTargets) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const exportsField = packageJson.exports ?? {};
  let changed = false;

  for (const [key, value] of Object.entries(exportMappings)) {
    if (exportsField[key] !== value) {
      exportsField[key] = value;
      changed = true;
    }
  }

  if (changed) {
    packageJson.exports = exportsField;
    fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
    modifiedCount += 1;
    console.info(`Patched ${packageName}@${packageJson.version} exports at ${packageJsonPath}`);
  }
}

if (modifiedCount === 0) {
  console.info('Metro exports already include src mappings');
}
