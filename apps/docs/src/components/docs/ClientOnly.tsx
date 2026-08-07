'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

/* Defers children to the client. Needed for demos of components that touch
   the DOM during render — Toaster portals into document.body unconditionally,
   so it cannot server-render. */
export function ClientOnly({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? children : null;
}
