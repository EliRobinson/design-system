import { tokensByPrefix } from '../../lib/tokens-css';

export function RadiusGallery() {
  return (
    <div className="radius-gallery">
      {tokensByPrefix('radius').map((token) => (
        <div key={token.name} className="radius-gallery__item">
          <div className="radius-gallery__box" style={{ borderRadius: `var(${token.name})` }} />
          <code>{token.name}</code>
          <span className="radius-gallery__meta">
            {token.value}
            {token.comment ? ` — ${token.comment}` : ''}
          </span>
        </div>
      ))}
    </div>
  );
}
