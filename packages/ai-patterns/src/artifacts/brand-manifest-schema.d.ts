/* The type surface of `@elirobinson/ai-patterns/brand-manifest`.
 *
 * Hand-written because the manifest is JSON generated at build time by
 * brand-manifest.mjs; build-artifacts.mjs copies this file to
 * dist/artifacts/brand-manifest.d.ts next to it. brand-manifest.test.mjs
 * pins the runtime shape; the docs site's typechecked usage is what stops
 * this file from lying. */

export type BrandMemberRole = 'entry' | 'doc' | 'source' | 'vendored';

export type BrandCategory =
  | 'brand-doc'
  | 'tokens'
  | 'aggregate-stylesheet'
  | 'guideline-card'
  | 'component-card'
  | 'preview-card'
  | 'ui-kit'
  | 'slide'
  | 'pattern'
  | 'asset'
  | 'support-file'
  | 'scratch';

export type BrandOrigin = 'generated' | 'hand-authored' | 'vendored' | 'mirrored' | 'incidental';

export type BrandRender = {
  /** Renders correctly from the folder without a server or missing scripts. */
  standalone: boolean;
  /** True when in-browser Babel fetches sources, which file:// CORS-blocks. */
  requiresHttpOrigin: boolean;
  /** Hosts the artifact fetches from, including through its stylesheet chain. */
  externalOrigins: string[];
  /** Stylesheet hrefs exactly as written in the entry file. */
  stylesheets: string[];
  viewport: { width: number; height: number | null } | null;
  blockedBy: string[];
};

export type BrandArtifact = {
  id: string;
  /** The entry point — the one member that renders. */
  path: string;
  category: BrandCategory;
  title: string;
  subtitle?: string;
  group: string | null;
  origin: BrandOrigin;
  generatedBy?: string;
  symlinkTarget?: string;
  ships: boolean;
  shipReason: string;
  /** ui-kit only: top-level components its sources define. */
  components?: string[];
  members: { path: string; role: BrandMemberRole }[];
  render: BrandRender | null;
  sha256: string;
};

export type BrandManifest = {
  $comment: string;
  root: string;
  artifacts: BrandArtifact[];
};

declare const manifest: BrandManifest;
export default manifest;
