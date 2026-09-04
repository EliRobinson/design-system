/** Shape of `@elirobinson/ai-elements/manifest`. */
export interface AiElementsManifestEntry {
  /** Kebab-case file name, e.g. `chain-of-thought`. */
  name: string;
  /** Which vendored tier the entry belongs to. */
  tier: 'components' | 'ui' | 'lib';
  /** The import specifier a consumer writes. There is no barrel. */
  subpath: string;
  /** Named exports, read from the emitted declaration file. */
  exports: string[];
  /** Path within the upstream repository this file was vendored from. */
  upstreamPath: string;
}

export interface AiElementsManifest {
  package: string;
  version: string;
  upstream: {
    repo: string;
    ref: string;
    commit: string;
    license: string;
  };
  entries: AiElementsManifestEntry[];
}

declare const manifest: AiElementsManifest;
export default manifest;
