// Argument routing. Pure: takes argv, returns { text, exitCode, warning? }. The
// bin does the writing and exiting — `text` to stdout, `warning` to stderr.

import { join } from 'node:path';

import { installCommand } from '../resync/apply.mjs';
import { detect, findDrift } from '../resync/detect.mjs';
import * as commands from './commands.mjs';
import { loadEnvironment, PATTERNS_PKG, REACT_PKG, TOKENS_PKG, versionOf } from './discovery.mjs';
import { installAgents, installVoice } from './init.mjs';

const HANDLERS = {
  list: (env) => commands.list(env),
  props: (env, args) => commands.props(env, args[0]),
  tokens: (env, args) => commands.tokens(env, args[0]),
  dials: (env) => commands.dials(env),
  classes: (env, args) => commands.classes(env, args[0]),
  contracts: (env) => commands.contracts(env),
  patterns: (env) => commands.patterns(env),
  prompts: (env, args) => commands.prompts(env, args[0]),
  help: () => commands.usage(),
};

function flagged(argv, flag) {
  return argv.includes(flag);
}

function valueOf(argv, flag) {
  const index = argv.indexOf(flag);
  return index === -1 ? undefined : argv[index + 1];
}

/**
 * Reading `node_modules` is this CLI's whole design — describing installed code
 * is what keeps it from going stale, and that does not change here. What
 * changes is honesty about which version it is describing: when the install has
 * drifted from the lockfile, these answers are about code CI does not build,
 * and an agent writing against them ships something that fails there.
 *
 * Returns undefined for anything short of a confirmed disagreement. This runs
 * on every invocation, so a directory with no manifest, no lockfile or no
 * install must cost nothing and say nothing.
 */
export function installWarning(cwd) {
  let detected;
  try {
    detected = detect(cwd);
  } catch {
    return undefined;
  }

  const drift = findDrift(detected.packages);
  if (drift.length === 0) return undefined;

  const { command, args } = installCommand(detected.lock?.kind);
  const versions = drift
    .map((entry) => `${entry.name} ${entry.installed} installed, ${entry.locked} locked`)
    .join('; ');

  return [
    `ds: node_modules disagrees with the lockfile — ${versions}.`,
    `    This describes what is installed, not what CI builds. Run \`${command} ${args.join(' ')}\`, or \`ds-resync\` for the full report.`,
  ].join('\n');
}

/**
 * @param {string[]} argv arguments after the executable and script
 * @param {object} [options]
 * @param {string[]} [options.origins] directories to search for node_modules
 * @param {string} [options.cwd] consumer repo root, for `init`
 * @param {string} [options.selfDir] this package's root, for shipped templates
 */
/* Async because two handlers are: `ds tokens` and `ds dials` read the installed
   tokens package's own dial modules through a dynamic import (see `loadDials`),
   which is what lets them report all four combinations without this package
   depending on that one. Everything else here stays synchronous — `dispatch`
   returns whatever the handler returned, and awaiting a plain object is a
   no-op. */
export async function run(argv, options = {}) {
  const result = await dispatch(argv, options);
  const warning = installWarning(options.cwd ?? process.cwd());

  return warning ? { ...result, warning } : result;
}

function dispatch(argv, { origins, cwd = process.cwd(), selfDir } = {}) {
  if (flagged(argv, '--version') || flagged(argv, '-v')) {
    const env = loadEnvironment(origins, selfDir);
    return {
      text: [REACT_PKG, TOKENS_PKG, PATTERNS_PKG]
        .map((name) => `${name}@${env.versions[name] ?? '(not installed)'}`)
        .join('\n'),
      exitCode: 0,
    };
  }

  if (flagged(argv, '--help') || flagged(argv, '-h')) return commands.usage();

  const [command = 'list', ...args] = argv.filter((argument) => !argument.startsWith('-'));

  /* Routed ahead of loadEnvironment because it reads nothing installed: which voice is
     in force is a fact about the consumer's own repo, and answering it must not depend
     on @elirobinson/react being present. */
  if (command === 'voice') return commands.voice({ cwd });

  if (command === 'init') {
    if (!flagged(argv, '--agents') && !flagged(argv, '--voice')) {
      return {
        text: 'Usage: ds init --agents [--force] [--dir <path>]\n       ds init --voice [--dir <path>]\n\n--agents installs the agent-instruction files (Claude Code skill, Cursor rule,\nCopilot instructions, AGENTS.md block) into this repo.\n--voice scaffolds a voice.json, which is how this repo declares its own brand\nvoice instead of inheriting the pack the design system ships.',
        exitCode: 1,
      };
    }

    const templateRoot = selfDir ?? loadEnvironment(origins).patterns;
    if (!templateRoot) {
      return { text: `${PATTERNS_PKG} is not installed.`, exitCode: 1 };
    }

    if (flagged(argv, '--voice')) {
      return installVoice({
        starterPath: join(templateRoot, 'src', 'voice', 'starter.voice.json'),
        targetDir: valueOf(argv, '--dir') ?? cwd,
      });
    }

    return installAgents({
      templateDir: join(templateRoot, 'src', 'agents'),
      targetDir: valueOf(argv, '--dir') ?? cwd,
      force: flagged(argv, '--force'),
    });
  }

  const handler = HANDLERS[command];
  const env = loadEnvironment(origins, selfDir);

  // Bare `ds Button` is treated as `ds props Button`.
  if (!handler) {
    if (/^[A-Z]/.test(command)) return commands.props(env, command);
    return { ...commands.usage(), exitCode: 1 };
  }

  return handler(env, args);
}

export { versionOf };
