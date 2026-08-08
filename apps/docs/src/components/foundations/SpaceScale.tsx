import { tokensByPrefix } from '../../lib/tokens-css';

export function SpaceScale() {
  return (
    <div className="space-scale">
      {tokensByPrefix('space').map((token) => (
        <div key={token.name} className="space-scale__row">
          <code className="space-scale__name">{token.name}</code>
          <span className="space-scale__value">{token.value}</span>
          <span className="space-scale__bar" style={{ width: `var(${token.name})` }} />
        </div>
      ))}
    </div>
  );
}
