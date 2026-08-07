## [3.0.0](https://github.com/EliRobinson/design-system/compare/v2.0.0...v3.0.0) (2026-08-07)

### ⚠ BREAKING CHANGES

- **react:** `@elirobinson/react/hooks/useDsForm` is removed, as is the
  `@tanstack/react-form` dependency.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

- **react:** `<Table virtualize>` is now `<VirtualTable>`, and its
  `virtualizeHeight` prop is `height`.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

- **react:** VirtualList's ref resolves to VirtualListHandle rather than
  HTMLDivElement.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

### Features

- **react:** add Accordion organism ([ca86d2f](https://github.com/EliRobinson/design-system/commit/ca86d2f154367663991e5b5c0ef8a85dc479f65d))
- **react:** add Chip molecule ([ba00bf9](https://github.com/EliRobinson/design-system/commit/ba00bf906e8c2fc05f566ab62a944bf3b9bc7807))
- **react:** add Combobox organism with virtualized listbox ([dc78f00](https://github.com/EliRobinson/design-system/commit/dc78f0050b1a7db5cfeeae9e0bb20e07efab6931))
- **react:** add CommandPalette organism ([f1fb3f3](https://github.com/EliRobinson/design-system/commit/f1fb3f34d2eab20efd73c35f58af2b24095b197c))
- **react:** add DatePicker organism ([dea917d](https://github.com/EliRobinson/design-system/commit/dea917ddd70e315b0ef06352b44ac1ae01ea516f))
- **react:** add EmptyState molecule ([eaafde3](https://github.com/EliRobinson/design-system/commit/eaafde3089e73ac96db57d4c50a965bc904ac07c))
- **react:** add FormField molecule ([e6c608e](https://github.com/EliRobinson/design-system/commit/e6c608e1dee9014437fb65284ead96ce3088c2a2))
- **react:** add Kbd atom ([adaf153](https://github.com/EliRobinson/design-system/commit/adaf1537e7f9c6ba92a1133656774dbaeeeae248))
- **react:** add NavigationMenu organism ([d94cea7](https://github.com/EliRobinson/design-system/commit/d94cea73ead93dde25189a89f10796c4b3bf498a))
- **react:** add Pagination molecule ([f17fe91](https://github.com/EliRobinson/design-system/commit/f17fe916280888547e2e67b67fe1cbebb4f76c81))
- **react:** add RadioGroup atom ([659f346](https://github.com/EliRobinson/design-system/commit/659f346746fad8dbaa8c0ed39bd5ad88024b2498))
- **react:** add Rating molecule ([e5bca33](https://github.com/EliRobinson/design-system/commit/e5bca33e6d0e57b14f8628deed748b967307df57))
- **react:** add SearchField molecule ([39527a7](https://github.com/EliRobinson/design-system/commit/39527a79336220964b9c214bf4cc3739d39bedc7))
- **react:** add SegmentedControl molecule ([23415a0](https://github.com/EliRobinson/design-system/commit/23415a0e30a847f49ea260bab7a641b66d737a76))
- **react:** add Slider atom ([4ccf374](https://github.com/EliRobinson/design-system/commit/4ccf3741341d991077b5ad7ba683e8c5a624efbe))
- **react:** add Spinner atom ([57509a8](https://github.com/EliRobinson/design-system/commit/57509a8961fb75ab38b7950449fca28afe0a03bb))
- **react:** add Stepper molecule ([9e52fd4](https://github.com/EliRobinson/design-system/commit/9e52fd413cc2dcbea3cd0c5afd827876cc1f5cc9))
- **react:** add Table organism backed by @tanstack/react-table ([19a3b5e](https://github.com/EliRobinson/design-system/commit/19a3b5e2c832e97569afd2454fcb7a714f33927d))
- **react:** add useDsForm hook backed by @tanstack/react-form ([5d99e9c](https://github.com/EliRobinson/design-system/commit/5d99e9c74934dcef70fe7f2cbf106f34688546ea))
- **react:** add VirtualList organism backed by @tanstack/react-virtual ([c7c4ea1](https://github.com/EliRobinson/design-system/commit/c7c4ea180bfaf08c24b5207080676a836b0f4e4d))
- **react:** expose scrollToIndex on VirtualList's ref handle ([9c4c77f](https://github.com/EliRobinson/design-system/commit/9c4c77fab7943906c7911de0bad855a652813b93))

### Bug Fixes

- correct changeset migration path, DatePicker month sync/selection, CommandPalette prop rename and index clamp ([4e772e6](https://github.com/EliRobinson/design-system/commit/4e772e6fe9cd684dcbfaacb7b95d9ef4fadcc879))
- **react:** add arrow-key navigation to Tabs ([5f20666](https://github.com/EliRobinson/design-system/commit/5f20666fc442f31ff5ae39c1f327e1ec0c6113cf))
- **react:** add Firefox support to Slider and make label required ([52bd2af](https://github.com/EliRobinson/design-system/commit/52bd2afa8685eb7e23eeac8107db6413a378df9c))
- **react:** clamp Pagination nav to the valid page range ([5902506](https://github.com/EliRobinson/design-system/commit/5902506000aa48d0f9afd5b0342973ae0ac403b3))
- **react:** clamp Table's pageIndex when a shrinking data set outranges it ([a623ffc](https://github.com/EliRobinson/design-system/commit/a623ffcdfada2a058743d182874c420158339427))
- **react:** convey Rating's current value and clamp out-of-range labels ([bcab726](https://github.com/EliRobinson/design-system/commit/bcab726db9a23b8ae91ce9bb14ac50138674d15c))
- **react:** give Tabs exactly one tab stop; extract useRovingFocus ([d0acc3d](https://github.com/EliRobinson/design-system/commit/d0acc3d4668df7baa58eda18c18db64e85f396a6))
- **react:** grow Chip container to 44px instead of overlaying negative-inset hit area ([2310e2d](https://github.com/EliRobinson/design-system/commit/2310e2d590a75d134ff5232ca58441cd79f16846))
- **react:** keep tablist keyboard-reachable when active trigger is disabled ([3769b62](https://github.com/EliRobinson/design-system/commit/3769b627c21d26da662f60fceefa7811fe155643))
- **react:** pin @tanstack/react-table to ^8, drop the v9 legacy shim ([854ca8e](https://github.com/EliRobinson/design-system/commit/854ca8ed95b00a0d4c26242c4a2626e81c2133b0))
- **react:** protect Accordion's computed props and guard headingLevel ([be2c332](https://github.com/EliRobinson/design-system/commit/be2c332752ea5c4ac0a79210c7ee6b1a1d17d7d3))
- **react:** retarget Chip to the MUI/shadcn chip pattern, superseding the 44px rule ([2e2148c](https://github.com/EliRobinson/design-system/commit/2e2148ce86890ce5d6c45f2fc4c91ba13ed4d567))
- **react:** stretch + negative block margin for Chip remove button hit area ([f8229ac](https://github.com/EliRobinson/design-system/commit/f8229ac9ba4f802813cd7490c1e4b3ad6f90f914))
- **react:** suppress native search-cancel button and restore focus on SearchField clear ([4fe72ab](https://github.com/EliRobinson/design-system/commit/4fe72ab77ec5543ac5144c17f86d328892300162))
- **react:** type-protect role on RadioGroupProps ([64bb063](https://github.com/EliRobinson/design-system/commit/64bb063e071ba37dda17962e0f5c97763fe06d2e))
- **react:** use explicit height:44px + align-self:center on Chip remove button ([3c1c94c](https://github.com/EliRobinson/design-system/commit/3c1c94cbc4b9b787b8704e61c3905a33097572be))
- **react:** wire aria-required through FormField's render-prop bundle ([84b91ec](https://github.com/EliRobinson/design-system/commit/84b91eca71bce442b65387290c58a1faed477f31))

### Miscellaneous Chores

- **react:** drop the useDsForm wrapper, add per-component style exports ([1a94a60](https://github.com/EliRobinson/design-system/commit/1a94a605b53d7479096360463d5981868aa0ff1c))

### Code Refactoring

- **react:** split Table into paginated Table and windowed VirtualTable ([8c4a27e](https://github.com/EliRobinson/design-system/commit/8c4a27eb183e85ec665999a52947f099f8200cf8))

## [2.0.0](https://github.com/EliRobinson/design-system/compare/v1.3.0...v2.0.0) (2026-06-15)

### ⚠ BREAKING CHANGES

- replace package barrel exports with subpath imports

### Bug Fixes

- **ci:** prevent duplicate changeset publish on release ([aba1f8b](https://github.com/EliRobinson/design-system/commit/aba1f8b49b201cf5d8b0a89206b034485b68c2ba))

### Code Refactoring

- replace package barrel exports with subpath imports ([52b1b6d](https://github.com/EliRobinson/design-system/commit/52b1b6dca530fb79ccb3adb722b3c258e84ef065))

## [1.3.0](https://github.com/EliRobinson/design-system/compare/v1.2.1...v1.3.0) (2026-06-15)

### Features

- **react:** overlay primitives, marketing typography, and tests ([#3](https://github.com/EliRobinson/design-system/issues/3)) ([5fcffbf](https://github.com/EliRobinson/design-system/commit/5fcffbfcc41f5b449476c32157b7a4bc98445f08))

## [1.2.1](https://github.com/EliRobinson/design-system/compare/v1.2.0...v1.2.1) (2026-06-15)

### Bug Fixes

- **ci:** publish npm packages after Version Packages PR merge ([7b96659](https://github.com/EliRobinson/design-system/commit/7b96659a2227443a14ce9889fbc91450009c80b4))

## [1.2.0](https://github.com/EliRobinson/design-system/compare/v1.1.1...v1.2.0) (2026-06-15)

### Features

- **react:** expand component library with token-styled shadcn patterns ([c019e9e](https://github.com/EliRobinson/design-system/commit/c019e9e04f31cbd1f4cc0609bca09217870ebff8))

## [1.1.1](https://github.com/EliRobinson/design-system/compare/v1.1.0...v1.1.1) (2026-06-15)

### Bug Fixes

- **ci:** sync pnpm-lock.yaml after tokens 0.1.1 release bump ([b09d7a0](https://github.com/EliRobinson/design-system/commit/b09d7a02e96b3d3c3438d60799857ba7a58af61c))
- **release:** exclude create CLI from npm publish ([a79568f](https://github.com/EliRobinson/design-system/commit/a79568f4a6e5cd62a6ee5a79851e602f92e73632))

## [1.1.0](https://github.com/EliRobinson/design-system/compare/v1.0.0...v1.1.0) (2026-06-15)

### Features

- **release:** publish [@elirobinson](https://github.com/elirobinson) packages to GitHub Packages ([60e0c53](https://github.com/EliRobinson/design-system/commit/60e0c5374fecf1e83fb93487f1b7883d7819f666))

## 1.0.0 (2026-04-27)

### Features

- add scoped publishing, releases, and Storybook ([3873d1a](https://github.com/EliRobinson/design-system/commit/3873d1a9c3eb3966b5b3f4f0ed036ce96b242dcf))
- adopt pnpm tooling and Next.js consumer automation ([98dbff9](https://github.com/EliRobinson/design-system/commit/98dbff94cfbbfec0e49afb7c6f9a3748a3dfd914))
- bootstrap Nx design system monorepo ([75320ca](https://github.com/EliRobinson/design-system/commit/75320ca85e80d440891d39b012d529aa3a036254))
- include agent guidance files in generated Next.js apps ([f75342b](https://github.com/EliRobinson/design-system/commit/f75342bf9a6f4176c5b583b2e5ef3451588016df))

### Bug Fixes

- **ci:** configure dual registry auth for changesets publish ([a008acb](https://github.com/EliRobinson/design-system/commit/a008acb0b0d9715cba7cc0c692417d369b8f5684))
- **ci:** resolve pnpm setup order in release workflow ([9008e98](https://github.com/EliRobinson/design-system/commit/9008e986d14320802ddf93ac233ad503ef4ba002))

# Changelog

All notable changes to this repository are tracked here.
