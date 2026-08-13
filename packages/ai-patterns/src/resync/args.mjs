import { resolve as resolvePath } from 'node:path';
import { DEFAULT_TARGET_SPEC, parseOnly, parseTargetSpec, TARGETS } from './targets.mjs';

/**
 * Every flag either command understands, declared once — how it parses and how
 * it documents itself. A `boolean` flag sets its key to true; a `value` flag
 * takes the next argv item — or the text after `=`, both spellings come free —
 * and runs it through `parse`, substituting `whenValueAbsent` if the flag ends
 * argv with nothing after it.
 *
 * `names` holds every spelling in the order the help text should print them,
 * which is why `--help` reads `-h, --help` while `--interactive` reads
 * `--interactive, -i`. Parsing accepts all of them regardless of order.
 *
 * `whenOmitted` supplies the key's value when the flag is not passed at all. It
 * is a function rather than a value because `--cwd` has to read `process.cwd()`
 * at parse time, not at module load; the other two follow the same shape so the
 * field has one type rather than two.
 *
 * `description` is the help text. A newline in it starts a continuation line,
 * which renders hanging under the description column rather than under the
 * flag — the wrap points are chosen by hand to keep the block inside 80 columns.
 *
 * The point of the table is that a flag lives in exactly one place: teaching
 * both commands a new flag is a line here and a line in each command's list
 * below, with no else-if chain and no usage block to update in step.
 */
const FLAGS = {
  write: {
    names: ['--write'],
    key: 'write',
    type: 'boolean',
    description: 'Apply the upgrades and install (default is read-only)',
  },
  force: {
    names: ['--force'],
    key: 'force',
    type: 'boolean',
    description: 'Overwrite files you have edited locally',
  },
  json: {
    names: ['--json'],
    key: 'json',
    type: 'boolean',
    description: 'Emit the report as JSON',
  },
  failOnDrift: {
    names: ['--fail-on-drift'],
    key: 'failOnDrift',
    type: 'boolean',
    description: 'Exit 2 when the snapshot and the installed\n@elirobinson/react disagree (for CI)',
  },
  failOnOutdated: {
    names: ['--fail-on-outdated'],
    key: 'failOnOutdated',
    type: 'boolean',
    description: 'Exit 2 when anything is behind (for CI)',
  },
  // Deliberately shares no word with the artifacts command's `--fail-on-drift`,
  // which is a different disagreement entirely: the generated snapshot versus
  // the installed @elirobinson/react. A near-identical name would make a CI
  // config read as though it checked one thing when it checked the other.
  failOnOutOfSync: {
    names: ['--fail-on-out-of-sync'],
    key: 'failOnOutOfSync',
    type: 'boolean',
    description: 'Exit 2 when node_modules and the lockfile\ndisagree (for CI)',
  },
  interactive: {
    names: ['--interactive', '-i'],
    key: 'interactive',
    type: 'boolean',
    description: 'Choose per package, then apply (implies --write)',
  },
  help: {
    names: ['-h', '--help'],
    key: 'help',
    type: 'boolean',
    description: 'Show this message',
  },
  cwd: {
    names: ['--cwd'],
    key: 'cwd',
    type: 'value',
    placeholder: '<dir>',
    description: 'Target a directory other than the current one',
    parse: (value) => resolvePath(value),
    whenValueAbsent: '.',
    whenOmitted: () => process.cwd(),
  },
  only: {
    names: ['--only'],
    key: 'only',
    type: 'value',
    placeholder: '<names>',
    description: 'Restrict to these packages (comma-separated, scope optional)',
    parse: parseOnly,
    whenValueAbsent: '',
    whenOmitted: () => null,
  },
  target: {
    names: ['--target'],
    key: 'targetSpec',
    type: 'value',
    placeholder: '<spec>',
    description: `How far to jump: ${TARGETS.join(' | ')}\nGlobal ("minor") or per-package ("react=minor,tokens=latest")`,
    parse: parseTargetSpec,
    whenValueAbsent: '',
    whenOmitted: () => DEFAULT_TARGET_SPEC,
  },
};

/**
 * A flag that parses the same in both commands but describes different work.
 * `--write` applies upgrades on one and copies files on the other, so the
 * sentence differs while the names, key and defaults stay declared once.
 */
function describedAs(spec, description) {
  return { ...spec, description };
}

