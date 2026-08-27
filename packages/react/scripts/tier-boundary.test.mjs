/* The boundary rule in docs/agents/components.md, enforced instead of written.
 *
 *   > if a component renders into a portal, traps focus, or manages open/closed
 *   > state across multiple sub-elements, it's an organism. If it's assembled
 *   > from 2+ atoms with no such orchestration, it's a molecule.
 *
 * The rule's whole value is that it is mechanical — you apply it, you do not
 * argue it. A directory that quietly stops matching it turns the rule back into
 * a preference, and the tier is the published import path, so correcting one
 * afterwards costs a major. `DecisionCard` sat in `organisms/` from #88 until
 * #141 for exactly that reason: nothing checked, so nothing noticed.
 *
 * This is the check. Every component under organisms/ must either orchestrate
 * itself, or compose something that does.
 *
 * Two decisions in here are worth defending, because both are the difference
 * between a sweep that asserts something and one that passes vacuously:
 *
 *   Orchestration is read as a marker set, not as "has hooks". `useMemo` and
 *   `useCallback` are absent from ORCHESTRATION deliberately — memoising a
 *   value is not state held across sub-elements, and a component whose only
 *   hook is `useMemo` is a molecule that caches. The set below is the one the
 *   rule actually names (portal, focus, open/closed state, identity wiring),
 *   and every current organism clears it without them.
 *
 *   Composition follows imports into src/components and src/hooks only.
 *   `src/lib` is excluded on purpose: it is stateless plumbing every tier
 *   imports, and `useMergedRef`/`useLatest` do hold refs and effects. Count
 *   those as orchestration and `import { cn } from '../../lib/cn.js'` — which
 *   is in every component in the package — drags `lib/useLatest.ts` in behind
 *   it and the sweep passes on everything forever. A hook under `src/hooks`
 *   IS a real edge: `useDisclosure` is open/closed state, `useEscapeKey` and
 *   `useClickOutside` are dismissal, `useRovingFocus` is focus management.
 *
 * The two cases the rule was argued over are pinned by name below, one on each
 * side of the composition branch.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const srcDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const componentsDir = join(srcDir, 'components');
const organismsDir = join(componentsDir, 'organisms');
const hooksDir = join(srcDir, 'hooks');

/* What the boundary rule names, spelled as the things React makes you write to
   do it. `createPortal` is the portal; `useId` is the aria wiring that spans
   sub-elements; the rest is state held across a render boundary. */
const ORCHESTRATION = [
  'createPortal',
  'useState',
  'useReducer',
  'useRef',
  'useEffect',
  'useLayoutEffect',
  'useImperativeHandle',
  'useSyncExternalStore',
  'useContext',
  'useId',
];

/** Source files that are implementation, not tests. */
function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    if (!/\.tsx?$/.test(entry.name)) return [];
    if (/\.test\.tsx?$/.test(entry.name)) return [];
    return [path];
  });
}

/* Comments are stripped before matching, so the sweep cannot be satisfied — or
   tripped — by a file that merely mentions a hook in prose. DecisionCard's
   footer-guarantee comment is several paragraphs long. */
function code(path) {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

function orchestratesDirectly(path) {
  const text = code(path);
  return ORCHESTRATION.filter((marker) => new RegExp(`\\b${marker}\\b`).test(text));
}

/** Relative imports of this file that resolve into src/components or src/hooks. */
function compositionEdges(path) {
  const specifiers = [...code(path).matchAll(/from\s+'(\.[^']*)'/g)].map((match) => match[1]);

  return specifiers.flatMap((specifier) => {
    const base = resolve(dirname(path), specifier).replace(/\.js$/, '');
    const target = ['.tsx', '.ts'].map((ext) => `${base}${ext}`).find((file) => existsSync(file));
    if (!target) return [];
    if (!target.startsWith(componentsDir) && !target.startsWith(hooksDir)) return [];
    return [target];
  });
}

/** The first module in this file's composition closure that orchestrates, or null. */
function orchestratingDependency(path) {
  const seen = new Set([path]);
  const queue = compositionEdges(path);

  while (queue.length > 0) {
    const next = queue.shift();
    if (seen.has(next)) continue;
    seen.add(next);
    if (orchestratesDirectly(next).length > 0) return next;
    queue.push(...compositionEdges(next));
  }

  return null;
}

const ORGANISMS = sourceFiles(organismsDir);
const label = (path) => relative(componentsDir, path);

it('finds the organisms it is supposed to be checking', () => {
  const names = ORGANISMS.map(label);
  expect(names.length).toBeGreaterThan(10);
  expect(names).toContain('organisms/Dialog.tsx');
  expect(names).toContain('organisms/VirtualTable.tsx');
});

it('every organism orchestrates, or composes something that does', () => {
  const misplaced = ORGANISMS.filter(
    (path) => orchestratesDirectly(path).length === 0 && orchestratingDependency(path) === null,
  ).map(label);

  // A name here is a component that the boundary rule in
  // docs/agents/components.md calls a molecule. Move it to molecules/ rather
  // than adding it to an exemption list — the tier is the import path, so the
  // cost of the move only goes up.
  expect(misplaced).toEqual([]);
});

describe('the two cases the rule was argued over', () => {
  it('VirtualTable qualifies through what it composes, not through its own hooks', () => {
    const path = join(organismsDir, 'VirtualTable.tsx');

    expect(orchestratesDirectly(path)).toEqual([]);
    expect(orchestratingDependency(path)).not.toBeNull();
  });

  it('DecisionCard is a molecule: nothing it renders or composes orchestrates', () => {
    const path = join(componentsDir, 'molecules', 'DecisionCard.tsx');

    expect(existsSync(path)).toBe(true);
    expect(orchestratesDirectly(path)).toEqual([]);
    expect(orchestratingDependency(path)).toBeNull();
  });
});
