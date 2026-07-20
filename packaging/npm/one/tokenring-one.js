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

const packageDirectory = (name) =>
  path.dirname(require.resolve(`${name}/package.json`));

const cliDirectory = packageDirectory('@tokenring-ai/one-cli');
const backendDirectory = packageDirectory('@tokenring-ai/one-backend');
const frontendDirectory = packageDirectory('@tokenring-ai/one-frontend');
const binaryPath = path.join(cliDirectory, 'bin', platformArch, 'tokenring');
const env = { ...process.env };

env.TOKENRING_ONE_BINARY ??= path.join(
  backendDirectory,
  'bin',
  platformArch,
  'tokenring-one',
);
env.FRONTEND_DIRECTORY ??= frontendDirectory;

const child = spawn(binaryPath, process.argv.slice(2), { stdio: 'inherit', env });
child.on('error', (error) => {
  console.error(`Failed to start TokenRing One CLI: ${error.message}`);
  process.exit(1);
});
child.on('exit', (code) => process.exit(code ?? 1));
