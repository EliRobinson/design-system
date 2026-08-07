'use client';

import { useState } from 'react';

import { Button } from '@elirobinson/react/components/atoms/Button';

import type { TokenEntry } from '../../lib/tokens-css';

/* Client demo: replays a translate transition per duration × easing so the
   motion tokens can be felt, not just read. tokens.css's global
   prefers-reduced-motion rule collapses these automatically. */
export function MotionGallery({
  durations,
  easings,
}: {
  durations: TokenEntry[];
  easings: TokenEntry[];
}) {
  const [run, setRun] = useState(false);

  return (
    <div className="motion-gallery">
      <Button variant="secondary" size="sm" onClick={() => setRun((r) => !r)}>
        Replay
      </Button>
      {easings.map((ease) => (
        <section key={ease.name} className="motion-gallery__group">
          <h3>
            <code>{ease.name}</code> <span className="motion-gallery__value">{ease.value}</span>
          </h3>
          {durations.map((dur) => (
            <div key={dur.name} className="motion-gallery__row">
              <code className="motion-gallery__label">{dur.name}</code>
              <span className="motion-gallery__value">{dur.value}</span>
              <div className="motion-gallery__track">
                <span
                  className="motion-gallery__dot"
                  style={{
                    transition: `transform var(${dur.name}) var(${ease.name})`,
                    transform: run ? 'translateX(200px)' : 'translateX(0)',
                  }}
                />
              </div>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
