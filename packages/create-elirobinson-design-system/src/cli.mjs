#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const [, , projectName] = process.argv;

if (!projectName) {
  console.error('Usage: create-elirobinson-design-system <project-name>');
  process.exit(1);
}

const targetDirectory = resolve(process.cwd(), projectName);
if (existsSync(targetDirectory)) {
  console.error(`Target directory already exists: ${targetDirectory}`);
  process.exit(1);
}

mkdirSync(targetDirectory, { recursive: true });

const currentFileDirectory = dirname(fileURLToPath(import.meta.url));
const templateDirectory = resolve(currentFileDirectory, '../../../templates/default-app');
cpSync(templateDirectory, targetDirectory, { recursive: true, verbatimSymlinks: true });

function readPackageVersion(relativePath) {
  const packageJsonPath = resolve(currentFileDirectory, relativePath);
  return JSON.parse(readFileSync(packageJsonPath, 'utf-8')).version;
}

const tokensVersion = readPackageVersion('../../../packages/tokens/package.json');
const reactVersion = readPackageVersion('../../../packages/react/package.json');

const packageJsonPath = resolve(targetDirectory, 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
packageJson.name = projectName;
packageJson.dependencies['@elirobinson/tokens'] = `^${tokensVersion}`;
packageJson.dependencies['@elirobinson/react'] = `^${reactVersion}`;
writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf-8');

console.log(`Created ${projectName} with EliRobinson Next.js design-system defaults.`);
// The auth token must go in your user-level npmrc, not the scaffolded project's.
// pnpm 10 refuses to expand ${ENV_VAR} in registry credentials read from a project
// .npmrc, since that file is usually committed — so the env-var form fails with a 401.
console.log(
  'Next steps:\n' +
    `  cd ${projectName}\n` +
    '  pnpm config set "//npm.pkg.github.com/:_authToken" <github-pat-with-read:packages>\n' +
    '  pnpm install\n' +
    '  pnpm dev',
);
