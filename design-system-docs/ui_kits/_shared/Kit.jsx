/* global window, document, URL, URLSearchParams, React, KIT_CONTENT -- a browser script: it reads the real
   components from window.DesignSystem (ds-bundle.js, loaded first) and its strings from
   _shared/content.js, and publishes the kit chrome onto window for the kit files loaded
   after it. See any kit's index.html. */
/*
 * What every kit shares: the bar that sets the theme and the palette, and the wordmark.
 * Everything else a kit draws is a real @elirobinson/react component from the bundle.
 *
 * The theme and palette live on <html>, so overlays that portal to <body> (menus,
 * tooltips, the command palette) follow them. They also live in the query string,
 * `?theme=dark&palette=steady`, so a link or a screenshot can ask for one.
 */

const { SegmentedControl } = window.DesignSystem;
const chrome = KIT_CONTENT.chrome;

/* The palettes the loaded stylesheets declare, read from their [data-palette] selectors,
   so a palette added to the tokens shows up here with no edit. */
function palettesInStylesheets() {
  const found = new Set();
  const walk = (rules) => {
    for (const rule of rules) {
      if (rule.styleSheet) walk(readRules(rule.styleSheet));
      if (rule.cssRules) walk(rule.cssRules);
      for (const match of (rule.selectorText || '').matchAll(/\[data-palette=['"]?([\w-]+)/g)) {
        found.add(match[1]);
      }
    }
  };
  for (const sheet of document.styleSheets) walk(readRules(sheet));
  return [...found];
}

function readRules(sheet) {
  try {
    return sheet.cssRules;
  } catch {
    return [];
  }
}

const DEFAULT_PALETTE = '';
const capitalise = (word) => word.charAt(0).toUpperCase() + word.slice(1);

function useKitSettings() {
  const params = new URLSearchParams(window.location.search);
  const [theme, setTheme] = React.useState(params.get('theme') || 'light');
  const [palette, setPalette] = React.useState(params.get('palette') || DEFAULT_PALETTE);

  React.useLayoutEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    if (palette) root.setAttribute('data-palette', palette);
    else root.removeAttribute('data-palette');

    const url = new URL(window.location.href);
    url.searchParams.set('theme', theme);
    if (palette) url.searchParams.set('palette', palette);
    else url.searchParams.delete('palette');
    window.history.replaceState(null, '', url);
  }, [theme, palette]);

  return { theme, setTheme, palette, setPalette };
}

function KitBar({ title }) {
  const { theme, setTheme, palette, setPalette } = useKitSettings();
  const [palettes, setPalettes] = React.useState([]);
  React.useEffect(() => setPalettes(palettesInStylesheets()), []);
  const paletteOptions = [
    { label: chrome.defaultPalette, value: DEFAULT_PALETTE },
    ...palettes.map((name) => ({ label: capitalise(name.replace(/-/g, ' ')), value: name })),
  ];

  return (
    <div
      role="region"
      aria-label={chrome.label}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--space-3)',
        padding: 'var(--space-2) var(--space-4)',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-subtle)',
        color: 'var(--fg)',
      }}
    >
      <span className="t-eyebrow" style={{ color: 'var(--fg-2)' }}>
        {title}
      </span>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-4)' }}>
        <SegmentedControl
          aria-label={chrome.theme}
          options={chrome.themes}
          value={theme}
          onValueChange={setTheme}
        />
        <SegmentedControl
          aria-label={chrome.palette}
          options={paletteOptions}
          value={palette}
          onValueChange={setPalette}
        />
      </div>
    </div>
  );
}

function Wordmark({ className = 't-h5' }) {
  return (
    <span className={className} style={{ display: 'inline-flex', alignItems: 'baseline', margin: 0, color: 'inherit' }}>
      {KIT_CONTENT.brand.wordmark}
      <span style={{ color: 'var(--accent)' }}>.</span>
    </span>
  );
}

Object.assign(window, { KitBar, Wordmark });
