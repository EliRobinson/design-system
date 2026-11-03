# Design System artifact

The Claude "Design System" artifact is where Claude reads the brand:
<https://claude.ai/artifact/Xvkzcg7hpZRPBZ5ijZcTL1>. Its files live under `project/`.

`pnpm -F @elirobinson/ai-patterns build:design-system-artifact` rebuilds the files the repo
owns. You publish them with the Artifact tool. Nothing publishes automatically.

## Who owns which file

One owner per file. Never edit a file on both sides.

| The repo builds these                     | The artifact owns these                                   |
| ----------------------------------------- | --------------------------------------------------------- |
| `tokens.json`, `tokens.css`               | `README.md`, `accessibility.md`, `handoff/`, `patterns/`  |
| `components/bundle.js`                    | `components/<Comp>/README.md` and `preview.html`          |
| `components/bundle.css`                   | `ui_kits/`, `templates/`, `slides/`, `guidelines/`        |
| `components/index.d.ts`                   | `components/src/**` (incl. the two artifact-only sources) |
| `components/<Comp>/<Comp>.d.ts`           | `assets/`, `design-system.json`, `SKILL.md`               |
| `fonts/geist-…`, `fonts/jetbrains-mono-…` |                                                           |

Three things the repo builds are read back from the artifact, so a rebuild never drops what
was written on the page:

- **Token usage notes and type style notes**, from the live `tokens.json`. A token that is new
  in the repo gets an empty note. The build lists it. Write its note on the page.
- **`ChatComposer` and `PromptSuggestions`.** They exist only in the artifact. The bundle
  builds them from `components/src/components/ai/*.jsx`. Their CSS and types are carried from
  the live `bundle.css` and `index.d.ts`, found by their `/* ── … ── */` and `// ── …` markers.
- **Family membership and order** in `tokens.json`, so the page sections do not move.

## Themes

The artifact holds 8 colour themes at most. The repo has 5 palettes, each light and dark. Slate
is left out. The 8 ids, in order: `light` and `dark` (ember), `palette-miltinson`,
`palette-miltinson-dark`, `palette-miltinson-tech`, `palette-miltinson-tech-dark`,
`palette-steady`, `palette-steady-dark`. `bundle.css` still carries every scoped
`[data-palette]` block from `palettes.css`, slate too, so a preview can show one with
`data-palette` on an element.

## Rebuild and publish

1. Work from an up-to-date `main`. The build stamps `<branch>@<sha>` into `tokens.json`, and it
   runs `pnpm nx run react:build` itself, because the bundle and the types come from react's
   `dist/`.

2. Read the live inputs with the Artifact tool: `action: "read"`, the artifact URL above,
   `out_dir` set to a scratch folder, and these `paths`:

   ```json
   [
     "project/tokens.json",
     "project/components/bundle.css",
     "project/components/index.d.ts",
     "project/components/src/components/ai/ChatComposer.jsx",
     "project/components/src/components/ai/PromptSuggestions.jsx"
   ]
   ```

   This read also lets you publish to the artifact later in the same session.

3. Build. Pass the `project/` folder the read wrote. A relative path is read from the folder
   you run the command in.

   ```bash
   pnpm -F @elirobinson/ai-patterns build:design-system-artifact --previous <scratch>/project
   ```

   It writes `dist/design-system-artifact/project/` at the repo root (gitignored, published by
   no package) and `dist/design-system-artifact/publish-files.json`. It fails if any file breaks
   an artifact cap (8 themes, 512 KB `tokens.json`, 6 MB `bundle.js`, 2 MB `bundle.css`,
   255 paths per publish). It writes only `project/` and `publish-files.json` under `--out`,
   and refuses an `--out` that would delete the `--previous` copy.

4. Read the report it prints. "New tokens with no usage note yet" and "in the repo but not in
   tokens.json" are for you to handle on the page. "Kept from the artifact" names tokens the
   artifact has and the repo no longer declares: ask Eli before you remove one. "Colours dropped
   from the artifact" names colours the repo removed: find the previews and kits that use them
   before you publish.

5. Publish the files: `action: "publish"`, the artifact URL as `url`, and the contents of
   `publish-files.json` as `files`. Every `.js` and `.ts` entry already carries
   `contentType: "text/plain"`.

6. Publish `project/design-system.json` last, in its own call. Read the live one again first,
   change only `lastChange`, and keep every other key:

   ```json
   {
     "by": "Eli",
     "at": "<now, ISO-8601>",
     "via": "GitHub · EliRobinson/design-system@<short sha>",
     "note": "re-synced to <short sha>: <what changed>"
   }
   ```

Check the result in the artifact: Overview, Colors (all 8 themes), Typography and a few
component previews.

## The old Claude Design project

`build:design-project` targets the standalone Claude Design project `e160cbb7…`, which closes on
2026-12-14. It still runs because it also writes the repo's own `design-system-docs/styles.css`
and the generated `guidelines/` cards. Its push bundle (`dist/design-project/`) feeds nothing
once that project closes. Its push half is retired by #281 after that date.
