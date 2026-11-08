// `ds check` — finds the known traps in a consumer app that fail silently:
// the app looks wrong and nothing errors. traps.mjs holds the checks.
//
// Warnings by default, exit 0. `--strict` exits 1 on any warning, so an app can
// gate CI on it when it chooses to. Failing by default would break builds that
// pass today, which needs a major version (decided on #328).

import { statSync } from 'node:fs';

import { readRecord } from '../../resync/artifacts.mjs';
import { REACT_PKG, TOKENS_PKG } from '../discovery.mjs';
import { DS_STYLESHEETS, scanRepo, scriptImports } from './scan.mjs';
import { TRAPS } from './traps.mjs';

const ISSUES = 'https://github.com/EliRobinson/design-system/issues';

function isDirectory(path) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/**
 * @param {object} input
 * @param {string} input.root consumer repo root
 * @param {object} input.env what `loadEnvironment` found installed for that root
 * @param {boolean} [input.strict] exit 1 on any warning
 * @returns {{ text: string, exitCode: number, findings: object[] }}
 */
export function runCheck({ root, env, strict = false }) {
  if (!isDirectory(root)) {
    return { text: `ds check: ${root} is not a directory.`, exitCode: 1, findings: [] };
  }

  /* With neither package installed every check is blind, and "no traps found"
     would be a false all-clear for a wrong --dir or a missing install. */
  if (!env.react && !env.tokens) {
    return {
      text: [
        `ds check: ${REACT_PKG} and ${TOKENS_PKG} are not installed in ${root},`,
        'so nothing could be checked. Run it from the app that uses the design system,',
        'or pass --dir <path>.',
      ].join('\n'),
      exitCode: strict ? 1 : 0,
      findings: [],
    };
  }

  const { css, source } = scanRepo(root);
  const entryStylesheet = css.find((file) =>
    file.imports.some((entry) => DS_STYLESHEETS.includes(entry.specifier)),
  )?.path;

  const context = {
    root,
    env,
    css,
    source,
    record: readRecord(root),
    entryStylesheet,
    usesDesignSystem:
      entryStylesheet !== undefined || source.some((file) => scriptImports(file, DS_STYLESHEETS)),
    usesTailwind: css.some((file) =>
      file.imports.some((entry) => entry.specifier === 'tailwindcss'),
    ),
  };

  const findings = TRAPS.flatMap((trap) =>
    trap.run(context).map((finding) => ({ id: trap.id, issues: trap.issues, ...finding })),
  );

  return {
    text: formatReport({ root, findings, strict }),
    exitCode: strict && findings.length > 0 ? 1 : 0,
    findings,
  };
}

function formatFinding(finding) {
  const issues = finding.issues.map((number) => `#${number}`).join(', ');
  return [
    `warn  ${finding.id}  (${issues})`,
    ...finding.where.map((line) => `  Where: ${line}`),
    ...finding.what.map((line, index) => `  ${index === 0 ? 'What: ' : '      '}${line}`),
    '  Fix:',
    ...finding.fix.map((line) => (line ? `    ${line}` : '')),
  ].join('\n');
}

export function formatReport({ root, findings, strict }) {
  const ran = `${TRAPS.length} checks ran: ${TRAPS.map((trap) => trap.id).join(', ')}`;

  if (findings.length === 0) {
    return [`ds check: no known traps found in ${root}.`, ran].join('\n');
  }

  const count = `${findings.length} warning${findings.length === 1 ? '' : 's'}`;
  return [
    `ds check: ${count} in ${root}.`,
    ran,
    '',
    ...findings.flatMap((finding) => [formatFinding(finding), '']),
    `Each issue number is ${ISSUES}/<number>.`,
    strict
      ? 'Exit 1, because --strict is set.'
      : 'Warnings do not change the exit code. Pass --strict to exit 1 on any warning.',
  ].join('\n');
}
