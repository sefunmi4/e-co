const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const visitedNodeModules = new Set();
const packageDirsToVisit = [projectRoot];
const packageJsonPaths = [];

while (packageDirsToVisit.length > 0) {
  const packageDir = packageDirsToVisit.pop();
  const nodeModulesDir = path.join(packageDir, 'node_modules');

  if (!fs.existsSync(nodeModulesDir) || visitedNodeModules.has(nodeModulesDir)) {
    continue;
  }

  visitedNodeModules.add(nodeModulesDir);

  const metroCachePackageJson = path.join(nodeModulesDir, 'metro-cache', 'package.json');
  if (fs.existsSync(metroCachePackageJson)) {
    packageJsonPaths.push(metroCachePackageJson);
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

if (packageJsonPaths.length === 0) {
  console.warn('metro-cache package.json not found, skipping export patch');
  process.exit(0);
}

const exportMappings = {
  './src': './src/index.js',
  './src/*': './src/*.js',
  './src/*.js': './src/*.js',
};

let modifiedCount = 0;

for (const packageJsonPath of packageJsonPaths) {
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
    console.info(`Patched metro-cache@${packageJson.version} exports at ${packageJsonPath}`);
  }
}

if (modifiedCount === 0) {
  console.info('metro-cache exports already include src mappings');
}
