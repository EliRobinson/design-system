---
---

Empty on purpose — no published file changes.

`packages/tokens/project.json` and `packages/ai-patterns/project.json` gain
`outputs` and input declarations so the Nx cache restores what those builds
actually write. Both are CI configuration; neither package's shipped contents,
exports, or types move. A patch here would cut a release containing nothing.

The changeset gate keys on directories under `packages/`, not on whether the
diff reaches a tarball, so this file is what makes `changeset status` pass.
