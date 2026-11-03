/* The components that exist only in the Claude artifact, with no counterpart
 * in @elirobinson/react. Their source, stylesheet and types are the
 * artifact's, so every build reads them back from the live artifact and puts
 * them after one published component. Promote one into the package and delete
 * it here in the same change. */

export const ARTIFACT_ONLY = {
  names: ['ChatComposer', 'PromptSuggestions'],
  after: 'StreamingCaret',
  /* Paths inside the artifact's project/ folder. */
  source: (name) => `components/src/components/ai/${name}.jsx`,
  /* The bundle.css section marker that carries its stylesheet. */
  stylesheet: (name) => `components/ai/${name}.css`,
};

/**
 * The manifest's components in order with the artifact-only ones placed after
 * `ARTIFACT_ONLY.after`. `published(component)` and `artifactOnly(name)` make
 * each entry, so the bundle and the types share one order.
 */
export function inArtifactOrder(manifestComponents, published, artifactOnly) {
  if (!manifestComponents.some((component) => component.name === ARTIFACT_ONLY.after)) {
    throw new Error(
      `the manifest has no ${ARTIFACT_ONLY.after}; place the artifact-only components`,
    );
  }
  return manifestComponents.flatMap((component) => [
    published(component),
    ...(component.name === ARTIFACT_ONLY.after ? ARTIFACT_ONLY.names.map(artifactOnly) : []),
  ]);
}
