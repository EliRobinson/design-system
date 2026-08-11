/* The types for dist/manifest.json, copied there verbatim as manifest.d.ts by
   generate-manifest.mjs so that `@elirobinson/react/manifest` is a typed import
   rather than an `any`.

   It is written by hand because the manifest is JSON — there is no source
   module for tsc to emit declarations from, so nothing infers this from the
   builder. What keeps the two in step is a test: manifest.test.mjs reads the
   members declared here and asserts they are exactly the keys buildManifest()
   emits, so adding a field to one without the other fails. */

/** One prop, as resolved by react-docgen-typescript. */
export type PropRecord = {
  name: string;
  /** Rendered type, with literal unions expanded: `"sm" | "md" | "lg"`. */
  type: string;
  required: boolean;
  defaultValue: string | null;
  description: string;
};

/** A compound part exported alongside its component, e.g. `CardHeader`. */
export type SubComponentRecord = {
  name: string;
  description: string;
  inherits: string | null;
  props: PropRecord[];
};

/** A prop whose type is a union of literals. */
export type VariantRecord = {
  prop: string;
  /** The exported alias standing for the union, when it has one. */
  type: string | null;
  values: (string | number)[];
};

/** A hook declared in a component's own file, e.g. `useToast` in Toast.tsx. */
export type DeclaredHook = {
  name: string;
  description: string;
};

export type ComponentRecord = {
  name: string;
  /** URL-safe name: `SegmentedControl` -> `segmented-control`. */
  slug: string;
  /**
   * The directory segments between src/components and the file, or null in a
   * flat layout. Not restricted to a fixed set of tier names.
   */
  tier: string | null;
  /** Module path under src/components, e.g. `atoms/Button`. */
  subpath: string;
  /** The specifier a consumer types to import this component. */
  importSpecifier: string;
  /** Stylesheets this component needs, all of them included in styles.css. */
  stylesheetPaths: string[];
  description: string;
  /** The base type the props extend, whose members the prop table omits. */
  inherits: string | null;
  /** Every value the file exports. */
  exports: string[];
  /** Every type the file exports. */
  types: string[];
  propsType: string | null;
  variants: VariantRecord[];
  props: PropRecord[];
  subComponents: SubComponentRecord[];
  hooks: DeclaredHook[];
  /** Constraint ids resolving against `@elirobinson/ai-patterns/contracts`. */
  constraints: string[];
  /** What the extractor could not determine, stated rather than hidden. */
  extractionGaps: string[];
};

export type HookRecord = {
  name: string;
  subpath: string;
  importSpecifier: string;
  description: string;
  exports: string[];
  types: string[];
};

export type Manifest = {
  /** Bumped when this shape changes, so readers can degrade. */
  manifestVersion: number;
  package: string;
  version: string;
  /** Every distinct non-null `tier`, sorted. */
  tiers: string[];
  components: ComponentRecord[];
  hooks: HookRecord[];
};

declare const manifest: Manifest;
export default manifest;
