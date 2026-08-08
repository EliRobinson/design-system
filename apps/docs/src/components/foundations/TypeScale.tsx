import { tokensByPrefix } from '../../lib/tokens-css';

/* Renders each --fs-* step at its actual size. The sample line is the brand
   tagline; sizes come from the live stylesheet. */
export function TypeScale() {
  const sizes = [...tokensByPrefix('fs')].reverse();

  return (
    <div className="type-scale">
      {sizes.map((token) => (
        <div key={token.name} className="type-scale__row">
          <div className="type-scale__meta">
            <code>{token.name}</code>
            <span>{token.value}</span>
          </div>
          <p className="type-scale__sample" style={{ fontSize: `var(${token.name})` }}>
            Practical tech, honestly built.
          </p>
        </div>
      ))}
    </div>
  );
}
