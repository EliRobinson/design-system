import { createInterface } from 'node:readline';
import { selectTarget } from './semver.mjs';
import { TARGETS } from './targets.mjs';

/**
 * Walks the outdated packages, asking whether to take each and how far. Reads
 * from an injected channel rather than process.stdin so the walk is testable
 * without a TTY.
 */
export async function promptSelections(entries, { input, output }) {
  const reader = createInterface({ input, terminal: false });
  const lines = reader[Symbol.asyncIterator]();

  async function ask(question) {
    output.write(question);
    const { value, done } = await lines.next();
    if (done) throw new Error('ds-resync: interactive selection cancelled');
    return String(value).trim();
  }

  const only = [];
  const byName = {};

  try {
    for (const entry of entries) {
      const latest = selectTarget(entry.reference, entry.versions, 'latest');
      // Nothing newer exists, so there is nothing to decide.
      if (latest === null || latest === entry.reference) continue;

      const answer = await ask(`Update ${entry.name} ${entry.reference} → ${latest}? [y/N] `);
      if (!/^y(es)?$/i.test(answer)) continue;

      let target = null;
      while (target === null) {
        const choice = await ask(`  How far? [${TARGETS.join('/')}] (latest) `);
        if (choice === '') target = 'latest';
        else if (TARGETS.includes(choice)) target = choice;
        else output.write(`  Not a target. Choose one of: ${TARGETS.join(', ')}\n`);
      }

      only.push(entry.name);
      byName[entry.name] = target;
    }
  } finally {
    reader.close();
  }

  return { only, targetSpec: { fallback: 'latest', byName } };
}
