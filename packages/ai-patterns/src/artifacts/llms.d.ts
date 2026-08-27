/* The type surface for `@elirobinson/ai-patterns/corpus`.
 *
 * `llms.mjs` is plain JavaScript — this package ships `src` as written and has
 * no compile step for it — so the declarations are hand-written, exactly as
 * `testing/playwright` does it. `llms.types.test.mjs` compares these
 * declarations against the module's real exports in both directions, because
 * nothing in the build cross-checks them.
 *
 * The manifest types below are structural on purpose: they name only the fields
 * this generator reads. @elirobinson/react owns the real `Manifest` type and
 * declares more than this, and its records satisfy these shapes structurally —
 * so a consumer type-checks without ai-patterns taking a dependency on react.
 */

export type PropRecord = {
  name: string;
  type: string;
  required: boolean;
  defaultValue: string | null;
  description: string;
};

export type SubComponentRecord = {
  name: string;
  inherits: string | null;
  props: PropRecord[];
};

export type ComponentRecord = {
  name: string;
  tier: string | null;
  /** The specifier a consumer types to import this component. */
  importSpecifier: string;
  stylesheetPaths: string[];
  description: string;
  inherits: string | null;
  props: PropRecord[];
  subComponents: SubComponentRecord[];
  hooks: { name: string }[];
  constraints: string[];
  extractionGaps: string[];
};

export type HookRecord = {
  name: string;
  importSpecifier: string;
  description: string;
};

export type Manifest = {
  /**
   * Every distinct non-null tier, as the manifest reports them. Components are
   * grouped and emitted tier by tier in exactly this order — the corpus has no
   * opinion of its own about which tier comes first.
   *
   * Optional because a manifest predating `manifestVersion: 2` has no `tiers`;
   * given none, components are emitted in the order the manifest lists them.
   */
  tiers?: string[];
  components: ComponentRecord[];
  hooks: HookRecord[];
};

/** The subset of `@elirobinson/ai-patterns/contracts` the corpus renders. */
export type Contracts = {
  componentConstraints?: Record<string, { summary: string; check: string }>;
  uiContracts: {
    minimumTouchTarget: string;
    focusVisibleRequired: boolean;
    contrastLevel: string;
  };
};

/** One token, as returned by `parseTokensCss` from @elirobinson/tokens. */
export type TokenEntry = {
  name: string;
  value: string;
  comment: string | null;
};

export type Versions = {
  aiPatterns: string;
  react: string;
  tokens: string;
};

/** The heading and bullets pointing at whatever else the caller publishes. */
export type AlsoAvailable = {
  heading: string;
  entries: string[];
};

export type IndexInput = {
  manifest: Manifest;
  /** Omit on a live surface; supplying it stamps the output as a snapshot. */
  versions?: Versions;
  alsoAvailable?: AlsoAvailable;
};

/**
 * One brand artifact, structurally the records
 * `@elirobinson/ai-patterns/brand-manifest` carries — only the fields the
 * corpus renders.
 */
export type BrandArtifactEntry = {
  path: string;
  title: string;
  ships: boolean;
  components?: string[];
};

export type BrandInput = {
  /** design-system-docs/README.md source; CONTENT FUNDAMENTALS is extracted. */
  readme: string;
  /**
   * The id of the voice pack the section renders — `resolveVoicePack().pack.id`. The
   * caller resolves it, because this renderer reads no filesystem. Required: a corpus
   * that cannot name its pack should not claim to carry one.
   */
  packId: string;
  /**
   * Pre-filtered by the caller: the packed snapshot passes only `ships: true`
   * artifacts; the docs site may include repo-only ones, which are marked.
   */
  artifacts?: BrandArtifactEntry[];
  /** One caller-specific line about where the brand source lives. */
  note?: string;
};

/* Generic over the record type so a caller whose manifest carries more than the
   generator reads — `slug`, say — gets that richer record back in its
   `componentAppendix`, instead of having to cast it there. */
export type FullInput<C extends ComponentRecord = ComponentRecord> = {
  manifest: Manifest & { components: C[] };
  contracts: Contracts;
  tokens: TokenEntry[];
  /** Omit on a live surface; supplying it stamps the output as a snapshot. */
  versions?: Versions;
  /** Narrative pages the caller has, already reduced to plain markdown. */
  prose?: { foundations?: string[]; patterns?: string[] };
  /** Extra blocks to append to each component's section, in order. */
  componentAppendix?: (component: C) => string[];
  /** The brand layer: voice rules plus the kit and asset inventory. */
  brand?: BrandInput;
};

export declare const DLX: string;
export declare const RESYNC_COMMAND: string;
export declare function versionStamp(versions: Versions): string;
export declare function brandVoice(readme: string): string;
export declare function llmsIndex(input: IndexInput): string;
export declare function llmsFull<C extends ComponentRecord>(input: FullInput<C>): string;
