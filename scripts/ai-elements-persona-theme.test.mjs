// @vitest-environment jsdom
/* The vendored Persona's theme, run (#442, #444).
 *
 * ai-elements-layer.test.mjs pins the patched text. This file runs it: the
 * real vendored persona.tsx, rendered in jsdom, with only the Rive library
 * stubbed (it needs WebGL2). The stub's `useRive` hands back a real <canvas>
 * in the page, the same way the real hook does, and its colour hook records
 * every `setRgb` call. So a test reads the colour Persona would paint:
 * white (255) in dark, black (0) in light.
 *
 * The rule under test is the design system's: an element is dark when it or
 * an ancestor has data-theme="dark" or .dark (tokens.css, palettes.css, the
 * `dark:` variant in tailwind.css). No `data-theme` value resets a subtree to light.
 */

import { createRequire } from 'node:module';
import { join } from 'node:path';

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

// jsdom gives import.meta.url an http: scheme, so build the path from dirname.
const personaPath = join(import.meta.dirname, '../packages/ai-elements/src/components/persona.tsx');
const fromPersona = createRequire(personaPath);
const React = fromPersona('react');
const { act } = React;
const { createRoot } = fromPersona('react-dom/client');

let Persona;
let lastRgb = [];

beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.doMock(fromPersona.resolve('@rive-app/react-webgl2'), () => ({
    useRive: () => {
      const [canvas, setCanvas] = React.useState(null);
      const RiveComponent = React.useCallback(
        (props) => React.createElement('canvas', { ...props, ref: setCanvas }),
        [],
      );
      return { canvas, rive: {}, RiveComponent };
    },
    useStateMachineInput: () => null,
    useViewModel: () => ({}),
    useViewModelInstance: () => ({}),
    useViewModelInstanceColor: () =>
      React.useMemo(() => ({ setRgb: (...rgb) => (lastRgb = rgb) }), []),
  }));
  ({ Persona } = await import(personaPath));
});

const mounted = [];

afterEach(() => {
  for (const { root, host } of mounted.splice(0)) {
    act(() => root.unmount());
    host.remove();
  }
  // Themed panels a test appended must not leak into the next test.
  document.body.replaceChildren();
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.className = '';
  document.body.removeAttribute('data-theme');
  lastRgb = [];
});

/** Render a Persona into `host`, attached to `parent`, and flush its first frame. */
async function render(host, parent = document.body) {
  parent.append(host);
  const root = createRoot(host);
  mounted.push({ root, host });
  await act(async () => {
    root.render(React.createElement(Persona, { state: 'idle' }));
  });
  // useStrictModeSafeInit waits one animation frame before Rive starts.
  await act(() => new Promise((resolve) => requestAnimationFrame(resolve)));
}

const panel = (attrs = {}) => {
  const el = document.createElement('div');
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  return el;
};

const colour = () => (lastRgb[0] === 255 ? 'dark' : lastRgb[0] === 0 ? 'light' : 'unset');

describe('the vendored Persona picks its colour from its nearest dark ancestor', () => {
  it('draws dark inside a data-theme="dark" panel on a light page', async () => {
    await render(panel(), document.body.appendChild(panel({ 'data-theme': 'dark' })));
    expect(colour()).toBe('dark');
  });

  it('draws light beside that panel, on the same light page', async () => {
    document.body.append(panel({ 'data-theme': 'dark' }));
    await render(panel());
    expect(colour()).toBe('light');
  });

  it('draws dark inside a .dark panel', async () => {
    await render(panel(), document.body.appendChild(panel({ class: 'dark' })));
    expect(colour()).toBe('dark');
  });

  it('draws dark when the app puts data-theme on <body>', async () => {
    document.body.setAttribute('data-theme', 'dark');
    await render(panel());
    expect(colour()).toBe('dark');
  });

  it('still draws dark when <html> is dark, as before #444', async () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    await render(panel());
    expect(colour()).toBe('dark');
  });

  it('draws dark in a data-theme="light" panel on a dark page, as the CSS does', async () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    await render(panel(), document.body.appendChild(panel({ 'data-theme': 'light' })));
    expect(colour()).toBe('dark');
  });

  it('does not follow the OS when nothing is themed', async () => {
    window.matchMedia = () => ({
      matches: true,
      addEventListener() {},
      removeEventListener() {},
    });
    try {
      await render(panel());
      expect(colour()).toBe('light');
    } finally {
      delete window.matchMedia;
    }
  });
});

describe('the vendored Persona follows a runtime change of its ancestor', () => {
  it('turns dark, then light, as a panel switches data-theme', async () => {
    const themed = document.body.appendChild(panel({ 'data-theme': 'light' }));
    await render(panel(), themed);
    expect(colour()).toBe('light');

    await act(async () => themed.setAttribute('data-theme', 'dark'));
    expect(colour()).toBe('dark');

    await act(async () => themed.setAttribute('data-theme', 'light'));
    expect(colour()).toBe('light');
  });

  it('turns dark, then light, as a panel gains and loses .dark', async () => {
    const themed = document.body.appendChild(panel());
    await render(panel(), themed);
    expect(colour()).toBe('light');

    await act(async () => themed.classList.add('dark'));
    expect(colour()).toBe('dark');

    await act(async () => themed.classList.remove('dark'));
    expect(colour()).toBe('light');
  });

  it('keeps reading its panel, not <html>, when the OS theme changes', async () => {
    let fireChange = () => {};
    window.matchMedia = () => ({
      matches: false,
      addEventListener: (_type, listener) => (fireChange = listener),
      removeEventListener() {},
    });
    try {
      await render(panel(), document.body.appendChild(panel({ 'data-theme': 'dark' })));
      expect(colour()).toBe('dark');

      await act(async () => fireChange());
      expect(colour()).toBe('dark');
    } finally {
      delete window.matchMedia;
    }
  });

  it('follows <html> switching too', async () => {
    await render(panel());
    expect(colour()).toBe('light');

    await act(async () => document.documentElement.setAttribute('data-theme', 'dark'));
    expect(colour()).toBe('dark');
  });
});
