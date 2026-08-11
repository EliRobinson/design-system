// Argument routing. Pure: takes argv, returns { text, exitCode }. The bin does
// the writing and exiting.

import { join } from 'node:path';

import * as commands from './commands.mjs';
import { loadEnvironment, PATTERNS_PKG, REACT_PKG, TOKENS_PKG, versionOf } from './discovery.mjs';
import { installAgents } from './init.mjs';

const HANDLERS = {
  list: (env) => commands.list(env),
  props: (env, args) => commands.props(env, args[0]),
  tokens: (env, args) => commands.tokens(env, args[0]),
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
 * @param {string[]} argv arguments after the executable and script
 * @param {object} [options]
 * @param {string[]} [options.origins] directories to search for node_modules
 * @param {string} [options.cwd] consumer repo root, for `init`
 * @param {string} [options.selfDir] this package's root, for shipped templates
 */
export function run(argv, { origins, cwd = process.cwd(), selfDir } = {}) {
  if (flagged(argv, '--version') || flagged(argv, '-v')) {
    const env = loadEnvironment(origins);
    return {
      text: [REACT_PKG, TOKENS_PKG, PATTERNS_PKG]
        .map((name) => `${name}@${env.versions[name] ?? '(not installed)'}`)
        .join('\n'),
      exitCode: 0,
    };
  }

  if (flagged(argv, '--help') || flagged(argv, '-h')) return commands.usage();

  const [command = 'list', ...args] = argv.filter((argument) => !argument.startsWith('-'));

  if (command === 'init') {
    if (!flagged(argv, '--agents')) {
      return {
        text: 'Usage: ds init --agents [--force] [--dir <path>]\n\nInstalls the agent-instruction files (Claude Code skill, Cursor rule,\nCopilot instructions, AGENTS.md block) into this repo.',
        exitCode: 1,
      };
    }

    const templateRoot = selfDir ?? loadEnvironment(origins).patterns;
    if (!templateRoot) {
      return { text: `${PATTERNS_PKG} is not installed.`, exitCode: 1 };
    }

    return installAgents({
      templateDir: join(templateRoot, 'src', 'agents'),
      targetDir: valueOf(argv, '--dir') ?? cwd,
      force: flagged(argv, '--force'),
    });
  }

  const handler = HANDLERS[command];
  const env = loadEnvironment(origins);

  // Bare `ds Button` is treated as `ds props Button`.
  if (!handler) {
    if (/^[A-Z]/.test(command)) return commands.props(env, command);
    return { ...commands.usage(), exitCode: 1 };
  }

  return handler(env, args);
}

export { versionOf };
