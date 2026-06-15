// Mobile screen kit — modeled on the Kids Recipes / Maths sub-apps.
// Two screens: Recipe list (Kids Recipes), Practice screen (Maths).

const PhoneFrame = ({ children, label }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
    <div
      style={{
        width: 320,
        height: 640,
        borderRadius: 44,
        background: 'var(--ink-1000)',
        padding: 10,
        boxShadow: '0 24px 60px -16px oklch(0% 0 0 / 0.3)',
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: 36,
          background: 'var(--bg)',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          style={{
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            fontFamily: 'Geist, sans-serif',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          <span>9:41</span>
          <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <span
              style={{
                width: 18,
                height: 11,
                border: '1.5px solid currentColor',
                borderRadius: 2,
                position: 'relative',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  inset: 1,
                  background: 'currentColor',
                  borderRadius: 1,
                }}
              ></span>
            </span>
          </span>
        </div>
        {children}
      </div>
    </div>
    <div
      style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 11,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: 'var(--fg-3)',
      }}
    >
      {label}
    </div>
  </div>
);

const RecipesScreen = () => {
  const recipes = [
    { emoji: '🥞', name: 'Banana Pancakes', tag: 'Breakfast', time: '15 min', diff: 'Easy' },
    { emoji: '🥪', name: 'Rainbow Sandwich', tag: 'Lunch', time: '10 min', diff: 'Easy' },
    { emoji: '🍝', name: 'Spaghetti Faces', tag: 'Dinner', time: '25 min', diff: 'Medium' },
    { emoji: '🍪', name: 'No-Bake Cookies', tag: 'Snack', time: '20 min', diff: 'Easy' },
  ];
  return (
    <div style={{ padding: '8px 20px 20px', overflow: 'auto', height: 'calc(100% - 36px)' }}>
      <div
        style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 10,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: 'var(--signal-700)',
          marginBottom: 6,
        }}
      >
        Kids Recipes
      </div>
      <h1
        style={{
          fontFamily: 'Geist, sans-serif',
          fontWeight: 600,
          fontSize: 30,
          letterSpacing: '-0.02em',
          margin: '0 0 6px',
          lineHeight: 1.1,
        }}
      >
        What's for breakfast?
      </h1>
      <p
        style={{
          fontFamily: 'Geist, sans-serif',
          fontSize: 13,
          color: 'var(--fg-2)',
          margin: '0 0 18px',
        }}
      >
        Pick a recipe, get cooking.
      </p>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto' }}>
        {['All', 'Breakfast', 'Lunch', 'Dinner', 'Snack'].map((t, i) => (
          <span
            key={t}
            style={{
              padding: '6px 12px',
              borderRadius: 999,
              fontFamily: 'Geist, sans-serif',
              fontSize: 12,
              fontWeight: 500,
              background: i === 0 ? 'var(--ink-1000)' : 'var(--ink-100)',
              color: i === 0 ? 'var(--ink-0)' : 'var(--fg-2)',
              whiteSpace: 'nowrap',
            }}
          >
            {t}
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {recipes.map((r, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              gap: 12,
              padding: 12,
              alignItems: 'center',
              border: '1px solid var(--border)',
              borderRadius: 8,
              background: 'var(--surface)',
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 6,
                background: 'var(--signal-50)',
                display: 'grid',
                placeItems: 'center',
                fontSize: 28,
              }}
            >
              {r.emoji}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontFamily: 'Geist, sans-serif',
                  fontSize: 14,
                  fontWeight: 600,
                  letterSpacing: '-0.01em',
                }}
              >
                {r.name}
              </div>
              <div
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 10,
                  color: 'var(--fg-3)',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  marginTop: 4,
                }}
              >
                {r.tag} · {r.time} · {r.diff}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const MathsScreen = () => {
  return (
    <div
      style={{
        padding: '8px 20px 20px',
        height: 'calc(100% - 36px)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 11,
          color: 'var(--fg-2)',
          marginBottom: 22,
        }}
      >
        <span style={{ letterSpacing: '0.16em', textTransform: 'uppercase' }}>Question 4 / 10</span>
        <span style={{ color: 'var(--anchor-500)' }}>Streak ×3</span>
      </div>
      <div
        style={{
          height: 4,
          background: 'var(--ink-100)',
          borderRadius: 999,
          marginBottom: 36,
          overflow: 'hidden',
        }}
      >
        <div style={{ width: '40%', height: '100%', background: 'var(--ink-1000)' }}></div>
      </div>
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 11,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: 'var(--fg-3)',
            marginBottom: 16,
          }}
        >
          Multiplication · Year 4
        </div>
        <div
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontWeight: 500,
            fontSize: 56,
            letterSpacing: '-0.02em',
            color: 'var(--ink-1000)',
            lineHeight: 1,
          }}
        >
          7 × 8 = ?
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        {['54', '56', '63', '49'].map((v, i) => (
          <button
            key={v}
            style={{
              padding: '20px 0',
              borderRadius: 8,
              border: '1px solid var(--border-strong)',
              background: i === 1 ? 'var(--signal-500)' : 'var(--surface)',
              color: 'var(--ink-1000)',
              fontFamily: 'JetBrains Mono, monospace',
              fontWeight: 500,
              fontSize: 22,
              letterSpacing: '-0.01em',
              cursor: 'pointer',
            }}
          >
            {v}
          </button>
        ))}
      </div>
      <button
        style={{
          width: '100%',
          padding: '14px 0',
          borderRadius: 8,
          background: 'var(--ink-1000)',
          color: 'var(--ink-0)',
          border: 'none',
          fontFamily: 'Geist, sans-serif',
          fontSize: 14,
          fontWeight: 500,
          cursor: 'pointer',
        }}
      >
        Skip question
      </button>
    </div>
  );
};

Object.assign(window, { PhoneFrame, RecipesScreen, MathsScreen });
