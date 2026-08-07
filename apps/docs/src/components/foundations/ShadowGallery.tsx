import { tokensByPrefix } from '../../lib/tokens-css';

export function ShadowGallery() {
  return (
    <div className="shadow-gallery">
      {tokensByPrefix('shadow').map((token) => (
        <div key={token.name} className="shadow-gallery__item">
          <div className="shadow-gallery__box" style={{ boxShadow: `var(${token.name})` }} />
          <code>{token.name}</code>
          {token.comment && <span className="shadow-gallery__meta">{token.comment}</span>}
        </div>
      ))}
    </div>
  );
}
