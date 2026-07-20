#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');

const platformArch = `${process.platform}-${process.arch}`;
const supportedPlatforms = new Set([
  'darwin-arm64',
  'darwin-x64',
  'linux-x64',
  'linux-arm64',
]);

if (!supportedPlatforms.has(platformArch)) {
  console.error(`Unsupported platform: ${platformArch}`);
  process.exit(1);
}

const binaryPath = path.join(
  __dirname,
  'bin',
  platformArch,
  'tokenring-one',
);
const child = spawn(binaryPath, process.argv.slice(2), {
  stdio: 'inherit',
  env: process.env,
});
child.on('error', (error) => {
  console.error(`Failed to start TokenRing One backend: ${error.message}`);
  process.exit(1);
});
child.on('exit', (code) => process.exit(code ?? 1));
