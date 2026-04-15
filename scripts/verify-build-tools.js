#!/usr/bin/env node
/**
 * verify-build-tools.js
 *
 * Checks for required build tools BEFORE npm install runs.
 * node-pty requires native C++ compilation on Windows.
 *
 * Required:
 *   - Visual Studio Build Tools 2022 (with Desktop development with C++ workload)
 *   - Python 3.x (node-gyp requirement)
 *   - node-gyp availability
 */

const { execSync } = require('child_process');
const { existsSync } = require('fs');
const { join } = require('path');

let allPassed = true;
const results = [];

function check(name, fn) {
  try {
    const result = fn();
    results.push({ name, status: 'PASS', detail: result });
  } catch (err) {
    allPassed = false;
    results.push({ name, status: 'FAIL', detail: err.message });
  }
}

// --- Check 1: Visual Studio Build Tools 2022 ---
check('Visual Studio Build Tools 2022', () => {
  // Try vswhere.exe first (most reliable)
  const vswherePaths = [
    'C:\\Program Files (x86)\\Microsoft Visual Studio\\Installer\\vswhere.exe',
    'C:\\Program Files\\Microsoft Visual Studio\\Installer\\vswhere.exe',
  ];

  let vswhereExe = vswherePaths.find(p => existsSync(p));

  if (vswhereExe) {
    try {
      const output = execSync(
        `"${vswhereExe}" -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath`,
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
      ).trim();
      if (output.length > 0) {
        return `Found at: ${output.split('\n')[0]}`;
      }
    } catch {
      // vswhere ran but found no matching installation
    }
  }

  // Fallback: check for msbuild.exe at known paths
  const msbuildPaths = [
    'C:\\Program Files\\Microsoft Visual Studio\\2022\\BuildTools\\MSBuild\\Current\\Bin\\MSBuild.exe',
    'C:\\Program Files (x86)\\Microsoft Visual Studio\\2022\\BuildTools\\MSBuild\\Current\\Bin\\MSBuild.exe',
    'C:\\Program Files\\Microsoft Visual Studio\\2022\\Community\\MSBuild\\Current\\Bin\\MSBuild.exe',
    'C:\\Program Files\\Microsoft Visual Studio\\2022\\Professional\\MSBuild\\Current\\Bin\\MSBuild.exe',
  ];

  const found = msbuildPaths.find(p => existsSync(p));
  if (found) {
    return `Found MSBuild at: ${found}`;
  }

  throw new Error(
    'Visual Studio Build Tools 2022 not found.\n' +
    'Install with: winget install Microsoft.VisualStudio.2022.BuildTools ' +
    '--override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"'
  );
});

// --- Check 2: Python 3.x ---
check('Python 3.x (>= 3.8)', () => {
  let versionOutput = '';

  // Try python first, then python3
  for (const cmd of ['python --version', 'python3 --version']) {
    try {
      versionOutput = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
      break;
    } catch {
      // Try next command
    }
  }

  if (!versionOutput) {
    throw new Error(
      'Python 3.x not found.\n' +
      'Install with: winget install Python.Python.3.12'
    );
  }

  // Parse version from "Python X.Y.Z"
  const match = versionOutput.match(/Python\s+(\d+)\.(\d+)/i);
  if (!match) {
    throw new Error(`Unrecognized Python version format: ${versionOutput}`);
  }

  const major = parseInt(match[1], 10);
  const minor = parseInt(match[2], 10);

  if (major < 3 || (major === 3 && minor < 8)) {
    throw new Error(
      `Python ${major}.${minor} is too old. Python >= 3.8 required.\n` +
      'Install with: winget install Python.Python.3.12'
    );
  }

  return versionOutput;
});

// --- Check 3: node-gyp ---
check('node-gyp', () => {
  try {
    const output = execSync('npm ls -g node-gyp', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    if (output.includes('node-gyp@')) {
      const match = output.match(/node-gyp@([^\s]+)/);
      return `Found: ${match ? match[0] : 'installed'}`;
    }
  } catch {
    // npm ls may fail if not installed globally
  }

  // Check if node-gyp is bundled with npm (Node.js 16+ includes it)
  try {
    const npmPrefix = execSync('npm prefix -g', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    const nodeGypPath = join(npmPrefix, 'node_modules', 'npm', 'node_modules', 'node-gyp');
    if (existsSync(nodeGypPath)) {
      return 'Available (bundled with npm)';
    }
  } catch {
    // Ignore
  }

  throw new Error(
    'node-gyp not found.\n' +
    'Install with: npm install -g node-gyp'
  );
});

// --- Report ---
console.log('\n=== Build Toolchain Verification ===\n');

for (const r of results) {
  const icon = r.status === 'PASS' ? '[PASS]' : '[FAIL]';
  console.log(`${icon} ${r.name}`);
  if (r.status === 'FAIL') {
    console.log(`       ${r.detail}`);
  } else {
    console.log(`       ${r.detail}`);
  }
}

console.log('');

if (allPassed) {
  console.log('All build tools verified. Run npm install.');
  process.exit(0);
} else {
  console.log('Some build tools are missing. Install the tools above and try again.');
  process.exit(1);
}
