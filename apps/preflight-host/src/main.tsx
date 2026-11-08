import { type ComponentType, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './app.css';
import { PREFLIGHT_CASES, type PreflightCaseId, caseQuery } from './cases';
import { FontOverrideCase, FormControlsCase, LinkColourCase, TypeColourCase } from './cases/inline';
import { CommandPaletteCase, DialogCase } from './cases/overlays';

/* A Record, so a case added to cases.ts without a component here is a type
   error rather than a page that renders nothing. */
const COMPONENTS: Record<PreflightCaseId, ComponentType> = {
  dialog: DialogCase,
  'command-palette': CommandPaletteCase,
  'form-controls': FormControlsCase,
  'link-colour': LinkColourCase,
  'type-colour': TypeColourCase,
  'font-override': FontOverrideCase,
};

/* One case per page load, chosen by `?case=`. One at a time because a modal
   case owns the whole viewport, and because a layout check should measure the
   component under test, not its neighbours. */
const requested = new URLSearchParams(window.location.search).get('case');
const known = PREFLIGHT_CASES.find((entry) => entry.id === requested);

if (known && 'palette' in known) {
  document.documentElement.dataset.palette = known.palette;
}

function App() {
  /* No case: an index, so a person opening the host can find the cases. */
  if (requested === null) {
    return (
      <main className="grid gap-2 p-8">
        {PREFLIGHT_CASES.map((entry) => (
          <a key={entry.id} href={caseQuery(entry.id)}>
            {entry.id}
          </a>
        ))}
      </main>
    );
  }

  /* An unknown case says so out loud. The spec asserts on this attribute
     before anything else, so a typo cannot pass as an empty, clean page. */
  if (!known) {
    return (
      <main data-case-error={requested} className="p-8">
        No case named &quot;{requested}&quot;.
      </main>
    );
  }

  const Case = COMPONENTS[known.id];
  return (
    <main data-case={known.id} className="p-8">
      <Case />
    </main>
  );
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
