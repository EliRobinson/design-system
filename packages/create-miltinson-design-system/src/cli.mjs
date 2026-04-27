#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const [, , projectName] = process.argv;

if (!projectName) {
  console.error('Usage: create-miltinson-design-system <project-name>');
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
cpSync(templateDirectory, targetDirectory, { recursive: true });

const packageJsonPath = resolve(targetDirectory, 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
packageJson.name = projectName;
writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf-8');

console.log(`Created ${projectName} with Miltinson design-system defaults.`);
console.log(`Next steps:\n  cd ${projectName}\n  npm install\n  npm run dev`);
