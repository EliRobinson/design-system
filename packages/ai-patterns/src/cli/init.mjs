// `ds init --agents` installs the agent-instruction surfaces into a consumer
// repo. Coverage is the point: teammates drive different tools, and an agent
// only follows what it actually loads, so all four land together.
//
// Every template is deliberately free of inventory lists — they point at `ds`
// instead. That is what lets a consumer bump a version and be current without
// editing prose.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

const BEGIN = '<!-- design-system:begin -->';
const END = '<!-- design-system:end -->';

/** Where each template lands in a consumer repo, and how it is written. */
export const AGENT_FILES = [
  { template: 'SKILL.md', target: '.claude/skills/design-system/SKILL.md', mode: 'file' },
  { template: 'design-system.mdc', target: '.cursor/rules/design-system.mdc', mode: 'file' },
  { template: 'copilot-instructions.md', target: '.github/copilot-instructions.md', mode: 'file' },
  { template: 'AGENTS.md', target: 'AGENTS.md', mode: 'block' },
];

/**
 * Replace the managed block in `existing`, or append it if there is none.
 * Anything a consumer wrote outside the markers survives verbatim.
 */
export function mergeBlock(existing, block) {
  if (!existing) return `${block.trim()}\n`;

  const start = existing.indexOf(BEGIN);
  const end = existing.indexOf(END);

  if (start !== -1 && end > start) {
    const before = existing.slice(0, start);
    const after = existing.slice(end + END.length);
    return `${before}${block.trim()}${after}`;
  }

  return `${existing.trimEnd()}\n\n${block.trim()}\n`;
}

/**
 * @param {object} options
 * @param {string} options.templateDir directory holding the shipped templates
 * @param {string} options.targetDir consumer repo root
 * @param {boolean} [options.force] overwrite whole files that already exist
 * @returns {{ text: string, exitCode: number }}
 */
export function installAgents({ templateDir, targetDir, force = false }) {
  if (!existsSync(templateDir)) {
    return {
      text: `No agent templates found at ${templateDir}. Upgrade @elirobinson/ai-patterns.`,
      exitCode: 1,
    };
  }

  const written = [];
  const skipped = [];

  for (const { template, target, mode } of AGENT_FILES) {
    const source = join(templateDir, template);
    if (!existsSync(source)) continue;

    const destination = join(targetDir, target);
    const contents = readFileSync(source, 'utf8');
    const exists = existsSync(destination);

    if (mode === 'file' && exists && !force) {
      skipped.push(target);
      continue;
    }

    mkdirSync(dirname(destination), { recursive: true });

    if (mode === 'block') {
      const existing = exists ? readFileSync(destination, 'utf8') : '';
      const merged = mergeBlock(existing, contents);
      if (merged === existing) {
        skipped.push(`${target} (already current)`);
        continue;
      }
      writeFileSync(destination, merged);
    } else {
      writeFileSync(destination, contents);
    }

    written.push(relative(targetDir, destination) || target);
  }

  const lines = [];
  if (written.length) {
    lines.push('Installed:', ...written.map((path) => `  ${path}`));
  }
  if (skipped.length) {
    if (written.length) lines.push('');
    lines.push('Left alone (pass --force to overwrite):', ...skipped.map((path) => `  ${path}`));
  }
  if (!written.length && !skipped.length) {
    lines.push('Nothing to install.');
  }

  lines.push(
    '',
    'Add the discovery command to package.json so the instructions above resolve:',
    '',
    '  "scripts": { "ds": "elirobinson-ds" }',
  );

  return { text: lines.join('\n'), exitCode: 0 };
}