// The two lists are deliberately not the same set. A flag absent from a
// command's list is an unknown option there, which is the behaviour worth
// keeping: `--force` has nothing to overwrite during a version sync, and
// `--target` has no version to aim at during an artifact copy.
//
// The order is the order the flags print under `Options:`, so these lists
// decide the help text as well as the parse.
const ARTIFACTS_FLAGS = [
  describedAs(FLAGS.write, 'Apply the changes (default is read-only)'),
  FLAGS.force,
  describedAs(FLAGS.json, 'Emit the plan as JSON'),
  FLAGS.cwd,
  FLAGS.failOnDrift,
  FLAGS.help,
];

const RESYNC_FLAGS = [
  FLAGS.write,
  FLAGS.only,
  FLAGS.target,
  FLAGS.interactive,
  FLAGS.json,
  FLAGS.cwd,
  FLAGS.failOnOutdated,
  FLAGS.failOnOutOfSync,
  FLAGS.help,
];

const INDENT = '  ';

// Descriptions line up here in both commands' help, so it is one number rather
// than a width measured per block — the two blocks would otherwise drift apart
// as flags are added to one and not the other.
const DESCRIPTION_COLUMN = 24;

function flagLabel(spec) {
  const names = spec.names.join(', ');
  return spec.placeholder ? `${names} ${spec.placeholder}` : names;
}

/**
 * The `Options:` block for one command, rendered from that command's flag list.
 * Exported so the alignment rules can be tested against a spec list of their
 * own, rather than only through the two real usage strings.
 */
export function renderOptions(specs) {
  const hangingIndent = ' '.repeat(DESCRIPTION_COLUMN);

  return specs
    .map((spec) => {
      const label = `${INDENT}${flagLabel(spec)}`;
      // A flag longer than the column keeps its own line's alignment rather
      // than running into its description.
      const gap = ' '.repeat(Math.max(DESCRIPTION_COLUMN - label.length, 1));
      const [summary, ...continuation] = spec.description.split('\n');

      return [`${label}${gap}${summary}`, ...continuation.map((line) => hangingIndent + line)].join(
        '\n',
      );
    })
    .join('\n');
}

export const USAGE = `ds-resync — bring this repo's @elirobinson packages up to date

Usage: ds-resync [options]
       ds-resync artifacts [options]

Commands:
  (default)             Report and optionally apply dependency upgrades
  artifacts             Sync the design system's agent skills into this repo

Compares the versions your lockfile resolved — what CI and a fresh clone install
— against the registry, and separately reports when node_modules disagrees with
that lockfile.

Options:
${renderOptions(RESYNC_FLAGS)}

Run \`ds-resync artifacts --help\` for that command's options.
`;

export const ARTIFACTS_USAGE = `ds-resync artifacts — sync the design system's agent skills into this repo

Writes the brand skill, a version-stamped component reference (llms.txt /
llms-full.txt), and the re-sync instructions into .claude/skills/. Files you have
edited since they were written are left alone and listed in the report.

Usage: ds-resync artifacts [options]

Options:
${renderOptions(ARTIFACTS_FLAGS)}
`;

function parseFlags(argv, specs) {
  const args = {};
  const byName = new Map();

  for (const spec of specs) {
    args[spec.key] = spec.type === 'boolean' ? false : spec.whenOmitted();
    for (const name of spec.names) byName.set(name, spec);
  }

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const equalsIndex = argument.indexOf('=');
    const spec = byName.get(equalsIndex === -1 ? argument : argument.slice(0, equalsIndex));

    // An `=` only means something to a flag that takes a value, so `--write=1`
    // stays an unknown option rather than quietly reading as true.
    if (!spec || (spec.type === 'boolean' && equalsIndex !== -1)) {
      throw new Error(`Unknown option: ${argument}`);
    }

    if (spec.type === 'boolean') {
      args[spec.key] = true;
      continue;
    }

    let value;
    if (equalsIndex === -1) {
      index += 1;
      value = argv[index];
    } else {
      value = argument.slice(equalsIndex + 1);
    }

    args[spec.key] = spec.parse(value ?? spec.whenValueAbsent);
  }

  return args;
}

export function parseArtifactsArgs(argv) {
  return parseFlags(argv, ARTIFACTS_FLAGS);
}

export function parseArgs(argv) {
  const args = parseFlags(argv, RESYNC_FLAGS);

  // Asking which packages to update and then not updating them is not a
  // meaningful mode, so the interactive flag carries the write intent.
  if (args.interactive) args.write = true;

  return args;
}
