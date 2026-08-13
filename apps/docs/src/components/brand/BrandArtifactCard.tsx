import type { BrandArtifact } from '../../lib/brand';
import { brandFileUrl } from '../../lib/brand';

/* Renders the real file from public/brand/ — an iframe for HTML artifacts,
   an <img> for SVG assets. Rendering the artifact itself is the point: a
   React reproduction would be a second copy that drifts from the first. */
export function BrandArtifactCard({ artifact }: { artifact: BrandArtifact }) {
  const viewport = artifact.render?.viewport ?? null;
  const height = viewport?.height ?? (artifact.category === 'ui-kit' ? 720 : 360);

  return (
    <figure className="brand-card">
      <figcaption className="brand-card__caption">
        <span className="brand-card__title">{artifact.title}</span>
        {artifact.subtitle && <span className="brand-card__subtitle">{artifact.subtitle}</span>}
        <span className="brand-card__badges">
          <span
            className={`brand-card__badge ${
              artifact.ships ? 'brand-card__badge--ships' : 'brand-card__badge--repo'
            }`}
          >
            {artifact.ships ? 'ships' : 'repo-only'}
          </span>
          {artifact.origin === 'generated' && <span className="brand-card__badge">generated</span>}
        </span>
      </figcaption>
      {artifact.category === 'asset' ? (
        /* A plain <img>: the artifact IS the file — no optimizer pass. */
        <img src={brandFileUrl(artifact.path)} alt={artifact.title} className="brand-card__image" />
      ) : (
        <div className="brand-card__stage">
          <iframe
            src={brandFileUrl(artifact.path)}
            title={artifact.title}
            className="brand-card__frame"
            loading="lazy"
            style={{ height, width: viewport?.width ?? '100%' }}
          />
        </div>
      )}
    </figure>
  );
}
